resource "aws_elastic_beanstalk_application" "app" {
  name        = var.app_name
  description = "BudgetBuddy application"
}

resource "aws_elastic_beanstalk_environment" "app_env" {
  name                = var.environment_name
  application         = aws_elastic_beanstalk_application.app.name
  solution_stack_name = "64bit Amazon Linux 2023 v6.1.5 running Node.js 20"
  cname_prefix        = var.cname_prefix

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "IamInstanceProfile"
    value     = var.instance_profile_name
  }

  setting {
    namespace = "aws:elasticbeanstalk:container:nodejs"
    name      = "NodeCommand"
    value     = "npm start"
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "SUPABASE_URL"
    value     = var.supabase_url
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "SUPABASE_ANON_KEY"
    value     = var.supabase_anon_key
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "DATABASE_URL"
    value     = var.database_url
  }
}
