resource "aws_kinesis_stream" "cloudfront_logs" {
  count            = var.enable_realtime_logging ? 1 : 0
  name             = "${var.project_name}-${var.environment}-cloudfront-logs"
  shard_count      = 1
  retention_period = 24

  encryption_type = "KMS"
  kms_key_id      = "alias/aws/kinesis"

  stream_mode_details {
    stream_mode = "PROVISIONED"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cloudfront-logs"
  }
}

resource "aws_iam_role" "cloudfront_realtime_logs" {
  count = var.enable_realtime_logging ? 1 : 0
  name  = "${var.project_name}-${var.environment}-cf-realtime-logs"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "cloudfront_realtime_logs" {
  count = var.enable_realtime_logging ? 1 : 0
  name  = "${var.project_name}-${var.environment}-cf-realtime-logs"
  role  = aws_iam_role.cloudfront_realtime_logs[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "kinesis:DescribeStreamSummary",
          "kinesis:DescribeStream",
          "kinesis:PutRecord",
          "kinesis:PutRecords"
        ]
        Resource = aws_kinesis_stream.cloudfront_logs[0].arn
      }
    ]
  })
}

resource "aws_cloudfront_realtime_log_config" "main" {
  count         = var.enable_realtime_logging ? 1 : 0
  name          = "${var.project_name}-${var.environment}-realtime-logs"
  sampling_rate = var.realtime_log_sampling_rate

  endpoint {
    stream_type = "Kinesis"

    kinesis_stream_config {
      role_arn   = aws_iam_role.cloudfront_realtime_logs[0].arn
      stream_arn = aws_kinesis_stream.cloudfront_logs[0].arn
    }
  }

  fields = [
    "timestamp",
    "c-ip",
    "cs-method",
    "cs-host",
    "cs-uri-stem",
    "sc-status",
    "time-taken",
    "x-edge-location",
    "x-edge-request-id",
    "x-edge-result-type",
    "x-forwarded-for"
  ]

  depends_on = [aws_iam_role_policy.cloudfront_realtime_logs]
}
