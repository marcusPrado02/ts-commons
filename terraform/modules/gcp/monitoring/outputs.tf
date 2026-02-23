output "notification_channel_id" {
  description = "Notification channel ID (empty if not created)"
  value       = var.notification_email != "" ? google_monitoring_notification_channel.email[0].name : ""
}

output "cpu_alert_policy_name" {
  description = "CPU alert policy name"
  value       = google_monitoring_alert_policy.cpu_high.name
}

output "latency_alert_policy_name" {
  description = "Latency alert policy name"
  value       = google_monitoring_alert_policy.latency_high.name
}

output "uptime_check_id" {
  description = "Uptime check ID (empty if not created)"
  value       = var.enable_uptime_check && var.uptime_check_host != "" ? google_monitoring_uptime_check_config.this[0].uptime_check_id : ""
}
