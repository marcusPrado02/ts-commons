variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "instance_id" {
  description = "Memorystore instance ID"
  type        = string
}

variable "memory_size_gb" {
  description = "Redis memory size in GB"
  type        = number
  default     = 1
}

variable "tier" {
  description = "Service tier (BASIC or STANDARD_HA)"
  type        = string
  default     = "STANDARD_HA"
}

variable "redis_version" {
  description = "Redis version (REDIS_7_0, REDIS_6_X, etc.)"
  type        = string
  default     = "REDIS_7_0"
}

variable "authorized_network" {
  description = "VPC network name or self_link"
  type        = string
  default     = "default"
}

variable "connect_mode" {
  description = "Connection mode (DIRECT_PEERING or PRIVATE_SERVICE_ACCESS)"
  type        = string
  default     = "DIRECT_PEERING"
}

variable "transit_encryption_mode" {
  description = "TLS mode (SERVER_AUTHENTICATION or DISABLED)"
  type        = string
  default     = "SERVER_AUTHENTICATION"
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "labels" {
  description = "Additional labels"
  type        = map(string)
  default     = {}
}
