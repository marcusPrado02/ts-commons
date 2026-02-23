variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "instance_name" {
  description = "Cloud SQL instance name"
  type        = string
}

variable "database_version" {
  description = "Database version (POSTGRES_15, MYSQL_8_0, etc.)"
  type        = string
  default     = "POSTGRES_15"
}

variable "tier" {
  description = "Machine tier (db-f1-micro, db-n1-standard-1, etc.)"
  type        = string
  default     = "db-f1-micro"
}

variable "database_name" {
  description = "Database name to create"
  type        = string
}

variable "database_user" {
  description = "Database user to create"
  type        = string
}

variable "disk_size" {
  description = "Disk size in GB"
  type        = number
  default     = 20
}

variable "availability_type" {
  description = "Availability type (ZONAL or REGIONAL)"
  type        = string
  default     = "ZONAL"
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = false
}

variable "authorized_networks" {
  description = "List of authorized CIDR networks"
  type        = list(string)
  default     = []
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
