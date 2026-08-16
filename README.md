# perfil.dalyko.com

Sitio profesional de **Eloy R. Becerra Daly**. Astro 7 con renderizado en
servidor, empaquetado en contenedor y desplegado en Google Cloud Run dentro de
la misma infraestructura que el resto de la plataforma Dalyko.

No es una plantilla: cada decisión de este repositorio está tomada a propósito y
explicada aquí. Ese es, de hecho, el objetivo del proyecto.

---

## Decisiones de arquitectura

### Por qué Astro, y por qué en servidor

Astro envía **cero JavaScript por defecto**: el HTML se genera en el servidor y
solo se hidrata lo que se marca explícitamente como isla. Para un sitio cuyo
contenido es texto y datos, ese es el mejor punto de partida posible en
rendimiento y accesibilidad.

Se usa `output: 'server'` (SSR) en lugar de generación estática por dos motivos:

1. **Atribución por destinatario en tiempo de petición.** El parámetro `?ref=` se
   lee en el servidor para registrar qué organización consulta el perfil, sin
   ejecutar nada en el navegador ni almacenar nada en él.
2. **HTML en streaming.** El adaptador de Node emite la respuesta por partes, de
   modo que el navegador empieza a pintar antes de que termine el render.

Las rutas que no necesiten servidor pueden marcarse con
`export const prerender = true` sin cambiar nada más: la decisión es por ruta, no
global.

### Por qué contenido tipado

Los proyectos viven en `src/content/proyectos/*.md` bajo una **colección con
esquema Zod** (`src/content.config.ts`). El frontmatter se valida en tiempo de
compilación: un campo mal escrito **rompe el build**, no la página en producción.
Es la diferencia entre descubrir un error en CI y descubrirlo en un cliente.

### Por qué esta analítica y no otra

En lo técnico:

- **Sin cookies y sin almacenamiento en el navegador.** No se accede a
  información del terminal, así que no procede banner de consentimiento.
- **La IP nunca se almacena.** Se usa en memoria para derivar
  `SHA-256(sal_diaria + ip + user-agent)` truncado a 16 caracteres. La **sal rota
  cada día**, de modo que el identificador es irreversible y no permite seguir a
  nadie entre días ni entre sitios.
- **La unidad de análisis es la visita y la organización**, nunca la persona. La
  atribución se hace con `?ref=`, que se propaga por la navegación mediante los
  propios enlaces: no se persiste en el cliente.
- **Los eventos se emiten como JSON estructurado a stdout**, que Cloud Run
  entrega a Cloud Logging sin infraestructura adicional y desde ahí se exporta a
  BigQuery. `ANALYTICS_WEBHOOK` permite además reenviarlos al backend propio.
- La analítica **nunca puede tumbar una petición**: el registro no se espera y el
  reenvío tiene *timeout* y captura de errores.

El diseño responde a una idea concreta: se puede medir con rigor sin construir
perfiles de personas. Medir la organización que lee, no al individuo que mira.

### Por qué este contenedor

`Dockerfile` multi-stage con tres etapas (`deps`, `build`, `runtime`):

- La imagen final **no contiene dependencias de compilación** ni el código fuente.
- Se ejecuta con **usuario sin privilegios** (UID 10001), no como root.
- `PORT` lo inyecta Cloud Run; el proceso escucha en `0.0.0.0`.
- Propagación limpia de `SIGTERM` para que Cloud Run drene conexiones al escalar.

---

## Estructura

```
src/
├── content/proyectos/     Proyectos en Markdown, validados por esquema
├── content.config.ts      Esquema Zod de la colección
├── layouts/Base.astro     Shell HTML: SEO, Open Graph, JSON-LD, baliza
├── lib/analitica.ts       Derivación del id de visita y emisión de eventos
├── middleware.ts          Registro de vista por petición (servidor)
├── pages/
│   ├── api/evento.ts      Baliza de interacción (sendBeacon)
│   └── ...                Rutas del sitio
└── styles/tokens.css      Sistema de diseño: tokens, sin dependencias
```

## SEO técnico

Canonical por página · Open Graph · **JSON-LD `Person`** enlazando el ORCID como
identificador verificable · `sitemap-index.xml` generado en el build ·
`robots.txt` · HTML semántico y `aria-current` en la navegación.

## Desarrollo

```bash
npm install
npm run dev                     # http://localhost:4321
npm run build                   # compila a dist/
node ./dist/server/entry.mjs    # sirve la build, igual que en producción
```

Variables de entorno en `.env.example`. En producción `ANALYTICS_SALT` se
resuelve desde Secret Manager.

## Despliegue

Contenedor a **Cloud Run** (proyecto `dalyko-2026`, región `europe-west1`),
publicado en `perfil.dalyko.com` a través del balanceador HTTPS existente.
Ver [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md).

## Licencia

Código bajo licencia MIT. El contenido (textos, proyectos y CV) es propiedad del
autor y no se licencia para reutilización.
