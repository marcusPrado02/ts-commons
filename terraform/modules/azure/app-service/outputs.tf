output "service_plan_id" {
  description = "App Service Plan ID"
  value       = azurerm_service_plan.this.id
}

output "app_service_id" {
  description = "App Service ID"
  value       = azurerm_linux_web_app.this.id
}

output "default_hostname" {
  description = "Default hostname of the App Service"
  value       = azurerm_linux_web_app.this.default_hostname
}

output "principal_id" {
  description = "Managed identity principal ID"
  value       = azurerm_linux_web_app.this.identity[0].principal_id
}

output "outbound_ip_addresses" {
  description = "Outbound IP addresses"
  value       = azurerm_linux_web_app.this.outbound_ip_addresses
}
