locals {
  common_tags = merge(
    { Environment = var.environment, ManagedBy = "terraform", Module = "cloudwatch" },
    var.tags
  )
}

resource "aws_cloudwatch_log_group" "this" {
  name              = var.log_group_name
  retention_in_days = var.retention_in_days
  tags              = local.common_tags
}

resource "aws_sns_topic" "alarms" {
  count = var.enable_alarms && var.alarm_email != "" ? 1 : 0
  name  = "${var.service_name}-alarms-${var.environment}"
  tags  = local.common_tags
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.enable_alarms && var.alarm_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alarms[0].arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  count               = var.enable_alarms ? 1 : 0
  alarm_name          = "${var.service_name}-cpu-high-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = var.cpu_alarm_threshold
  alarm_description   = "CPU utilisation above ${var.cpu_alarm_threshold}% for ${var.service_name}"
  alarm_actions       = var.alarm_email != "" ? [aws_sns_topic.alarms[0].arn] : []
  ok_actions          = var.alarm_email != "" ? [aws_sns_topic.alarms[0].arn] : []

  dimensions = {
    ServiceName = var.service_name
    Environment = var.environment
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "errors_high" {
  count               = var.enable_alarms ? 1 : 0
  alarm_name          = "${var.service_name}-errors-high-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "Custom/${var.service_name}"
  period              = 300
  statistic           = "Sum"
  threshold           = var.error_alarm_threshold
  alarm_description   = "Error count above ${var.error_alarm_threshold} for ${var.service_name}"
  alarm_actions       = var.alarm_email != "" ? [aws_sns_topic.alarms[0].arn] : []
  treat_missing_data  = "notBreaching"

  tags = local.common_tags
}

resource "aws_cloudwatch_dashboard" "this" {
  dashboard_name = "${var.service_name}-${var.environment}"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          title  = "CPU Utilisation"
          period = 300
          metrics = [["AWS/ECS", "CPUUtilization", "ServiceName", var.service_name]]
        }
      },
      {
        type = "log"
        properties = {
          title   = "Application Logs"
          query   = "SOURCE '${var.log_group_name}' | fields @timestamp, @message | sort @timestamp desc | limit 100"
          region  = data.aws_region.current.name
          view    = "table"
        }
      }
    ]
  })
}

data "aws_region" "current" {}
