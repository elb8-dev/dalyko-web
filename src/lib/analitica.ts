/**
 * Analítica propia — sobria y sin datos personales.
 *
 * Principios de diseño:
 *  1. SIN COOKIES y sin almacenamiento en el navegador -> no requiere banner de
 *     consentimiento (ePrivacy) porque no se accede a información del terminal.
 *  2. NO se almacena la IP. Se deriva un identificador de visita efímero:
 *     SHA-256(sal_diaria + ip + user-agent), truncado. La sal rota cada día, de
 *     modo que el identificador es irreversible y no permite seguimiento entre
 *     días ni entre sitios.
 *  3. NO se perfila a personas identificadas. La unidad de análisis es la
 *     VISITA y, cuando procede, la ORGANIZACIÓN de origen (atribución por `ref`).
 *  4. Atribución por destinatario: cada candidatura se envía con `?ref=<destino>`,
 *     lo que permite saber qué organización ha leído el perfil sin tratar ningún
 *     dato personal.
 */

import { createHash } from 'node:crypto';

export interface EventoAnalitica {
  tipo: 'vista' | 'interaccion';
  ruta: string;
  ref: string | null;
  visitaId: string;
  referrer: string | null;
  dispositivo: 'movil' | 'tablet' | 'escritorio' | 'bot' | 'desconocido';
  navegador: string;
  pais: string | null;
  /** Solo en eventos de interacción. */
  segundos?: number;
  scrollMax?: number;
  ts: string;
}

/** Sal del día: rota a las 00:00 UTC, haciendo irreversible el histórico. */
function salDiaria(): string {
  const base = process.env.ANALYTICS_SALT ?? 'sal-por-defecto-cambiar';
  return `${base}:${new Date().toISOString().slice(0, 10)}`;
}

/** Identificador de visita efímero. No es un identificador de persona. */
export function derivarVisitaId(ip: string, userAgent: string): string {
  return createHash('sha256')
    .update(`${salDiaria()}|${ip}|${userAgent}`)
    .digest('hex')
    .slice(0, 16);
}

export function clasificarDispositivo(ua: string): EventoAnalitica['dispositivo'] {
  const s = ua.toLowerCase();
  if (/bot|crawler|spider|crawling|lighthouse|headless/.test(s)) return 'bot';
  if (/ipad|tablet/.test(s)) return 'tablet';
  if (/mobi|android|iphone/.test(s)) return 'movil';
  if (s.length > 0) return 'escritorio';
  return 'desconocido';
}

export function clasificarNavegador(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'otro';
}

/**
 * Emite el evento. En Cloud Run, todo lo escrito en stdout como JSON lo recoge
 * Cloud Logging automáticamente (y puede exportarse a BigQuery para informes).
 * Si se define ANALYTICS_WEBHOOK, además se reenvía al backend de DalyKo.
 */
export async function registrar(evento: EventoAnalitica): Promise<void> {
  if (process.env.ANALYTICS_ENABLED === 'false') return;

  // Formato de entrada estructurada de Cloud Logging.
  console.log(JSON.stringify({ severity: 'INFO', message: 'analitica', ...evento }));

  const webhook = process.env.ANALYTICS_WEBHOOK;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.ANALYTICS_TOKEN ? { authorization: `Bearer ${process.env.ANALYTICS_TOKEN}` } : {}),
      },
      body: JSON.stringify(evento),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // La analítica nunca debe tumbar una petición de página.
  }
}
