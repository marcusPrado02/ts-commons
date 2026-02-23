variable "resource_group_name" {
  description = "Azure resource group name"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "eastus"
}

variable "server_name" {
  description = "SQL Server name (globally unique)"
  type        = string
}

variable "database_name" {
  description = "SQL Database name"
  type        = string
}

variable "administrator_login" {
  description = "SQL Server administrator login"
  type        = string
}

variable "sku_name" {
  description = "Database SKU name (Basic, S0, GP_S_Gen5_2, etc.)"
  type        = string
  default     = "GP_S_Gen5_2"
}

variable "max_size_gb" {
  description = "Maximum database size in GB"
  type        = number
  default     = 32
}

variable "zone_redundant" {
  description = "Enable zone redundancy (requires Premium or Business Critical SKU)"
  type        = bool
  default     = false
}

variable "geo_backup_enabled" {
  description = "Enable geo-redundant backups"
  type        = bool
  default     = true
}

variable "allowed_ip_ranges" {
  description = "CIDR ranges allowed through firewall"
  type        = list(string)
  default     = []
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
