resource "google_artifact_registry_repository" "app_repo" {
  location      = var.region
  repository_id = var.artifact_repo
  description   = "Docker repository for BudgetBuddy"
  format        = "DOCKER"
}

resource "google_cloud_run_v2_service" "app" {
  name     = var.service_name
  location = var.region

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_repo}/${var.image_name}:latest"

      ports {
        container_port = 8080
      }

      env {
        name  = "SUPABASE_URL"
        value = var.supabase_url
      }

      env {
        name  = "SUPABASE_ANON_KEY"
        value = var.supabase_anon_key
      }

      env {
        name  = "DATABASE_URL"
        value = var.database_url
      }
    }
  }

  depends_on = [
    google_artifact_registry_repository.app_repo
  ]
}

resource "google_cloud_run_v2_service_iam_member" "public_access" {
  location = google_cloud_run_v2_service.app.location
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
