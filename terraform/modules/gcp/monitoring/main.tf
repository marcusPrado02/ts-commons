locals {
  common_labels = merge(
    { environment = var.environment, managed_by = "terraform", module = "monitoring" },
    var.labels
  )
}

resource "google_monitoring_notification_channel" "email" {
  count        = var.notification_email != "" ? 1 : 0
  display_name = "${var.service_name} Alerts (${var.environment})"
  type         = "email"
  project      = var.project_id

  labels = {
    email_address = var.notification_email
  }
}

resource "google_monitoring_alert_policy" "cpu_high" {
  display_name = "${var.service_name} - High CPU (${var.environment})"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "CPU utilisation above ${var.cpu_threshold * 100}%"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.service_name}-${var.environment}\""
      comparison      = "COMPARISON_GT"
      threshold_value = var.cpu_threshold
      duration        = "300s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = var.notification_email != "" ? [google_monitoring_notification_channel.email[0].name] : []
  user_labels           = local.common_labels
}

resource "google_monitoring_alert_policy" "latency_high" {
  display_name = "${var.service_name} - High Latency (${var.environment})"
  project      = var.project_id
  combiner     = "OR"

  conditions {
    display_name = "Request latency above ${var.latency_threshold_ms}ms"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.service_name}-${var.environment}\" AND metric.type=\"run.googleapis.com/request_latencies\""
      comparison      = "COMPARISON_GT"
      threshold_value = var.latency_threshold_ms
      duration        = "120s"
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_PERCENTILE_99"
        cross_series_reducer = "REDUCE_MEAN"
      }
    }
  }

  notification_channels = var.notification_email != "" ? [google_monitoring_notification_channel.email[0].name] : []
  user_labels           = local.common_labels
}

resource "google_monitoring_uptime_check_config" "this" {
  count        = var.enable_uptime_check && var.uptime_check_host != "" ? 1 : 0
  display_name = "${var.service_name} uptime (${var.environment})"
  project      = var.project_id
  period       = "60s"
  timeout      = "10s"

  http_check {
    path         = "/healthz"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.uptime_check_host
    }
  }
}
