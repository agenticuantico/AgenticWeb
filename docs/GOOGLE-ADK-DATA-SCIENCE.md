# Google ADK Data Science Agent

AgentiCuantico ahora incluye el agente de Google Agent Development Kit (ADK) del codelab de Google para Agent Engine, adaptado al sitio AgenticWeb.

## Arquitectura

AgentiCuantico Web -> Cloudflare Worker -> Google Agent Engine -> ADK -> BigQuery + Memory Bank + Gemini

El agente fuente está en `data_science_agent/`.

## Desplegar el agente

Desde Google Cloud Shell:

    export GOOGLE_CLOUD_PROJECT="TU_PROYECTO"
    export GOOGLE_CLOUD_LOCATION="us-central1"
    gcloud services enable aiplatform.googleapis.com bigquery.googleapis.com telemetry.googleapis.com --project="$GOOGLE_CLOUD_PROJECT"
    python -m venv .venv
    source .venv/bin/activate
    pip install --upgrade "google-adk>=1.26.0" google-auth
    adk deploy agent_engine --project="$GOOGLE_CLOUD_PROJECT" --region="$GOOGLE_CLOUD_LOCATION" --display_name="AgentiCuantico Data Science Agent" --trace_to_cloud --otel_to_cloud data_science_agent

Después otorgá a la cuenta de servicio administrada por Agent Engine los permisos de BigQuery indicados por Google:

    PROJECT_NUMBER=$(gcloud projects describe "$GOOGLE_CLOUD_PROJECT" --format='value(projectNumber)')
    SA="service-${PROJECT_NUMBER}@gcp-sa-aiplatform-re.iam.gserviceaccount.com"
    gcloud projects add-iam-policy-binding "$GOOGLE_CLOUD_PROJECT" --member="serviceAccount:${SA}" --role="roles/bigquery.jobUser"
    gcloud projects add-iam-policy-binding "$GOOGLE_CLOUD_PROJECT" --member="serviceAccount:${SA}" --role="roles/bigquery.dataViewer"

## Conectar el sitio

El Worker tiene el endpoint:

    POST /v1/public/adk/data-science

Configurá como Worker Secrets, nunca en GitHub:

- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_CLOUD_LOCATION`
- `GOOGLE_AGENT_ENGINE_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON`

El último secreto contiene el JSON de una cuenta de servicio que puede invocar Agent Engine. Esa cuenta necesita permiso para consultar el Reasoning Engine (por ejemplo, `roles/aiplatform.user` a nivel de proyecto, o permisos equivalentes). El Worker crea un access token OAuth de corta duración y el navegador nunca recibe la credencial.

Como alternativa temporal se puede configurar `GOOGLE_AGENT_ENGINE_TOKEN`, aunque para producción se recomienda la cuenta de servicio.

## Uso en AgenticWeb

El agente aparece como **Data Science** en el selector de agentes y en Herramientas. Cuando está seleccionado, el chat envía la consulta directamente al Agent Engine.

El usuario puede preguntar, por ejemplo:

    Analizá las ventas de 2026 por provincia y decime qué regiones concentran más facturación.

El ADK utiliza `BigQueryToolset` para explorar esquemas y ejecutar SQL, y `PreloadMemoryTool` + `after_agent_callback` para Memory Bank cuando se ejecuta en Agent Engine.

## Seguridad

No se versionan `.env` ni credenciales. El ejemplo de variables está en `data_science_agent/.env.example`. Para producción se mantiene `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=false` salvo que exista una política explícita de registro de contenido.

## Referencias

- Google Codelab: https://codelabs.developers.google.com/next26/adk-deploy-scale?hl=es-419
- Google Agent Platform: uso de agentes ADK y `async_stream_query`.
