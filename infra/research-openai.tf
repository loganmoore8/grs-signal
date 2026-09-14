resource "aws_secretsmanager_secret" "openai" {
  name                    = "${var.name}/openai"
  description             = "GRS Signal OpenAI API credential; value managed outside Terraform"
  recovery_window_in_days = 7
}
