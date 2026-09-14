data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}
resource "aws_iam_role" "lambda" {
  for_each           = toset(["api", "research"])
  name               = "${var.name}-${each.key}"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}
resource "aws_iam_role_policy_attachment" "logs" {
  for_each   = aws_iam_role.lambda
  role       = each.value.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
resource "aws_iam_role_policy" "data" {
  for_each = aws_iam_role.lambda
  role     = each.value.id
  policy = jsonencode({ Version = "2012-10-17", Statement = concat([
    { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:Query"], Resource = concat([for t in aws_dynamodb_table.data : t.arn], [for t in aws_dynamodb_table.data : "${t.arn}/index/*"]) },
    { Effect = "Allow", Action = ["dynamodb:PutItem"], Resource = each.key == "api" ? [aws_dynamodb_table.data["opportunities"].arn] : [for t in aws_dynamodb_table.data : t.arn] }
    ], each.key == "research" ? [
    { Effect = "Allow", Action = ["s3:PutObject"], Resource = ["${aws_s3_bucket.snapshots.arn}/*"] },
    { Effect = "Allow", Action = ["ses:SendEmail"], Resource = [aws_ses_email_identity.sender.arn] }
  ] : []) })
}
resource "aws_cloudwatch_log_group" "lambda" {
  for_each          = aws_iam_role.lambda
  name              = "/aws/lambda/${var.name}-${each.key}"
  retention_in_days = 14
}
resource "aws_lambda_function" "functions" {
  for_each                       = aws_iam_role.lambda
  function_name                  = "${var.name}-${each.key}"
  role                           = each.value.arn
  handler                        = "index.handler"
  runtime                        = "nodejs22.x"
  filename                       = "${var.artifact_directory}/${each.key}.zip"
  source_code_hash               = filebase64sha256("${var.artifact_directory}/${each.key}.zip")
  timeout                        = each.key == "research" ? 900 : 30
  memory_size                    = each.key == "research" ? 512 : 256
  reserved_concurrent_executions = each.key == "research" ? 1 : 5
  environment {
    variables = {
      OPPORTUNITIES_TABLE = aws_dynamodb_table.data["opportunities"].name
      RUNS_TABLE          = aws_dynamodb_table.data["runs"].name
      HISTORY_TABLE       = aws_dynamodb_table.data["history"].name
      SNAPSHOTS_BUCKET    = aws_s3_bucket.snapshots.id
      ALERT_SENDER        = var.alert_sender
      ALERT_RECIPIENTS    = join(",", var.alert_recipients)
      APP_URL             = local.app_url
      SEARCH_GATEWAY_URL  = aws_bedrockagentcore_gateway.search.gateway_url
      SEARCH_REGION       = "us-east-1"
    }
  }
  depends_on = [aws_cloudwatch_log_group.lambda, aws_iam_role_policy_attachment.logs, aws_iam_role_policy.data]
}
resource "aws_apigatewayv2_api" "api" {
  name          = var.name
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = [local.app_url]
    allow_methods = ["GET", "PATCH", "OPTIONS"]
    allow_headers = ["Authorization", "Content-Type"]
  }
}
resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id           = aws_apigatewayv2_api.api.id
  name             = "cognito"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  jwt_configuration {
    audience = [aws_cognito_user_pool_client.web.id]
    issuer   = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.users.id}"
  }
}
resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.functions["api"].invoke_arn
  payload_format_version = "2.0"
}
resource "aws_apigatewayv2_route" "routes" {
  for_each             = toset(["GET /opportunities", "GET /opportunities/{id}", "PATCH /opportunities/{id}", "GET /health"])
  api_id               = aws_apigatewayv2_api.api.id
  route_key            = each.key
  target               = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.jwt.id
  authorization_scopes = ["openid"]
}
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
  default_route_settings {
    throttling_burst_limit = 20
    throttling_rate_limit  = 10
  }
}
resource "aws_lambda_permission" "api" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions["api"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
