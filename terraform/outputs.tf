output "cloud_run_url" {
  description = "The deployed Cloud Run service URL"
  value       = google_cloud_run_v2_service.app.uri
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository name"
  value       = google_artifact_registry_repository.app_repo.repository_id
}
