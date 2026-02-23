output "container_app_id" {
  description = "Container App resource ID"
  value       = azurerm_container_app.this.id
}

output "fqdn" {
  description = "Container App fully-qualified domain name"
  value       = azurerm_container_app.this.ingress[0].fqdn
}

output "environment_id" {
  description = "Container Apps Environment ID"
  value       = azurerm_container_app_environment.this.id
}

output "principal_id" {
  description = "Managed identity principal ID"
  value       = azurerm_container_app.this.identity[0].principal_id
}
