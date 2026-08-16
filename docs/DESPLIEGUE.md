# Despliegue — `perfil.dalyko.com`

**Proyecto:** `dalyko-2026` · **Región:** `europe-west1`
**Servicio Cloud Run:** `perfil-web` · **URL directa:** https://perfil-web-476507278172.europe-west1.run.app

---

## Decisión: servicio propio en la región de los mapeos de dominio

La plataforma es un **monolito modular** (`lumora-backend`, Fastify de proceso
único) por razones documentadas en `DalyKo/docs/Arquitectura Monolitica.md`:
coherencia transaccional con un solo `pg.Pool`, auditoría unificada con
*hash-chain* en `audit_log` y cold-start económico.

**Esas razones no aplican a este sitio**, que no escribe en base de datos, no
participa en transacciones y no genera auditoría. Se despliega, por tanto, como
**servicio independiente** dentro del mismo proyecto.

La región es **`europe-west1`** y no `europe-southwest1` por un motivo concreto:
los ***domain mappings* de Cloud Run no están disponibles en `europe-southwest1`**.
El resto de dominios de la plataforma (`admin.dalyko.com`, `api.dalyko.com`,
`lumoraip.com`, `portal.quickconvey.es`) están mapeados en `europe-west1`, de
modo que el perfil sigue exactamente el mismo patrón ya probado.

> Nota: no existe balanceador HTTPS en el proyecto — la Compute Engine API está
> deshabilitada. La publicación se hace con *domain mappings* nativos de Cloud
> Run, que resuelven certificado y TLS automáticamente.

---

## 1. Secreto de la analítica (una sola vez)

```bash
openssl rand -hex 32 | gcloud secrets create perfil-analytics-salt \
  --data-file=- --project=dalyko-2026

gcloud secrets add-iam-policy-binding perfil-analytics-salt \
  --member="serviceAccount:476507278172-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" --project=dalyko-2026
```

## 2. Desplegar

```bash
gcloud run deploy perfil-web \
  --source . \
  --project=dalyko-2026 \
  --region=europe-west1 \
  --allow-unauthenticated \
  --port=8080 --cpu=1 --memory=512Mi \
  --min-instances=0 --max-instances=5 \
  --set-env-vars=NODE_ENV=production,PUBLIC_SITE_URL=https://perfil.dalyko.com,ANALYTICS_ENABLED=true \
  --set-secrets=ANALYTICS_SALT=perfil-analytics-salt:latest
```

`--source .` construye con Cloud Build a partir del `Dockerfile`. El
`.gcloudignore` evita subir `node_modules` y `dist`.

## 3. Publicar en `perfil.dalyko.com`

**Requisito previo — verificar el dominio.** La cuenta debe tener `dalyko.com`
verificado en Google Search Console:

```bash
gcloud domains verify dalyko.com   # abre Search Console en el navegador
```

Una vez verificado:

```bash
gcloud beta run domain-mappings create \
  --service=perfil-web --domain=perfil.dalyko.com \
  --project=dalyko-2026 --region=europe-west1
```

El comando devuelve el registro DNS a crear. Para un subdominio es un **CNAME**:

| Tipo | Nombre | Valor |
|------|--------|-------|
| CNAME | `perfil` | `ghs.googlehosted.com.` |

El DNS de `dalyko.com` se gestiona en **GoDaddy** (`ns01/ns02.domaincontrol.com`).

> ⚠️ **No tocar los registros MX.** `dalyko.com` tiene correo en Google Workspace
> (`MX → smtp.google.com`). Añadir un CNAME de subdominio no los afecta, pero
> cualquier cambio de servidores de nombres sí rompería el correo.

## 4. Verificación

```bash
curl -I https://perfil.dalyko.com
curl -s https://perfil.dalyko.com/sitemap-index.xml
curl -s "https://perfil.dalyko.com/?ref=prueba" | grep -o '<title>[^<]*'
```

## 5. Consultar la analítica

Los eventos se emiten como JSON estructurado y Cloud Logging los indexa solos.

```bash
# Todo lo leído por una organización concreta
gcloud logging read \
  'resource.labels.service_name="perfil-web" AND jsonPayload.message="analitica" AND jsonPayload.ref="enfaf"' \
  --project=dalyko-2026 --limit=50 --format=json
```

Para informes recurrentes, crear un *sink* hacia BigQuery y consultar por `ref`,
`ruta`, `segundos` y `scrollMax`.

---

## Despliegue continuo

`.github/workflows/deploy.yml` publica al hacer *push* a `main`, autenticándose
con **Workload Identity Federation** (sin claves de servicio en el repositorio).
Requiere las variables `GCP_WIF_PROVIDER` y `GCP_SERVICE_ACCOUNT` en GitHub.
