locals {
  common_tags = merge(
    { Environment = var.environment, ManagedBy = "terraform", Module = "rds" },
    var.tags
  )
  port_map = {
    postgres = 5432
    mysql    = 3306
    mariadb  = 3306
  }
  db_port = local.port_map[var.engine]
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.identifier}-${var.environment}"
  subnet_ids = var.subnet_ids
  tags       = local.common_tags
}

resource "aws_security_group" "this" {
  name        = "${var.identifier}-rds-${var.environment}"
  description = "Security group for RDS ${var.identifier}"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = local.db_port
    to_port         = local.db_port
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

resource "aws_db_instance" "this" {
  identifier              = "${var.identifier}-${var.environment}"
  engine                  = var.engine
  engine_version          = var.engine_version
  instance_class          = var.instance_class
  allocated_storage       = var.allocated_storage
  max_allocated_storage   = var.allocated_storage * 2
  storage_type            = "gp3"
  storage_encrypted       = true
  db_name                 = var.db_name
  username                = var.username
  manage_master_user_password = true
  db_subnet_group_name    = aws_db_subnet_group.this.name
  vpc_security_group_ids  = [aws_security_group.this.id]
  multi_az                = var.multi_az
  backup_retention_period = var.backup_retention_period
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"
  skip_final_snapshot     = var.environment != "production"
  deletion_protection     = var.environment == "production"
  copy_tags_to_snapshot   = true
  enabled_cloudwatch_logs_exports = [var.engine == "postgres" ? "postgresql" : "error"]

  tags = local.common_tags
}
