terraform {
  required_version = ">= 1.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "easymo-478117"
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "run.googleapis.com",
    "firestore.googleapis.com",
    "bigquery.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudbuild.googleapis.com",
    "aiplatform.googleapis.com",
    "dialogflow.googleapis.com",
    "artifactregistry.googleapis.com"
  ])
  
  service            = each.key
  disable_on_destroy = false
}

# Firestore Database
resource "google_firestore_database" "easymo_db" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"
  
  depends_on = [google_project_service.required_apis]
}

# BigQuery Dataset for Analytics
resource "google_bigquery_dataset" "easymo_analytics" {
  dataset_id  = "easymo_analytics"
  location    = var.region
  description = "EasyMo AI Agent Analytics Data"
  
  labels = {
    environment = "production"
    service     = "easymo"
  }
  
  depends_on = [google_project_service.required_apis]
}

# BigQuery Table: Cold Call Logs
resource "google_bigquery_table" "cold_call_logs" {
  dataset_id = google_bigquery_dataset.easymo_analytics.dataset_id
  table_id   = "cold_call_logs"
  
  schema = jsonencode([
    {
      name = "call_id"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "session_id"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "customer_phone"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "start_time"
      type = "TIMESTAMP"
      mode = "REQUIRED"
    },
    {
      name = "end_time"
      type = "TIMESTAMP"
      mode = "NULLABLE"
    },
    {
      name = "duration_seconds"
      type = "INTEGER"
      mode = "NULLABLE"
    },
    {
      name = "status"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "outcome"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "bant_score"
      type = "INTEGER"
      mode = "NULLABLE"
    },
    {
      name = "lead_created"
      type = "BOOLEAN"
      mode = "NULLABLE"
    },
    {
      name = "channel"
      type = "STRING"
      mode = "NULLABLE"
    }
  ])
  
  time_partitioning {
    type  = "DAY"
    field = "start_time"
  }
}

# Secret Manager Secrets
resource "google_secret_manager_secret" "openai_api_key" {
  secret_id = "openai_api_key"
  
  replication {
    auto {}
  }
  
  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret" "whatsapp_api_key" {
  secret_id = "whatsapp_api_key"
  
  replication {
    auto {}
  }
  
  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret" "google_maps_api_key" {
  secret_id = "google-maps-api-key"
  
  replication {
    auto {}
  }
  
  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret" "mtn_sip_creds" {
  secret_id = "mtn_sip_creds"
  
  replication {
    auto {}
  }
  
  depends_on = [google_project_service.required_apis]
}

# Service Account for Cloud Run services
resource "google_service_account" "easymo_runner" {
  account_id   = "easymo-runner"
  display_name = "EasyMo Cloud Run Service Account"
  description  = "Service account for EasyMo Cloud Run services"
}

# Grant Firestore permissions
resource "google_project_iam_member" "firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.easymo_runner.email}"
}

# Grant BigQuery permissions
resource "google_project_iam_member" "bigquery_user" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.easymo_runner.email}"
}

# Grant Secret Manager permissions
resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.easymo_runner.email}"
}

# Grant Vertex AI permissions
resource "google_project_iam_member" "vertex_ai_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.easymo_runner.email}"
}

# Artifact Registry Repository for Docker images
resource "google_artifact_registry_repository" "easymo_repo" {
  location      = var.region
  repository_id = "easymo-services"
  description   = "Docker repository for EasyMo services"
  format        = "DOCKER"
  
  depends_on = [google_project_service.required_apis]
}

# Outputs
output "project_id" {
  value       = var.project_id
  description = "GCP Project ID"
}

output "region" {
  value       = var.region
  description = "GCP Region"
}

output "firestore_database" {
  value       = google_firestore_database.easymo_db.name
  description = "Firestore Database Name"
}

output "bigquery_dataset" {
  value       = google_bigquery_dataset.easymo_analytics.dataset_id
  description = "BigQuery Dataset ID"
}

output "service_account_email" {
  value       = google_service_account.easymo_runner.email
  description = "Service Account Email"
}

output "artifact_registry_repo" {
  value       = google_artifact_registry_repository.easymo_repo.name
  description = "Artifact Registry Repository"
}
