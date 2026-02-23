locals {
  common_tags = merge(
    { Environment = var.environment, ManagedBy = "terraform", Module = "container-apps" },
    var.tags
  )
  env_var_list = [
    for k, v in var.env_vars : { name = k, value = v }
  ]
}

resource "azurerm_log_analytics_workspace" "this" {
  name                = "${var.environment_name}-logs"
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.common_tags
}

resource "azurerm_container_app_environment" "this" {
  name                       = var.environment_name
  resource_group_name        = var.resource_group_name
  location                   = var.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.this.id
  tags                       = local.common_tags
}

resource "azurerm_container_app" "this" {
  name                         = var.container_app_name
  resource_group_name          = var.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.this.id
  revision_mode                = "Single"
  tags                         = local.common_tags

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    container {
      name   = var.container_app_name
      image  = var.image
      cpu    = var.cpu
      memory = var.memory

      dynamic "env" {
        for_each = local.env_var_list
        content {
          name  = env.value.name
          value = env.value.value
        }
      }

      liveness_probe {
        path      = "/healthz"
        port      = var.container_port
        transport = "HTTP"
      }

      readiness_probe {
        path      = "/readyz"
        port      = var.container_port
        transport = "HTTP"
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = var.container_port

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  identity {
    type = "SystemAssigned"
  }
}
