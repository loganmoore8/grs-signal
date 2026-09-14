resource "aws_sns_topic" "operations" {
  name = "${var.name}-operations"
}
resource "aws_sns_topic_subscription" "operations" {
  for_each  = toset(var.alert_recipients)
  topic_arn = aws_sns_topic.operations.arn
  protocol  = "email"
  endpoint  = each.value
}
