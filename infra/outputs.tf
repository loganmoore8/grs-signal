output "deployment" {
  value = {
    region              = var.region
    app_url             = local.app_url
    api_url             = aws_apigatewayv2_api.api.api_endpoint
    amplify_app_id      = aws_amplify_app.web.id
    branch              = var.branch
    user_pool_id        = aws_cognito_user_pool.users.id
    openai_secret_arn   = aws_secretsmanager_secret.openai.arn
    runs_table          = aws_dynamodb_table.data["runs"].name
    opportunities_table = aws_dynamodb_table.data["opportunities"].name
    history_table       = aws_dynamodb_table.data["history"].name
    snapshots_bucket    = aws_s3_bucket.snapshots.id
    worker_name         = aws_lambda_function.functions["research"].function_name
  }
}
