locals {
  common_tags = merge(
    { Environment = var.environment, ManagedBy = "terraform", Module = "app-insights" },
    var.tags
  )
}

resource "azurerm_log_analytics_workspace" "this" {
  name                = var.workspace_name
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = var.retention_in_days
  daily_quota_gb      = var.daily_data_cap_in_gb > 0 ? var.daily_data_cap_in_gb : -1
  tags                = local.common_tags
}

resource "azurerm_application_insights" "this" {
  name                = var.name
  resource_group_name = var.resource_group_name
  location            = var.location
  workspace_id        = azurerm_log_analytics_workspace.this.id
  application_type    = var.application_type
  retention_in_days   = var.retention_in_days
  daily_data_cap_in_gb = var.daily_data_cap_in_gb > 0 ? var.daily_data_cap_in_gb : null
  tags                = local.common_tags
}

resource "azurerm_application_insights_smart_detection_rule" "all" {
  for_each = var.enable_smart_detection ? toset([
    "Slow page load time",
    "Slow server response time",
    "Long dependency duration",
    "Degradation in server response time",
    "Degradation in dependency duration",
  ]) : toset([])

  name                    = each.value
  application_insights_id = azurerm_application_insights.this.id
  enabled                 = true
}
