variable "resource_group_name" {
  description = "Azure resource group name"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "eastus"
}

variable "namespace_name" {
  description = "Service Bus namespace name"
  type        = string
}

variable "sku" {
  description = "Service Bus SKU (Basic, Standard, Premium)"
  type        = string
  default     = "Standard"
}

variable "queues" {
  description = "List of queue names to create"
  type        = list(string)
  default     = []
}

variable "topics" {
  description = "List of topic names to create"
  type        = list(string)
  default     = []
}

variable "max_size_in_megabytes" {
  description = "Queue/topic max size in MB"
  type        = number
  default     = 1024
}

variable "default_message_ttl" {
  description = "Default message TTL (ISO 8601 duration)"
  type        = string
  default     = "P14D"
}

variable "lock_duration" {
  description = "Lock duration for queues (ISO 8601)"
  type        = string
  default     = "PT1M"
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
