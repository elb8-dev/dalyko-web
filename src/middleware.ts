import { defineMiddleware } from 'astro:middleware';
import {
  registrar,
  derivarVisitaId,
  clasificarDispositivo,
  clasificarNavegador,
} from './lib/analitica';

/**
 * Middleware de servidor: registra una vista por petición de página.
 * No escribe cookies ni toca el almacenamiento del navegador.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);

  // Ignorar activos y endpoints internos.
  const esPagina =
    !url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/_') &&
    !/\.[a-z0-9]+$/i.test(url.pathname);

  if (esPagina) {
    const h = context.request.headers;
    const ua = h.get('user-agent') ?? '';
    // Cloud Run entrega la IP del cliente en X-Forwarded-For. Se usa solo para
    // derivar el hash efímero y NO se almacena en ningún momento.
    const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'sin-ip';

    // La atribución por destinatario se mantiene durante la navegación
    // mediante el propio enlace; no se persiste en el cliente.
    const ref = url.searchParams.get('ref');

    void registrar({
      tipo: 'vista',
      ruta: url.pathname,
      ref,
      visitaId: derivarVisitaId(ip, ua),
      referrer: h.get('referer'),
      dispositivo: clasificarDispositivo(ua),
      navegador: clasificarNavegador(ua),
      // Cabecera que inyecta Cloud Run / Cloudflare con el país (granularidad de país).
      pais: h.get('x-client-region') ?? h.get('cf-ipcountry'),
      ts: new Date().toISOString(),
    });
  }

  return next();
});
