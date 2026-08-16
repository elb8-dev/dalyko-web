// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Dominio canónico: alimenta sitemap, canonical y Open Graph.
  site: 'https://perfil.dalyko.com',

  // SSR bajo demanda por defecto. Cada ruta puede optar por prerender
  // (`export const prerender = true`) cuando no necesite servidor.
  output: 'server',

  adapter: node({ mode: 'standalone' }),

  integrations: [sitemap()],

  // El adaptador de Node emite HTML en streaming: el navegador empieza a
  // pintar antes de que termine el render del servidor.
  build: { inlineStylesheets: 'auto' },

  server: {
    // Cloud Run inyecta PORT; escuchar en 0.0.0.0 es obligatorio en contenedor.
    host: true,
    port: Number(process.env.PORT ?? 4321),
  },

  vite: {
    build: { sourcemap: false },
  },
});
