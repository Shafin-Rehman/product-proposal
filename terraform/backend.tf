terraform {
  backend "gcs" {
    bucket = "budgetbuddy-terraform-state-shafinrehman"
    prefix = "terraform/state"
  }
}
