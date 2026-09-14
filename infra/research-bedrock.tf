data "aws_caller_identity" "current" {}

resource "aws_iam_role_policy" "bedrock" {
  name = "${var.name}-bedrock"
  role = aws_iam_role.lambda["research"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["bedrock:InvokeModel"]
        Resource = concat(
          ["arn:aws:bedrock:${var.region}:${data.aws_caller_identity.current.account_id}:inference-profile/${jsondecode(file("${path.module}/../config/research.json")).model}"],
          [for region in ["us-east-1", "us-east-2", "us-west-2"] : "arn:aws:bedrock:${region}::foundation-model/amazon.nova-2-lite-v1:0"]
        )
      },
      {
        Effect   = "Allow"
        Action   = ["bedrock:InvokeTool"]
        Resource = "arn:aws:bedrock::${data.aws_caller_identity.current.account_id}:system-tool/amazon.nova_grounding"
      }
    ]
  })
}
