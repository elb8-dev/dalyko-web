import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Colección de proyectos: el esquema valida el frontmatter en tiempo de build.
 * Un campo mal escrito rompe la compilación, no la página en producción.
 */
const proyectos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/proyectos' }),
  schema: z.object({
    titulo: z.string(),
    resumen: z.string(),
    organizacion: z.string(),
    periodo: z.string(),
    orden: z.number().default(99),
    destacado: z.boolean().default(false),
    privado: z.boolean().default(false),
    stack: z.array(z.string()).default([]),
    metricas: z.array(z.object({ valor: z.string(), etiqueta: z.string() })).default([]),
  }),
});

export const collections = { proyectos };
