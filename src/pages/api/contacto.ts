import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';

export const prerender = false;

/** Ventana de limitación por IP: 3 envíos cada 10 minutos. */
const VENTANA_MS = 10 * 60 * 1000;
const MAX_ENVIOS = 3;
const registro = new Map<string, number[]>();

function limitado(ip: string): boolean {
  const ahora = Date.now();
  const previos = (registro.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (previos.length >= MAX_ENVIOS) {
    registro.set(ip, previos);
    return true;
  }
  previos.push(ahora);
  registro.set(ip, previos);
  return false;
}

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const POST: APIRoute = async ({ request }) => {
  const responder = (estado: number, cuerpo: Record<string, unknown>) =>
    new Response(JSON.stringify(cuerpo), {
      status: estado,
      headers: { 'content-type': 'application/json' },
    });

  let datos: Record<string, unknown>;
  try {
    datos = await request.json();
  } catch {
    return responder(400, { error: 'Cuerpo no válido.' });
  }

  const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const nombre = texto(datos.nombre, 120);
  const correo = texto(datos.correo, 200);
  const organizacion = texto(datos.organizacion, 160);
  const mensaje = texto(datos.mensaje, 5000);
  const ref = texto(datos.ref, 64) || null;
  const trampa = texto(datos.empresa_web, 200);

  // Honeypot: un bot rellena el campo oculto. Se responde 200 para no darle
  // señal de que ha sido detectado, pero no se envía nada.
  if (trampa) {
    return responder(200, { ok: true, referencia: randomBytes(4).toString('hex').toUpperCase() });
  }

  if (!nombre) return responder(400, { error: 'Falta el nombre.' });
  if (!CORREO_RE.test(correo)) return responder(400, { error: 'El correo no es válido.' });
  if (mensaje.length < 10) return responder(400, { error: 'El mensaje es demasiado corto.' });

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'sin-ip';
  if (limitado(ip)) return responder(429, { error: 'Demasiados envíos. Inténtalo más tarde.' });

  const referencia = randomBytes(4).toString('hex').toUpperCase();
  const destino = process.env.CONTACTO_ENDPOINT;

  if (!destino) {
    // Sin backend configurado no se pierde el mensaje: queda en Cloud Logging.
    console.log(JSON.stringify({
      severity: 'WARNING', message: 'contacto-sin-endpoint',
      referencia, nombre, correo, organizacion, mensaje, ref,
    }));
    return responder(200, { ok: true, referencia });
  }

  try {
    const r = await fetch(destino, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.CONTACTO_TOKEN ? { authorization: `Bearer ${process.env.CONTACTO_TOKEN}` } : {}),
      },
      body: JSON.stringify({ referencia, nombre, correo, organizacion, mensaje, ref, origen: 'perfil.dalyko.com' }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`backend ${r.status}`);
  } catch (err) {
    // El mensaje queda registrado aunque el backend falle: nunca se pierde.
    console.log(JSON.stringify({
      severity: 'ERROR', message: 'contacto-fallo-backend',
      referencia, nombre, correo, organizacion, mensaje, ref,
      detalle: String(err),
    }));
    return responder(502, { error: 'No se ha podido enviar el mensaje.' });
  }

  console.log(JSON.stringify({ severity: 'INFO', message: 'contacto-enviado', referencia, ref, organizacion }));
  return responder(200, { ok: true, referencia });
};
