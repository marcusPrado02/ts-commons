variable "cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
}

variable "service_name" {
  description = "Name of the ECS service"
  type        = string
}

variable "image" {
  description = "Docker image URI (e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com/my-app:latest)"
  type        = string
}

variable "cpu" {
  description = "CPU units for the task (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 256
}

variable "memory" {
  description = "Memory in MiB for the task"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Number of desired task instances"
  type        = number
  default     = 2
}

variable "subnet_ids" {
  description = "List of subnet IDs for the service"
  type        = list(string)
}

variable "security_group_ids" {
  description = "List of security group IDs"
  type        = list(string)
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
}

variable "container_port" {
  description = "Port the container listens on"
  type        = number
  default     = 3000
}

variable "health_check_path" {
  description = "Health check path for the target group"
  type        = string
  default     = "/healthz"
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
