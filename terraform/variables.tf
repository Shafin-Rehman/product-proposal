variable "project_id" {
  description = "Google Cloud project ID"
  type        = string
}

variable "region" {
  description = "Google Cloud region"
  type        = string
  default     = "us-east1"
}

variable "service_name" {
  description = "Cloud Run service name"
  type        = string
  default     = "budgetbuddy"
}

variable "artifact_repo" {
  description = "Artifact Registry repository name"
  type        = string
  default     = "budgetbuddy-repo"
}

variable "image_name" {
  description = "Docker image name"
  type        = string
  default     = "budgetbuddy"
}

variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
  sensitive   = true
}

variable "supabase_anon_key" {
  description = "Supabase anonymous key"
  type        = string
  sensitive   = true
}

variable "database_url" {
  description = "Postgres database connection string"
  type        = string
  sensitive   = true
}
