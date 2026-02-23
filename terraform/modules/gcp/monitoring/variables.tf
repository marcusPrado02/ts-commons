variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "service_name" {
  description = "Name of the service to monitor"
  type        = string
}

variable "notification_email" {
  description = "Email address for alert notifications"
  type        = string
  default     = ""
}

variable "cpu_threshold" {
  description = "CPU utilisation threshold (0.0 – 1.0)"
  type        = number
  default     = 0.8
}

variable "error_rate_threshold" {
  description = "HTTP 5xx error rate threshold (requests/second)"
  type        = number
  default     = 1.0
}

variable "latency_threshold_ms" {
  description = "Request latency threshold in milliseconds"
  type        = number
  default     = 2000
}

variable "enable_uptime_check" {
  description = "Create an uptime check for the service"
  type        = bool
  default     = true
}

variable "uptime_check_host" {
  description = "Hostname for the uptime check"
  type        = string
  default     = ""
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
