variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "topics" {
  description = "List of Pub/Sub topic names to create"
  type        = list(string)
}

variable "message_retention_duration" {
  description = "Default message retention duration (e.g. 604800s = 7 days)"
  type        = string
  default     = "604800s"
}

variable "subscription_ack_deadline_seconds" {
  description = "Acknowledgement deadline in seconds"
  type        = number
  default     = 60
}

variable "subscription_message_retention_duration" {
  description = "Subscription message retention duration"
  type        = string
  default     = "604800s"
}

variable "dead_letter_max_delivery_attempts" {
  description = "Max delivery attempts before dead-lettering"
  type        = number
  default     = 5
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
