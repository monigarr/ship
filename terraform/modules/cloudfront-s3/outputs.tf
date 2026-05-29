output "s3_bucket_name" {
  description = "S3 bucket name for frontend"
  value       = aws_s3_bucket.frontend.id
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN for frontend"
  value       = aws_s3_bucket.frontend.arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  description = "CloudFront domain name"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "frontend_url" {
  description = "Frontend URL"
  value       = var.app_domain_name != "" ? "https://${var.app_domain_name}" : "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "uploads_bucket_name" {
  description = "S3 bucket name for file uploads"
  value       = aws_s3_bucket.uploads.id
}

output "uploads_bucket_arn" {
  description = "S3 bucket ARN for file uploads"
  value       = aws_s3_bucket.uploads.arn
}

output "cloudfront_waf_web_acl_arn" {
  description = "Managed WAF WebACL ARN (if created)"
  value       = var.create_managed_waf ? aws_wafv2_web_acl.cloudfront[0].arn : null
}

output "cloudfront_realtime_log_config_arn" {
  description = "Realtime log config ARN (if enabled)"
  value       = var.enable_realtime_logging ? aws_cloudfront_realtime_log_config.main[0].arn : null
}
