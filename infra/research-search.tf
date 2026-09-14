data "aws_caller_identity" "current" {}
resource "aws_iam_role" "search" {
  name = "${var.name}-search"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "bedrock-agentcore.amazonaws.com" }
      Condition = {
        StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }
        ArnLike      = { "aws:SourceArn" = "arn:aws:bedrock-agentcore:us-east-1:${data.aws_caller_identity.current.account_id}:gateway/*" }
      }
    }]
  })
}
resource "aws_iam_role_policy" "search" {
  role = aws_iam_role.search.id
  name = "${var.name}-search"
  policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect   = "Allow"
    Action   = "bedrock-agentcore:InvokeWebSearch"
    Resource = "arn:aws:bedrock-agentcore:us-east-1:aws:tool/web-search.v1"
  }] })
}
resource "aws_bedrockagentcore_gateway" "search" {
  region          = "us-east-1"
  name            = "${var.name}-search"
  authorizer_type = "AWS_IAM"
  protocol_type   = "MCP"
  role_arn        = aws_iam_role.search.arn
  depends_on      = [aws_iam_role_policy.search]
}
resource "aws_bedrockagentcore_gateway_target" "search" {
  region             = "us-east-1"
  name               = "web-search"
  gateway_identifier = aws_bedrockagentcore_gateway.search.gateway_id
  credential_provider_configuration {
    gateway_iam_role {}
  }
  target_configuration {
    mcp {
      connector {
        source {
          connector_id = "web-search"
          version      = "1.2.0"
        }
        configuration {
          name             = "WebSearch"
          parameter_values = jsonencode({})
        }
      }
    }
  }
}
output "research_search" {
  value = { url = aws_bedrockagentcore_gateway.search.gateway_url, region = "us-east-1" }
}

resource "aws_iam_role_policy" "research_model" {
  name = "${var.name}-research-model"
  role = aws_iam_role.lambda["research"].id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = "bedrock:InvokeModel", Resource = [
      "arn:aws:bedrock:${var.region}:${data.aws_caller_identity.current.account_id}:inference-profile/us.anthropic.claude-sonnet-4-6",
      "arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-sonnet-4-6",
      "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-6",
      "arn:aws:bedrock:us-east-2::foundation-model/anthropic.claude-sonnet-4-6"
    ] },
    { Effect = "Allow", Action = "bedrock-agentcore:InvokeGateway", Resource = aws_bedrockagentcore_gateway.search.gateway_arn }
  ] })
}
