#!/usr/bin/env bash

# Arresta lo script in caso di errori
set -e

# Configurazione iniziale
PROJECT_ID="albo-monitor-bedollo"
REGION="europe-west8" # Milano

echo "=========================================================="
echo "🚀 Avvio della procedura di Deploy su Google Cloud Platform"
echo "=========================================================="
echo "Progetto GCP: $PROJECT_ID"
echo "Regione: $REGION"
echo "=========================================================="

# Imposta il progetto attivo in gcloud
gcloud config set project "$PROJECT_ID"

echo "🔔 1. Abilitazione delle API di Google Cloud..."
gcloud services enable \
  compute.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  cloudscheduler.googleapis.com \
  aiplatform.googleapis.com

echo "✅ API abilitate correttamente!"

# 2. Verifica dell'esistenza di .env.local
if [ ! -f ".env.local" ]; then
  echo "❌ ERRORE: Il file .env.local non è presente nella cartella corrente."
  echo "Per favore, carica il file .env.local tramite il menu in alto di Cloud Shell e riprova."
  exit 1
fi

echo "📖 3. Analisi del file .env.local..."

# Funzione per pulire apici dalle variabili
clean_value() {
  echo "$1" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

# Estrazione variabili da .env.local
NEXT_PUBLIC_SUPABASE_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" .env.local | cut -d'=' -f2- | tr -d '\r')
NEXT_PUBLIC_SUPABASE_ANON_KEY=$(grep "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" .env.local | cut -d'=' -f2- | tr -d '\r')
SUPABASE_SERVICE_ROLE_KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" .env.local | cut -d'=' -f2- | tr -d '\r')
GMAIL_USER=$(grep "^GMAIL_USER=" .env.local | cut -d'=' -f2- | tr -d '\r')
GMAIL_APP_PASSWORD=$(grep "^GMAIL_APP_PASSWORD=" .env.local | cut -d'=' -f2- | tr -d '\r')
CRON_SECRET=$(grep "^CRON_SECRET=" .env.local | cut -d'=' -f2- | tr -d '\r')

# Pulisce i valori estratti
NEXT_PUBLIC_SUPABASE_URL=$(clean_value "$NEXT_PUBLIC_SUPABASE_URL")
NEXT_PUBLIC_SUPABASE_ANON_KEY=$(clean_value "$NEXT_PUBLIC_SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY=$(clean_value "$SUPABASE_SERVICE_ROLE_KEY")
GMAIL_USER=$(clean_value "$GMAIL_USER")
GMAIL_APP_PASSWORD=$(clean_value "$GMAIL_APP_PASSWORD")
CRON_SECRET=$(clean_value "$CRON_SECRET")

if [ -z "$CRON_SECRET" ]; then
  echo "🔑 CRON_SECRET non trovato. Genero un token casuale..."
  CRON_SECRET=$(openssl rand -hex 24)
fi

echo "✅ Valori del database e di Gmail letti con successo."

# Funzione per creare o aggiornare un segreto in Secret Manager
create_or_update_secret() {
  local name=$1
  local val=$2
  if gcloud secrets describe "$name" >/dev/null 2>&1; then
    echo "🔄 Aggiornamento segreto $name..."
    echo -n "$val" | gcloud secrets versions add "$name" --data-file=- >/dev/null
  else
    echo "➕ Creazione segreto $name..."
    echo -n "$val" | gcloud secrets create "$name" --data-file=- --replication-policy="automatic" >/dev/null
  fi
}

echo "🔐 4. Salvataggio delle chiavi in Secret Manager..."
create_or_update_secret "NEXT_PUBLIC_SUPABASE_URL" "$NEXT_PUBLIC_SUPABASE_URL"
create_or_update_secret "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$NEXT_PUBLIC_SUPABASE_ANON_KEY"
create_or_update_secret "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"
create_or_update_secret "GMAIL_USER" "$GMAIL_USER"
create_or_update_secret "GMAIL_APP_PASSWORD" "$GMAIL_APP_PASSWORD"
create_or_update_secret "CRON_SECRET" "$CRON_SECRET"

# Creiamo un placeholder per il BASE_URL (verrà aggiornato dopo il deploy di Cloud Run)
create_or_update_secret "NEXT_PUBLIC_BASE_URL" "https://change-me-after-deploy.run.app"

echo "✅ Segreti configurati in Secret Manager!"

# 5. Creazione Repository in Artifact Registry
echo "📦 5. Configurazione di Artifact Registry..."
if ! gcloud artifacts repositories describe albomonitor --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create albomonitor \
    --repository-format=docker \
    --location="$REGION" \
    --description="Repository Docker per AlboMonitor" >/dev/null
  echo "✅ Repository creato!"
else
  echo "ℹ️ Repository albomonitor già esistente."
fi

# 6. Compilazione immagine su Cloud Build
echo "🏗️ 6. Compilazione dell'immagine Docker su Cloud Build (operazione remota, attendere)..."
gcloud builds submit --tag "$REGION-docker.pkg.dev/$PROJECT_ID/albomonitor/app:latest"

# 7. Assegnazione permessi al Service Account
echo "👥 7. Configurazione dei permessi per il Service Account di Cloud Run..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SERVICE_ACCOUNT="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

echo "Assegnazione ruolo Secret Manager Accessor..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor" >/dev/null

echo "Assegnazione ruolo Vertex AI User (per Gemini)..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/aiplatform.user" >/dev/null

echo "✅ Permessi configurati!"

# 8. Deploy temporaneo su Cloud Run
echo "⛵ 8. Primo deploy su Google Cloud Run..."
gcloud run deploy albomonitor \
  --image "$REGION-docker.pkg.dev/$PROJECT_ID/albomonitor/app:latest" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=$REGION" \
  --set-secrets="NEXT_PUBLIC_SUPABASE_URL=NEXT_PUBLIC_SUPABASE_URL:latest,NEXT_PUBLIC_SUPABASE_ANON_KEY=NEXT_PUBLIC_SUPABASE_ANON_KEY:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,GMAIL_USER=GMAIL_USER:latest,GMAIL_APP_PASSWORD=GMAIL_APP_PASSWORD:latest,CRON_SECRET=CRON_SECRET:latest,NEXT_PUBLIC_BASE_URL=NEXT_PUBLIC_BASE_URL:latest"

# 9. Recupero URL di Cloud Run e aggiornamento del BASE_URL
echo "🔗 9. Recupero dell'URL pubblico generato..."
RUN_URL=$(gcloud run services describe albomonitor --region "$REGION" --format='value(status.url)')

echo "URL dell'app: $RUN_URL"
echo "Aggiornamento del BASE_URL con il valore definitivo in Secret Manager..."
create_or_update_secret "NEXT_PUBLIC_BASE_URL" "$RUN_URL"

# Forza il caricamento del nuovo segreto su Cloud Run aggiornando il servizio
echo "🔄 Sincronizzazione dell'URL definitivo su Cloud Run..."
gcloud run services update albomonitor \
  --region "$REGION" \
  --update-secrets="NEXT_PUBLIC_BASE_URL=NEXT_PUBLIC_BASE_URL:latest"

# 10. Configurazione del Cron Job con Cloud Scheduler
echo "⏰ 10. Configurazione di Cloud Scheduler per lo scraping automatico..."

SCHEDULER_REGION="$REGION"
if [ "$REGION" = "europe-west8" ]; then
  # La regione di Milano (europe-west8) non supporta ancora Cloud Scheduler, quindi usiamo europe-west1 (Belgio)
  SCHEDULER_REGION="europe-west1"
  echo "ℹ️ La regione di Milano (europe-west8) non supporta Cloud Scheduler. Il cron job verrà creato in $SCHEDULER_REGION (Belgio) e chiamerà l'app a Milano."
fi

# Verifichiamo se il job esiste già
if gcloud scheduler jobs describe scraper-job --location="$SCHEDULER_REGION" >/dev/null 2>&1; then
  echo "Aggiornamento del job scraper-job esistente in $SCHEDULER_REGION..."
  gcloud scheduler jobs update http scraper-job \
    --schedule="0 8,12,16,20 * * 1-6" \
    --uri="$RUN_URL/api/test-scrape?max=10" \
    --http-method=GET \
    --headers="Authorization=Bearer $CRON_SECRET" \
    --time-zone="Europe/Rome" \
    --location="$SCHEDULER_REGION" >/dev/null
else
  echo "Creazione del nuovo job scraper-job in $SCHEDULER_REGION..."
  gcloud scheduler jobs create http scraper-job \
    --schedule="0 8,12,16,20 * * 1-6" \
    --uri="$RUN_URL/api/test-scrape?max=10" \
    --http-method=GET \
    --headers="Authorization=Bearer $CRON_SECRET" \
    --time-zone="Europe/Rome" \
    --location="$SCHEDULER_REGION" >/dev/null
fi

echo "=========================================================="
echo "🎉 DEPLOY COMPLETATO CON SUCCESSO!"
echo "=========================================================="
echo "📍 Link dell'app: $RUN_URL"
echo "⏰ Cronjob schedulato alle ore 8:00, 12:00, 16:00, 20:00 (Lun-Sab, fuso orario di Roma)"
echo "🔑 Token CRON_SECRET generato: $CRON_SECRET"
echo "=========================================================="
