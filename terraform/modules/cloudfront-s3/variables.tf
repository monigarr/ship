variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
}

variable "app_domain_name" {
  description = "Custom domain for frontend (e.g., app.example.gov)"
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route53 Hosted Zone ID for DNS records"
  type        = string
  default     = ""
}

variable "eb_environment_cname" {
  description = "Elastic Beanstalk environment CNAME for API routing"
  type        = string
  default     = ""
}

variable "upload_cors_origins" {
  description = "Allowed origins for file upload CORS (browser direct-to-S3 uploads)"
  type        = list(string)
  default     = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"]
}

variable "cloudfront_waf_web_acl_id" {
  description = "WAF WebACL ARN to attach to CloudFront distribution (optional)"
  type        = string
  default     = ""
}

variable "create_managed_waf" {
  description = "Create a managed WAF WebACL in this module when no external ARN is provided"
  type        = bool
  default     = false
}

variable "enable_realtime_logging" {
  description = "Enable CloudFront realtime logging to Kinesis"
  type        = bool
  default     = false
}

variable "realtime_log_sampling_rate" {
  description = "Realtime log sampling rate (1-100)"
  type        = number
  default     = 100
}
