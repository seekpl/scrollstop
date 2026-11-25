import Anthropic from '@anthropic-ai/sdk';
import { BRAND } from '../src/config/brand';
import type { Locale } from '../src/i18n/locales';
import { AI_OUTPUT_SCHEMA, AI_SYSTEM_PROMPT, aiUserMessage, insightsFromFindings, validateAiInsights, type AiInput, type AiInsightsResult } from '../src/research/aiContract';
import type { VariantReport } from '../src/research/report';

/**
 * Rekomendacje montażowe pisane przez Claude (§8.4). Model dostaje wyłącznie policzone metryki
 * (`buildAiInput`), odpowiada w ustalonym schemacie JSON, a odpowiedź przechodzi walidację:
 * liczby spoza danych i zakazane treści są odrzucane. Przy odmowie, przekroczeniu `max_tokens`,
 * błędzie API albo pustym wyniku wracamy do wniosków z reguł (ten sam format).
 */
export interface InsightsGenerator {
  /** Model z konfiguracji (`AI_MODEL`) — część klucza pamięci podręcznej. */
  model: string;
  generate(report: VariantReport, input: AiInput, locale: Locale): Promise<AiInsightsResult>;
}

export const DEFAULT_AI_MODEL = 'claude-opus-5-5';

/** Modele z automatycznym modelem zapasowym po stronie API przy odmowie klasyfikatora. */
const SERVER_FALLBACK_MODELS = new Set(['claude-fable-5-2', 'claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5']);

/** Podzbiór klienta, z którego korzystamy (w testach — atrapa). */
export type MessagesClient = Pick<Anthropic, 'beta'>;

export function createClaudeGenerator(opts: { apiKey: string; model?: string; client?: MessagesClient; log?: (line: string) => void }): InsightsGenerator {
  const client: MessagesClient = opts.client ?? new Anthropic({ apiKey: opts.apiKey, maxRetries: 2, timeout: 120_000 });
  const model = opts.model || DEFAULT_AI_MODEL;
  const log = opts.log ?? ((line: string) => console.warn(`[${BRAND.code}] AI: ${line}`));
  return {
    model,
    async generate(report, input, locale) {
      const rules = (rejected = 0) => insightsFromFindings(report.findings, rejected);
      if (!report.viewers) return rules();
      try {
        const response = await client.beta.messages.create({
          model,
          max_tokens: 16000,
          // Przy odmowie klasyfikatora API samo powtarza zapytanie na zalecanym modelu zapasowym.
          ...(SERVER_FALLBACK_MODELS.has(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
          output_config: { effort: 'medium', format: { type: 'json_schema', schema: AI_OUTPUT_SCHEMA as unknown as Record<string, unknown> } },
          system: AI_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: aiUserMessage(input, locale) }],
        });
        if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
          log(`odpowiedź bez wyniku (${response.stop_reason}), używam reguł`);
          return rules();
        }
        const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
        const { insights, rejected } = validateAiInsights(JSON.parse(text), report, input);
        if (!insights.length) return rules(rejected);
        return { source: 'ai', model: response.model, insights, rejected };
      } catch (e) {
        if (e instanceof Anthropic.AuthenticationError) log('nieprawidłowy ANTHROPIC_API_KEY, używam reguł');
        else if (e instanceof Anthropic.RateLimitError) log('limit zapytań API, używam reguł');
        else if (e instanceof Anthropic.APIError) log(`błąd API ${e.status ?? ''}, używam reguł`);
        else if (e instanceof SyntaxError) log('odpowiedź nie jest poprawnym JSON, używam reguł');
        else log('błąd połączenia, używam reguł');
        return rules();
      }
    },
  };
}
