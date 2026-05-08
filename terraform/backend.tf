terraform {
  backend "s3" {
    bucket = "terraform-state-budgetbuddy-b-karthikeya-reddy"
    key    = "budgetbuddy/terraform.tfstate"
    region = "us-east-1"
  }
}
