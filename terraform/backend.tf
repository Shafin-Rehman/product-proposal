terraform {
  backend "s3" {
    bucket = "terraform-state-budgetbuddy-zakariac22"
    key    = "core/terraform.tfstate"
    region = "us-east-1"
  }
} 