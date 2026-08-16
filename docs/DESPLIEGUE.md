# Despliegue — `perfil.dalyko.com`

**Proyecto:** `dalyko-2026` · **Región:** `europe-southwest1` (Madrid)
**Servicio Cloud Run:** `perfil-web` · **Dominio:** `perfil.dalyko.com`

---

## Decisión: servicio propio detrás del balanceador existente

La plataforma Dalyko es un **monolito modular** (`lumora-backend`, Fastify de
proceso único) por razones documentadas en `DalyKo/docs/Arquitectura Monolitica.md`:
coherencia transaccional con un solo `pg.Pool`, auditoría unificada con
*hash-chain* en `audit_log` y cold-start económico.

**Esas razones no aplican a este sitio**, que no escribe en la base de datos, no
participa en transacciones y no genera entradas de auditoría. Por tanto:

> El perfil se despliega como **servicio de Cloud Run independiente** (`perfil-web`)
> en el **mismo proyecto y región**, y se publica a través del **balanceador HTTPS
> ya existente** mediante una regla de host para `perfil.dalyko.com`.

Con ello se obtiene lo mejor de ambas opciones:

| | |
|---|---|
| **Misma infraestructura** | Mismo proyecto, misma región, mismo balanceador, misma observabilidad (Cloud Logging) y mismo Artifact Registry |
| **Despliegues independientes** | Publicar el perfil no puede tumbar el backend, ni al revés |
| **Runtimes separados** | Astro corre sobre Node; no hay que forzarlo dentro de Fastify |
| **Coste marginal** | `min-instances=0`: sin tráfico, no cuesta nada |

---

## 1. Requisitos previos (una sola vez)

```bash
gcloud auth login
gcloud config set project dalyko-2026

# Repositorio de imágenes (reutiliza el existente si ya lo hay)
gcloud artifacts repositories create dalyko \
  --repository-format=docker --location=europe-southwest1 \
  --description="Imágenes de la plataforma Dalyko"

# Secreto de la analítica
openssl rand -hex 32 | gcloud secrets create perfil-analytics-salt --data-file=-
```

## 2. Construir y desplegar

```bash
gcloud run deploy perfil-web \
  --source . \
  --project=dalyko-2026 \
  --region=europe-southwest1 \
  --allow-unauthenticated \
  --port=8080 \
  --cpu=1 --memory=512Mi \
  --min-instances=0 --max-instances=5 \
  --set-env-vars=NODE_ENV=production,PUBLIC_SITE_URL=https://perfil.dalyko.com,ANALYTICS_ENABLED=true \
  --set-secrets=ANALYTICS_SALT=perfil-analytics-salt:latest
```

> `--source .` usa el `Dockerfile` del repositorio a través de Cloud Build. Para
> construir en local: `gcloud builds submit --tag europe-southwest1-docker.pkg.dev/dalyko-2026/dalyko/perfil-web`.

## 3. Publicar en el balanceador existente

```bash
# NEG sin servidor que apunta al servicio
gcloud compute network-endpoint-groups create perfil-web-neg \
  --region=europe-southwest1 --network-endpoint-type=serverless \
  --cloud-run-service=perfil-web

# Servicio de backend
gcloud compute backend-services create perfil-web-bs \
  --global --load-balancing-scheme=EXTERNAL_MANAGED
gcloud compute backend-services add-backend perfil-web-bs \
  --global --network-endpoint-group=perfil-web-neg \
  --network-endpoint-group-region=europe-southwest1

# Regla de host en el url-map existente (sustituir <URL_MAP> por el real)
gcloud compute url-maps add-path-matcher <URL_MAP> \
  --path-matcher-name=perfil --default-service=perfil-web-bs \
  --new-hosts=perfil.dalyko.com
```

Añadir `perfil.dalyko.com` al certificado gestionado y crear el registro **A**
del DNS apuntando a la IP del balanceador.

**Alternativa más simple** (sin tocar el balanceador), si se prefiere:

```bash
gcloud beta run domain-mappings create --service=perfil-web \
  --domain=perfil.dalyko.com --region=europe-southwest1
```

## 4. Verificación

```bash
curl -I https://perfil.dalyko.com                      # 200 y cabeceras
curl -s https://perfil.dalyko.com/sitemap-index.xml    # sitemap
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

Para informes recurrentes, crear un *sink* de Cloud Logging hacia BigQuery y
consultar por `ref`, `ruta`, `segundos` y `scrollMax`.

---

## Despliegue continuo (opcional)

`.github/workflows/deploy.yml` publica automáticamente al hacer *push* a `main`,
autenticándose con **Workload Identity Federation** (sin claves de servicio en el
repositorio). Requiere configurar en GitHub los secretos `GCP_WIF_PROVIDER` y
`GCP_SERVICE_ACCOUNT`.
