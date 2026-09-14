resource "aws_secretsmanager_secret" "openai" {
  name                    = "${var.name}/openai"
  description             = "GRS Signal OpenAI API credential; value managed outside Terraform"
  recovery_window_in_days = 7
}
resource "aws_iam_role_policy" "openai" {
  name = "${var.name}-openai"
  role = aws_iam_role.lambda["research"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = aws_secretsmanager_secret.openai.arn
    }]
  })
}
