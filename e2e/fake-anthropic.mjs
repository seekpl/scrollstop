// Atrapa Messages API dla testów E2E (§22.2): serwer aplikacji woła ją prawdziwym SDK
// (`ANTHROPIC_BASE_URL`). Sprawdza kształt zapytania (schemat JSON, wysiłek, model zapasowy) i odpowiada
// wnioskiem zbudowanym wyłącznie z liczb z metryk — tak, jak powinien odpowiadać model.
import { createServer } from 'node:http';

const secs = (stamp) => stamp.split(':').reduce((a, x) => a * 60 + Number(x), 0);

export function startFakeAnthropic({ port }) {
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const fail = (status, message) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message } }));
      };
      if (req.method !== 'POST' || !req.url?.startsWith('/v1/messages')) return fail(404, 'not found');
      if (!req.headers['x-api-key']) return fail(401, 'missing key');
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return fail(400, 'bad json');
      }
      if (body.output_config?.format?.type !== 'json_schema' || body.output_config?.effort !== 'medium') return fail(400, 'expected json_schema output and medium effort');
      if (!String(req.headers['anthropic-beta'] ?? '').includes('server-side-fallback-2026-07-01') || body.fallbacks !== 'default') return fail(400, 'expected server-side fallback');
      const text = body.messages?.[0]?.content ?? '';
      const metrics = JSON.parse(text.slice(text.indexOf('{')));
      const d = metrics.drops[0];
      const insight = d
        ? {
            title: `Spadek o ${d.deltaPp} pp (${d.from}–${d.to})`,
            fact: `Między ${d.from} a ${d.to} odsetek patrzących spada z ${d.fromPct}% do ${d.toPct}%.`,
            observation: 'Spadek zaczyna się przy zmianie ujęcia.',
            hypothesis: 'Możliwe, że nowe ujęcie nie daje punktu zaczepienia dla wzroku.',
            recommendation: 'Otwórz ujęcie mocniej: zbliżenie, ruch albo krótki napis na start.',
            t0: secs(d.from),
            t1: secs(d.to),
          }
        : { title: 'Materiał trzyma uwagę', fact: `Średnio patrzy ${metrics.material.meanAttentionPct}%.`, observation: null, hypothesis: null, recommendation: 'Zachowaj tempo montażu.', t0: 0, t1: 1 };
      res.writeHead(200, { 'Content-Type': 'application/json', 'request-id': 'req_fake' });
      res.end(
        JSON.stringify({
          id: 'msg_fake',
          type: 'message',
          role: 'assistant',
          model: body.model,
          content: [
            { type: 'thinking', thinking: '', signature: 'fake' },
            { type: 'text', text: JSON.stringify({ insights: [insight] }) },
          ],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      );
    });
  });
  server.listen(port, '127.0.0.1');
  return server;
}
