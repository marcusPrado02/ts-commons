variable "queue_name" {
  description = "Name of the SQS queue"
  type        = string
}

variable "topic_name" {
  description = "Name of the SNS topic"
  type        = string
}

variable "visibility_timeout_seconds" {
  description = "SQS visibility timeout in seconds"
  type        = number
  default     = 30
}

variable "message_retention_seconds" {
  description = "SQS message retention period in seconds"
  type        = number
  default     = 86400
}

variable "max_receive_count" {
  description = "Max receive count before sending to DLQ"
  type        = number
  default     = 3
}

variable "fifo_queue" {
  description = "Create a FIFO queue"
  type        = bool
  default     = false
}

variable "kms_master_key_id" {
  description = "KMS key for encryption (empty = use AWS managed key)"
  type        = string
  default     = ""
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
