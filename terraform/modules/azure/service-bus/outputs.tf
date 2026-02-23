output "namespace_id" {
  description = "Service Bus namespace resource ID"
  value       = azurerm_servicebus_namespace.this.id
}

output "endpoint" {
  description = "Service Bus endpoint"
  value       = azurerm_servicebus_namespace.this.endpoint
}

output "queue_ids" {
  description = "Map of queue name to resource ID"
  value       = { for k, v in azurerm_servicebus_queue.this : k => v.id }
}

output "topic_ids" {
  description = "Map of topic name to resource ID"
  value       = { for k, v in azurerm_servicebus_topic.this : k => v.id }
}

output "principal_id" {
  description = "Managed identity principal ID"
  value       = azurerm_servicebus_namespace.this.identity[0].principal_id
}
