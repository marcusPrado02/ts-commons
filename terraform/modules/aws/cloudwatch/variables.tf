variable "log_group_name" {
  description = "CloudWatch log group name"
  type        = string
}

variable "retention_in_days" {
  description = "Log retention in days"
  type        = number
  default     = 30
}

variable "enable_alarms" {
  description = "Create CloudWatch metric alarms"
  type        = bool
  default     = true
}

variable "alarm_email" {
  description = "Email address for alarm notifications"
  type        = string
  default     = ""
}

variable "cpu_alarm_threshold" {
  description = "CPU utilisation percent threshold for alarm"
  type        = number
  default     = 80
}

variable "error_alarm_threshold" {
  description = "Error count threshold per 5-minute period"
  type        = number
  default     = 5
}

variable "service_name" {
  description = "Name of the service being monitored"
  type        = string
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
