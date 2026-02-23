locals {
  common_tags = merge(
    { Environment = var.environment, ManagedBy = "terraform", Module = "azure-sql" },
    var.tags
  )
}

resource "azurerm_mssql_server" "this" {
  name                         = "${var.server_name}-${var.environment}"
  resource_group_name          = var.resource_group_name
  location                     = var.location
  version                      = "12.0"
  administrator_login          = var.administrator_login
  administrator_login_password = random_password.sql_admin.result

  azuread_administrator {
    login_username              = "aad-admin"
    object_id                   = data.azurerm_client_config.current.object_id
    azuread_authentication_only = false
  }

  minimum_tls_version           = "1.2"
  public_network_access_enabled = var.environment != "production"

  identity {
    type = "SystemAssigned"
  }

  tags = local.common_tags
}

resource "azurerm_mssql_database" "this" {
  name           = var.database_name
  server_id      = azurerm_mssql_server.this.id
  sku_name       = var.sku_name
  max_size_gb    = var.max_size_gb
  zone_redundant = var.zone_redundant
  geo_backup_enabled = var.geo_backup_enabled

  short_term_retention_policy {
    retention_days           = 7
    backup_interval_in_hours = 12
  }

  long_term_retention_policy {
    weekly_retention  = "P1W"
    monthly_retention = "P1M"
    yearly_retention  = "P1Y"
    week_of_year      = 1
  }

  tags = local.common_tags
}

resource "azurerm_mssql_firewall_rule" "allowed" {
  count            = length(var.allowed_ip_ranges)
  name             = "allow-${count.index}"
  server_id        = azurerm_mssql_server.this.id
  start_ip_address = split("-", var.allowed_ip_ranges[count.index])[0]
  end_ip_address   = length(split("-", var.allowed_ip_ranges[count.index])) > 1 ? split("-", var.allowed_ip_ranges[count.index])[1] : split("-", var.allowed_ip_ranges[count.index])[0]
}

resource "random_password" "sql_admin" {
  length  = 32
  special = true
}

data "azurerm_client_config" "current" {}
