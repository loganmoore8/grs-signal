data "aws_caller_identity" "current" {}

resource "aws_iam_role_policy" "bedrock" {
  name = "${var.name}-bedrock"
  role = aws_iam_role.lambda["research"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Action    = ["bedrock-mantle:CreateInference"]
        Resource  = "arn:aws:bedrock-mantle:${var.region}:${data.aws_caller_identity.current.account_id}:project/*"
        Condition = { StringEquals = { "bedrock-mantle:Model" = "openai.gpt-5.6-luna" } }
      },
      {
        Effect   = "Allow"
        Action   = ["bedrock-mantle:GetInference", "bedrock-mantle:CancelInference"]
        Resource = "arn:aws:bedrock-mantle:${var.region}:${data.aws_caller_identity.current.account_id}:project/*"
      },
      {
        Effect    = "Allow"
        Action    = ["bedrock-websearch:InvokeSearch", "bedrock-websearch:InvokeFetch", "bedrock-websearch:ExternalWebAccess"]
        Resource  = "*"
        Condition = { StringEquals = { "aws:RequestedRegion" = var.region } }
      }
    ]
  })
}
