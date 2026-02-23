locals {
  common_tags = merge(
    { Environment = var.environment, ManagedBy = "terraform", Module = "app-service" },
    var.tags
  )
}

resource "azurerm_service_plan" "this" {
  name                = var.app_service_plan_name
  resource_group_name = var.resource_group_name
  location            = var.location
  os_type             = var.os_type
  sku_name            = var.sku_name
  tags                = local.common_tags
}

resource "azurerm_linux_web_app" "this" {
  name                = var.app_service_name
  resource_group_name = var.resource_group_name
  location            = var.location
  service_plan_id     = azurerm_service_plan.this.id
  https_only          = true

  site_config {
    always_on         = true
    health_check_path = "/healthz"

    dynamic "application_stack" {
      for_each = var.docker_image != "" ? [] : [1]
      content {
        node_version = var.node_version
      }
    }

    dynamic "application_stack" {
      for_each = var.docker_image != "" ? [1] : []
      content {
        docker_image_name = var.docker_image
      }
    }
  }

  app_settings = merge(
    {
      WEBSITES_ENABLE_APP_SERVICE_STORAGE = "false"
      NODE_ENV                            = var.environment
    },
    var.app_settings
  )

  identity {
    type = "SystemAssigned"
  }

  logs {
    http_logs {
      file_system {
        retention_in_days = 30
        retention_in_mb   = 35
      }
    }
    application_logs {
      file_system_level = "Information"
    }
  }

  tags = local.common_tags
}
