variable "resource_group_name" {
  description = "Azure resource group name"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "eastus"
}

variable "app_service_plan_name" {
  description = "App Service Plan name"
  type        = string
}

variable "app_service_name" {
  description = "App Service name"
  type        = string
}

variable "sku_name" {
  description = "App Service Plan SKU (B1, B2, S1, P1v3, etc.)"
  type        = string
  default     = "B2"
}

variable "os_type" {
  description = "OS type for App Service Plan (Linux or Windows)"
  type        = string
  default     = "Linux"
}

variable "docker_image" {
  description = "Docker image URI for Linux app (optional)"
  type        = string
  default     = ""
}

variable "node_version" {
  description = "Node.js version (e.g. NODE|20-lts)"
  type        = string
  default     = "NODE|20-lts"
}

variable "app_settings" {
  description = "App settings (environment variables)"
  type        = map(string)
  default     = {}
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
