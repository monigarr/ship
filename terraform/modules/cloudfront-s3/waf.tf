resource "aws_wafv2_ip_set" "bad_ips" {
  count              = var.create_managed_waf ? 1 : 0
  name               = "${var.project_name}-${var.environment}-bad-ips"
  description        = "IP addresses to block"
  scope              = "CLOUDFRONT"
  ip_address_version = "IPV4"
  addresses          = []

  tags = {
    Name = "${var.project_name}-${var.environment}-bad-ips"
  }
}

resource "aws_wafv2_web_acl" "cloudfront" {
  count       = var.create_managed_waf ? 1 : 0
  name        = "${var.project_name}-${var.environment}-cloudfront-waf"
  description = "Managed WAF for ${var.project_name} ${var.environment} CloudFront distribution"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # Baseline edge DDoS protection
  rule {
    name     = "RateBasedRule-IP-300"
    priority = 1

    action {
      block {
        custom_response {
          response_code = 429
          response_header {
            name  = "Retry-After"
            value = "300"
          }
        }
      }
    }

    statement {
      rate_based_statement {
        limit              = 300
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-${var.environment}-rate-limit"
    }
  }

  rule {
    name     = "AWSManagedRulesAmazonIpReputationList"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesAmazonIpReputationList"
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-${var.environment}-ip-reputation"
    }
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-${var.environment}-common-rule-set"
    }
  }

  rule {
    name     = "BadIPs"
    priority = 4

    action {
      block {}
    }

    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.bad_ips[0].arn
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-${var.environment}-bad-ips"
    }
  }

  visibility_config {
    sampled_requests_enabled   = true
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-${var.environment}-cloudfront-waf"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cloudfront-waf"
  }
}
