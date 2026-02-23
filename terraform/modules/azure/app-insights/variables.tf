variable "resource_group_name" {
  description = "Azure resource group name"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "eastus"
}

variable "name" {
  description = "Application Insights resource name"
  type        = string
}

variable "workspace_name" {
  description = "Log Analytics workspace name"
  type        = string
}

variable "application_type" {
  description = "Application type (web, other)"
  type        = string
  default     = "web"
}

variable "retention_in_days" {
  description = "Data retention in days"
  type        = number
  default     = 90
}

variable "daily_data_cap_in_gb" {
  description = "Daily data cap in GB (0 = unlimited)"
  type        = number
  default     = 5
}

variable "enable_smart_detection" {
  description = "Enable Application Insights Smart Detection"
  type        = bool
  default     = true
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
