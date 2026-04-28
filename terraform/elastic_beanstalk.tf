resource "aws_elastic_beanstalk_application" "application" {
    name = "budgetbuddy"  
}

resource "aws_elastic_beanstalk_environment" "environment" {
  name                = "budgetbuddy-environment"
  cname_prefix        = "zakariac22"
  application         = aws_elastic_beanstalk_application.application.name
  solution_stack_name = "64bit Amazon Linux 2023 v6.10.1 running Node.js 20"

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "IamInstanceProfile"
    value     = "aws-elasticbeanstalk-ec2-role"
  }
}