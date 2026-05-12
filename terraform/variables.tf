variable "aws_region" {
  description = "AWS region for infrastructure."
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Elastic Beanstalk application name."
  type        = string
  default     = "budgetbuddy-app"
}

variable "environment_name" {
  description = "Elastic Beanstalk environment name."
  type        = string
  default     = "budgetbuddy-environment"
}

variable "cname_prefix" {
  description = "Unique CNAME prefix for the environment URL."
  type        = string
  default     = "budgetbuddy-bkart"
}

variable "instance_profile_name" {
  description = "IAM instance profile for Elastic Beanstalk EC2 instances."
  type        = string
  default     = "aws-elasticbeanstalk-ec2-role"
}

variable "supabase_url" {
  description = "Runtime SUPABASE_URL for the app."
  type        = string
  sensitive   = true
  default     = ""
}

variable "supabase_anon_key" {
  description = "Runtime SUPABASE_ANON_KEY for the app."
  type        = string
  sensitive   = true
  default     = ""
}

variable "database_url" {
  description = "Runtime DATABASE_URL for the app."
  type        = string
  sensitive   = true
  default     = ""
}
