import type { APIRoute } from 'astro';
import {
  registrar,
  derivarVisitaId,
  clasificarDispositivo,
  clasificarNavegador,
} from '../../lib/analitica';

export const prerender = false;

/**
 * Recibe la baliza de interacción (tiempo en página y scroll máximo) que el
 * navegador envía con `navigator.sendBeacon` al abandonar la página.
 * No acepta ningún dato identificativo: solo dos métricas y la ruta.
 */
export const POST: APIRoute = async ({ request }) => {
  let cuerpo: { ruta?: string; ref?: string | null; segundos?: number; scrollMax?: number };
  try {
    cuerpo = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const ua = request.headers.get('user-agent') ?? '';
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'sin-ip';

  void registrar({
    tipo: 'interaccion',
    ruta: typeof cuerpo.ruta === 'string' ? cuerpo.ruta.slice(0, 200) : '/',
    ref: typeof cuerpo.ref === 'string' ? cuerpo.ref.slice(0, 64) : null,
    visitaId: derivarVisitaId(ip, ua),
    referrer: null,
    dispositivo: clasificarDispositivo(ua),
    navegador: clasificarNavegador(ua),
    pais: request.headers.get('x-client-region') ?? request.headers.get('cf-ipcountry'),
    segundos: Math.min(Math.max(Number(cuerpo.segundos) || 0, 0), 3600),
    scrollMax: Math.min(Math.max(Number(cuerpo.scrollMax) || 0, 0), 100),
    ts: new Date().toISOString(),
  });

  // 204 sin cuerpo: sendBeacon no espera respuesta.
  return new Response(null, { status: 204 });
};
