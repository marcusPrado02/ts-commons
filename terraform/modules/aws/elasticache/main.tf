locals {
  common_tags = merge(
    { Environment = var.environment, ManagedBy = "terraform", Module = "elasticache" },
    var.tags
  )
}

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.cluster_id}-${var.environment}"
  subnet_ids = var.subnet_ids
  tags       = local.common_tags
}

resource "aws_security_group" "this" {
  name        = "${var.cluster_id}-elasticache-${var.environment}"
  description = "Security group for ElastiCache ${var.cluster_id}"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = var.port
    to_port         = var.port
    protocol        = "tcp"
    security_groups = var.allowed_security_group_ids
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id = "${var.cluster_id}-${var.environment}"
  description          = "Redis replication group for ${var.cluster_id} (${var.environment})"
  node_type            = var.node_type
  num_cache_clusters   = var.num_cache_clusters
  engine_version       = var.engine_version
  port                 = var.port
  subnet_group_name    = aws_elasticache_subnet_group.this.name
  security_group_ids   = [aws_security_group.this.id]

  at_rest_encryption_enabled  = var.at_rest_encryption_enabled
  transit_encryption_enabled  = var.transit_encryption_enabled
  transit_encryption_mode     = var.transit_encryption_enabled ? "required" : "preferred"

  automatic_failover_enabled = var.num_cache_clusters > 1
  multi_az_enabled           = var.num_cache_clusters > 1

  snapshot_retention_limit = var.environment == "production" ? 7 : 1
  snapshot_window          = "03:00-04:00"
  maintenance_window       = "Mon:04:00-Mon:05:00"

  apply_immediately = var.environment != "production"

  tags = local.common_tags
}
