#!/bin/bash
# EasyMo AI - GCP Setup
set -e

PROJECT_ID="easymo-478117"
REGION="us-central1"

echo "🚀 EasyMo AI Setup"
gcloud config set project $PROJECT_ID

gcloud services enable run.googleapis.com firestore.googleapis.com \
  bigquery.googleapis.com secretmanager.googleapis.com \
  cloudbuild.googleapis.com aiplatform.googleapis.com

cd terraform && terraform init && terraform apply -auto-approve
echo "✅ Done"
