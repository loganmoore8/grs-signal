resource "aws_dynamodb_table" "data" {
  for_each     = toset(["opportunities", "runs", "history"])
  name         = "${var.name}-${each.key}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"
  attribute {
    name = "bucket"
    type = "S"
  }
  global_secondary_index {
    name = "by-group"
    key_schema {
      attribute_name = "bucket"
      key_type       = "HASH"
    }
    key_schema {
      attribute_name = "id"
      key_type       = "RANGE"
    }
    projection_type = "ALL"
  }
  attribute {
    name = "id"
    type = "S"
  }
  point_in_time_recovery { enabled = true }
  server_side_encryption { enabled = true }
  lifecycle { prevent_destroy = true }
}
resource "aws_s3_bucket" "snapshots" {
  bucket_prefix = "${var.name}-evidence-"
  lifecycle { prevent_destroy = true }
}
resource "aws_s3_bucket_public_access_block" "snapshots" {
  bucket                  = aws_s3_bucket.snapshots.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_server_side_encryption_configuration" "snapshots" {
  bucket = aws_s3_bucket.snapshots.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}
resource "aws_s3_bucket_lifecycle_configuration" "snapshots" {
  bucket = aws_s3_bucket.snapshots.id
  rule {
    id     = "expire-evidence"
    status = "Enabled"
    filter { prefix = "" }
    expiration { days = 90 }
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
  }
}
