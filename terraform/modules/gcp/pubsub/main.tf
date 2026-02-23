locals {
  common_labels = merge(
    { environment = var.environment, managed_by = "terraform", module = "pubsub" },
    var.labels
  )
}

resource "google_pubsub_topic" "this" {
  for_each = toset(var.topics)
  name     = "${each.value}-${var.environment}"
  project  = var.project_id

  message_retention_duration = var.message_retention_duration
  labels                     = local.common_labels
}

resource "google_pubsub_topic" "dlq" {
  for_each = toset(var.topics)
  name     = "${each.value}-dlq-${var.environment}"
  project  = var.project_id
  labels   = local.common_labels
}

resource "google_pubsub_subscription" "this" {
  for_each = toset(var.topics)
  name     = "${each.value}-sub-${var.environment}"
  project  = var.project_id
  topic    = google_pubsub_topic.this[each.key].id

  ack_deadline_seconds       = var.subscription_ack_deadline_seconds
  message_retention_duration = var.subscription_message_retention_duration
  retain_acked_messages      = false

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dlq[each.key].id
    max_delivery_attempts = var.dead_letter_max_delivery_attempts
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "300s"
  }

  labels = local.common_labels
}
