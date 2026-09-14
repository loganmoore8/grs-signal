resource "aws_iam_role" "scheduler" {
  name               = "${var.name}-scheduler"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "scheduler.amazonaws.com" } }] })
}
resource "aws_iam_role_policy" "scheduler" {
  role   = aws_iam_role.scheduler.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = "lambda:InvokeFunction", Resource = aws_lambda_function.functions["research"].arn }] })
}
resource "aws_scheduler_schedule" "research" {
  for_each                     = { start = "cron(0 6 * * ? *)", tick = "rate(5 minutes)" }
  name                         = "${var.name}-${each.key}"
  schedule_expression          = each.value
  schedule_expression_timezone = "America/Los_Angeles"
  state                        = var.schedules_enabled ? "ENABLED" : "DISABLED"
  flexible_time_window { mode = "OFF" }
  target {
    arn      = aws_lambda_function.functions["research"].arn
    role_arn = aws_iam_role.scheduler.arn
    input    = jsonencode({ action = each.key })
    retry_policy {
      maximum_retry_attempts       = 2
      maximum_event_age_in_seconds = 3600
    }
  }
}
resource "aws_ses_email_identity" "sender" { email = var.alert_sender }
resource "aws_budgets_budget" "monthly" {
  name         = "${var.name}-aws-monthly"
  budget_type  = "COST"
  limit_amount = "15"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  cost_filter {
    name   = "TagKeyValue"
    values = ["Project$grs-signal"]
  }
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.alert_recipients
  }
}
resource "aws_cloudwatch_metric_alarm" "worker_errors" {
  alarm_actions       = [aws_sns_topic.operations.arn]
  ok_actions          = [aws_sns_topic.operations.arn]
  alarm_name          = "${var.name}-worker-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 3600
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  dimensions          = { FunctionName = aws_lambda_function.functions["research"].function_name }
}
