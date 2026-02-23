locals {
  common_labels = merge(
    { environment = var.environment, managed_by = "terraform", module = "memorystore" },
    var.labels
  )
}

resource "google_redis_instance" "this" {
  name               = "${var.instance_id}-${var.environment}"
  project            = var.project_id
  region             = var.region
  memory_size_gb     = var.memory_size_gb
  tier               = var.tier
  redis_version      = var.redis_version
  authorized_network = var.authorized_network
  connect_mode       = var.connect_mode

  transit_encryption_mode = var.transit_encryption_mode

  redis_configs = {
    maxmemory-policy = "allkeys-lru"
  }

  labels = local.common_labels
}
