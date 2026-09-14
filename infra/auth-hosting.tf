resource "aws_cognito_user_pool" "users" {
  name                     = var.name
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  admin_create_user_config { allow_admin_create_user_only = true }
  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }
}
resource "aws_cognito_user_pool_domain" "login" {
  domain       = var.cognito_domain_prefix
  user_pool_id = aws_cognito_user_pool.users.id
}
locals {
  app_url   = "https://${var.branch}.${aws_amplify_app.web.default_domain}"
  login_url = "https://${var.cognito_domain_prefix}.auth.${var.region}.amazoncognito.com"
}
resource "aws_cognito_user_pool_client" "web" {
  name                                 = "${var.name}-web"
  user_pool_id                         = aws_cognito_user_pool.users.id
  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO"]
  callback_urls                        = ["${local.app_url}/"]
  logout_urls                          = ["${local.app_url}/"]
  prevent_user_existence_errors        = "ENABLED"
  explicit_auth_flows                  = ["ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_USER_SRP_AUTH"]
}
resource "aws_amplify_app" "web" {
  name       = var.name
  repository = var.repository_url
  platform   = "WEB"
  build_spec = <<-YAML
    version: 1
    applications:
      - appRoot: apps/web
        frontend:
          buildPath: /
          phases:
            preBuild:
              commands:
                - nvm install 22
                - nvm use 22
                - npm ci
            build:
              commands:
                - npm run build:web
          artifacts:
            baseDirectory: apps/web/out
            files:
              - '**/*'
          cache:
            paths:
              - node_modules/**/*
  YAML
}
resource "aws_amplify_branch" "web" {
  app_id            = aws_amplify_app.web.id
  branch_name       = var.branch
  stage             = "PRODUCTION"
  enable_auto_build = false
  environment_variables = {
    AMPLIFY_MONOREPO_APP_ROOT     = "apps/web"
    NEXT_PUBLIC_API_URL           = aws_apigatewayv2_api.api.api_endpoint
    NEXT_PUBLIC_COGNITO_AUTHORITY = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.users.id}"
    NEXT_PUBLIC_COGNITO_CLIENT_ID = aws_cognito_user_pool_client.web.id
    NEXT_PUBLIC_COGNITO_DOMAIN    = local.login_url
  }
}
