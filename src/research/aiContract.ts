import type { Platform } from '../config/platforms';
import { formatTime } from '../core/math/util';
import { LOCALE_NAMES, type Locale } from '../i18n/locales';
import { allowedNumbers, MAX_FINDINGS, type Finding } from './insights';
import type { StudyKind } from './model';
import type { VariantReport } from './report';

/**
 * Kontrakt warstwy AI (§8.4). Model językowy dostaje WYŁĄCZNIE zagregowane metryki i wnioski
 * reguł — bez danych osobowych i surowych próbek. Odpowiedź (JSON według schematu) przechodzi
 * walidację: każda liczba w tekście musi pochodzić z danych, a tekst nie może zawierać diagnoz,
 * emocji widzów, obietnic zasięgu ani stereotypów. Niezgodny wniosek jest odrzucany i liczony.
 */
export interface AiInsight {
  title: string;
  fact: string;
  observation: string | null;
  hypothesis: string | null;
  recommendation: string;
  t0: number;
  t1: number;
}

export interface AiInsightsResult {
  source: 'ai' | 'rules';
  /** Model, który napisał tekst (null — reguły). */
  model: string | null;
  insights: AiInsight[];
  /** Odrzucone propozycje z liczbami spoza danych albo zakazanymi treściami. */
  rejected: number;
}

/** Limity długości pól (§8.4 pkt 1). */
export const AI_LIMITS = { insights: MAX_FINDINGS, title: 160, text: 600 } as const;

/** Wnioski z reguł w formacie odpowiedzi AI (gdy AI jest niedostępne albo zawiodło). */
export function insightsFromFindings(findings: readonly Finding[], rejected = 0): AiInsightsResult {
  return {
    source: 'rules',
    model: null,
    insights: findings
      .filter((f) => f.recommendation)
      .map((f) => ({ title: f.title, fact: f.fact, observation: f.observation, hypothesis: f.hypothesis, recommendation: f.recommendation as string, t0: f.t0, t1: f.t1 })),
    rejected,
  };
}

export interface AiContext {
  projectName: string;
  kind: StudyKind;
  platform: Platform;
  /** Materiał pionowy (9:16) albo poziomy. */
  vertical: boolean;
}

const pct = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 100));
const sec = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const stamp = (t: number) => formatTime(Math.max(0, t), 0);

/** Zwięzłe dane wejściowe dla modelu: tylko liczby policzone z sesji (bez danych widzów). */
export function buildAiInput(r: VariantReport, ctx: AiContext) {
  return {
    material: {
      name: ctx.projectName,
      studyKind: ctx.kind,
      orientation: ctx.vertical ? 'vertical 9:16' : 'horizontal',
      platform: ctx.platform,
      durationSeconds: Math.round(r.duration),
      viewers: r.viewers,
      sampleLevel: r.level,
      meanAttentionPct: pct(r.meanAttention),
      after3sPct: pct(r.hook.at3),
      hookRetentionPct: pct(r.hook.retention),
      last3sPct: pct(r.endAttention),
    },
    curve: { binSeconds: r.bin, attentionPct: r.curve.map((p) => pct(p.value)) },
    drops: r.drops.map((d) => ({
      from: stamp(d.start),
      to: stamp(d.end),
      fromPct: pct(d.from),
      toPct: pct(d.to),
      deltaPp: pct(d.delta),
      viewersLost: d.lost,
      viewers: d.n,
      segment: d.segment?.label ?? null,
      startsAfterCut: d.afterCut,
      secondsIntoSegment: d.intoSegment === null ? null : Math.round(d.intoSegment),
    })),
    segments: r.segments.map((s) => ({ number: s.index + 1, label: s.label, from: stamp(s.t0), to: stamp(s.t1), meanPct: pct(s.mean), changePp: pct(s.change), fixRank: s.fixRank })),
    areas: r.aois.map((a) => ({
      name: a.aoi.name,
      type: a.aoi.type,
      from: stamp(a.aoi.t0),
      to: stamp(a.aoi.t1),
      reachPct: pct(a.reach),
      lookers: a.lookers,
      viewers: a.n,
      firstLookSeconds: sec(a.firstLook),
      small: a.small,
    })),
    brand: r.brand ? { firstLookMedianSeconds: sec(r.brand.firstLookMedian), by3sPct: pct(r.brand.by3s), reachPct: pct(r.brand.reach) } : null,
    feed: r.feed
      ? {
          stopSeconds: r.feed.stopSeconds,
          scrollStopPct: pct(r.feed.stop),
          fillerScrollStopPct: pct(r.feed.fillerStop),
          gazeStopPct: pct(r.feed.gazeStop),
          differenceSignificant: r.feed.significant,
          dwellMedianSeconds: sec(r.feed.dwellMedian),
          fillerDwellMeanSeconds: sec(r.feed.fillerDwellMean),
          completionPct: pct(r.feed.completion),
          meanLoops: sec(r.feed.meanLoops),
          watchingNotLookingPct: pct(r.feed.notLooking),
        }
      : null,
    thumbnail: r.grid
      ? { lookedPct: pct(r.grid.looked), firstLookMedianSeconds: sec(r.grid.firstLookMedian), dwellSharePct: pct(r.grid.dwellShare), firstLookRankMedian: r.grid.rankMedian, chosen: r.grid.choice.tested, asked: r.grid.choice.asked }
      : null,
    carousel: r.carousel ? { slides: r.carousel.slides, reachPct: r.carousel.reach.map(pct), attentionPct: r.carousel.attention.map(pct), completedPct: pct(r.carousel.completed) } : null,
    ruleFindings: r.findings.map((f) => ({ severity: f.severity, title: f.title, fact: f.fact, observation: f.observation, hypothesis: f.hypothesis, recommendation: f.recommendation, from: stamp(f.t0), to: stamp(f.t1) })),
  };
}

export type AiInput = ReturnType<typeof buildAiInput>;

/** JSON Schema odpowiedzi (ustrukturyzowane wyjście; wszystkie pola wymagane). */
export const AI_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['insights'],
  properties: {
    insights: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'fact', 'observation', 'hypothesis', 'recommendation', 't0', 't1'],
        properties: {
          title: { type: 'string' },
          fact: { type: 'string' },
          observation: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          hypothesis: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          recommendation: { type: 'string' },
          t0: { type: 'number' },
          t1: { type: 'number' },
        },
      },
    },
  },
} as const;

/** Prompt systemowy (§8.4). Język odpowiedzi podaje wiadomość użytkownika. */
export const AI_SYSTEM_PROMPT = `Jesteś analitykiem badań uwagi widzów dla twórców treści w social media. Dostajesz wyłącznie zagregowane metryki z badania wzroku kamerą internetową: krzywą odsetka widzów patrzących na materiał, retencję w feedzie, spadki, sceny, strefy zainteresowania i wnioski z reguł.

Pisz rzeczowo, językiem montażysty i twórcy (hook, cięcie, napis, zbliżenie, CTA), w języku podanym w wiadomości. Każdy wniosek rozdziel na fakt (liczby z metryk), obserwację, hipotezę (zaznacz niepewność) i rekomendację (konkretna zmiana montażowa).

Używaj wyłącznie liczb z danych — wniosek z liczbą spoza danych zostanie odrzucony. Czasy zapisuj jak w danych (np. 00:07). Nie przewiduj wyświetleń, zasięgów ani viralności. Nie przypisuj widzom emocji, cech ani intencji i nie uogólniaj na grupy wiekowe czy płeć; opisuj materiał i zachowanie wzroku. Przy próbie innej niż „reliable” zaznacz, że wynik jest wstępny.

Zwróć 1–5 wniosków od najważniejszego; t0 i t1 to sekundy materiału, których dotyczy wniosek.`;

/** Wiadomość użytkownika (§8.4): język odpowiedzi i metryki w JSON. */
export const aiUserMessage = (input: AiInput, locale: Locale) => `Język odpowiedzi: ${LOCALE_NAMES[locale]} (${locale}).\nMetryki badania (JSON):\n${JSON.stringify(input)}`;

/**
 * Zakazane treści (§8.4 pkt 3), w każdym języku interfejsu i kilku kolejnych: diagnozy i zaburzenia;
 * emocje i stany psychiczne widzów; gwarancje i obietnice zasięgu; stereotypy demograficzne.
 */
export const FORBIDDEN_PATTERNS: Record<'diagnosis' | 'emotion' | 'promise' | 'stereotype', RegExp> = {
  diagnosis: /diagnoz|zaburzen|adhd|autyzm|autysty|depresj|uzależnien|diagnos|disorder|autis|depress|addict|störung|trastorno|disturbo/i,
  emotion:
    /emocj|znudzen|znudzi|nudzą się|frustracj|sfrustrowan|ekscytacj|podekscytowan|zdenerwowan|zniecierpliwien|smutek|smutni|emotion|bored|boredom|frustrat|excitement|excited|annoyed|impatien|anxious|anxiety|gelangweilt|aburrid|annoiat|emozion|emoci/i,
  promise:
    /gwarant|viral|wiral|milion\w* wyświetleń|zwiększy\w* zasięg|zasięg wzrośnie|wybije się|guarante|million views|increase (?:your )?reach|boost (?:your )?reach|will go viral|more views/i,
  stereotype:
    /(?:kobiety|mężczyźni|starsi|młodzi|młodzież|nastolat\w*|boomer\w*|zoomer\w*|pokolenie z)\s+(?:wol\w*|lubi\w*|nie lubi\w*|zawsze|nigdy|nie potrafi\w*|nie rozumie\w*)|(?:women|men|older people|young people|teens|teenagers|boomers|gen z)\s+(?:prefer|like|dislike|always|never|can't|cannot|don't understand)/i,
};

export const forbiddenIn = (text: string): keyof typeof FORBIDDEN_PATTERNS | null => (Object.keys(FORBIDDEN_PATTERNS) as Array<keyof typeof FORBIDDEN_PATTERNS>).find((k) => FORBIDDEN_PATTERNS[k].test(text)) ?? null;

/** Wszystkie liczby, które wolno przytoczyć: metryki raportu, liczby z danych wejściowych, znaczniki czasu, teksty reguł. */
export function allowedForInput(r: VariantReport, input: AiInput): Set<string> {
  const s = allowedNumbers(r);
  const add = (v: number) => {
    s.add(String(Math.round(v)));
    s.add(String(Math.round(v * 10) / 10));
  };
  const walk = (x: unknown): void => {
    if (typeof x === 'number' && Number.isFinite(x)) add(x);
    else if (typeof x === 'string') for (const m of x.match(/\d+(?:[.,]\d+)?/g) ?? []) add(Number(m.replace(',', '.')));
    else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') Object.values(x).forEach(walk);
  };
  walk(input);
  return s;
}

/** Liczby w tekście, których nie ma w danych (porównanie po zaokrągleniu, także z przecinkiem dziesiętnym). */
export function unknownNumbers(text: string, allowed: ReadonlySet<string>): string[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).filter((m) => {
    const v = Number(m.replace(',', '.'));
    return !allowed.has(String(Math.round(v))) && !allowed.has(String(Math.round(v * 10) / 10));
  });
}

const str = (x: unknown, max: number): string | null => (typeof x === 'string' && x.trim() && x.length <= max ? x.trim() : null);

/**
 * Walidacja odpowiedzi modelu (§8.4): najwyżej 6 wniosków, limity długości, liczby tylko z danych,
 * bez zakazanych treści, czasy w zakresie materiału. Zwraca zaakceptowane wnioski i liczbę odrzuconych.
 */
export function validateAiInsights(raw: unknown, r: VariantReport, input: AiInput): { insights: AiInsight[]; rejected: number } {
  const list = (raw as { insights?: unknown } | null)?.insights;
  if (!Array.isArray(list)) return { insights: [], rejected: 0 };
  const allowed = allowedForInput(r, input);
  const out: AiInsight[] = [];
  let rejected = Math.max(0, list.length - AI_LIMITS.insights);
  for (const item of list.slice(0, AI_LIMITS.insights)) {
    const i = (item ?? {}) as Record<string, unknown>;
    const title = str(i.title, AI_LIMITS.title);
    const fact = str(i.fact, AI_LIMITS.text);
    const recommendation = str(i.recommendation, AI_LIMITS.text);
    const observation = i.observation === null ? null : str(i.observation, AI_LIMITS.text);
    const hypothesis = i.hypothesis === null ? null : str(i.hypothesis, AI_LIMITS.text);
    const t0 = typeof i.t0 === 'number' && Number.isFinite(i.t0) ? i.t0 : NaN;
    const t1 = typeof i.t1 === 'number' && Number.isFinite(i.t1) ? i.t1 : NaN;
    const timesOk = t0 >= 0 && t1 >= t0 && t1 <= r.duration + 1;
    const shapeOk = title && fact && recommendation && (i.observation === null || observation) && (i.hypothesis === null || hypothesis) && timesOk;
    if (!shapeOk) {
      rejected++;
      continue;
    }
    const insight: AiInsight = { title, fact, observation, hypothesis, recommendation, t0, t1: Math.min(t1, r.duration) };
    const text = [title, fact, observation ?? '', hypothesis ?? '', recommendation].join(' ');
    if (unknownNumbers(text, allowed).length || forbiddenIn(text)) {
      rejected++;
      continue;
    }
    out.push(insight);
  }
  return { insights: out, rejected };
}
