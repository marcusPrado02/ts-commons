output "topic_ids" {
  description = "Map of topic name to full resource ID"
  value       = { for k, v in google_pubsub_topic.this : k => v.id }
}

output "dlq_topic_ids" {
  description = "Map of DLQ topic name to full resource ID"
  value       = { for k, v in google_pubsub_topic.dlq : k => v.id }
}

output "subscription_ids" {
  description = "Map of subscription name to full resource ID"
  value       = { for k, v in google_pubsub_subscription.this : k => v.id }
}
