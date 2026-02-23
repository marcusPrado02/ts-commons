output "log_group_name" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.this.name
}

output "log_group_arn" {
  description = "CloudWatch log group ARN"
  value       = aws_cloudwatch_log_group.this.arn
}

output "alarm_topic_arn" {
  description = "SNS topic ARN for alarm notifications (empty if alarms disabled)"
  value       = var.enable_alarms && var.alarm_email != "" ? aws_sns_topic.alarms[0].arn : ""
}

output "dashboard_arn" {
  description = "CloudWatch dashboard ARN"
  value       = aws_cloudwatch_dashboard.this.dashboard_arn
}
