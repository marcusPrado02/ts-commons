locals {
  common_labels = merge(
    { environment = var.environment, managed_by = "terraform", module = "cloud-sql" },
    var.labels
  )
}

resource "google_sql_database_instance" "this" {
  name             = "${var.instance_name}-${var.environment}"
  project          = var.project_id
  region           = var.region
  database_version = var.database_version
  deletion_protection = var.deletion_protection

  settings {
    tier              = var.tier
    availability_type = var.availability_type
    disk_size         = var.disk_size
    disk_autoresize   = true

    backup_configuration {
      enabled            = true
      start_time         = "03:00"
      point_in_time_recovery_enabled = startswith(var.database_version, "POSTGRES")
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 7
      }
    }

    maintenance_window {
      day  = 1
      hour = 4
    }

    insights_config {
      query_insights_enabled = true
    }

    dynamic "ip_configuration" {
      for_each = length(var.authorized_networks) > 0 ? [1] : []
      content {
        dynamic "authorized_networks" {
          for_each = var.authorized_networks
          content {
            value = authorized_networks.value
          }
        }
      }
    }

    user_labels = local.common_labels
  }
}

resource "google_sql_database" "this" {
  name     = var.database_name
  instance = google_sql_database_instance.this.name
  project  = var.project_id
}

resource "google_sql_user" "this" {
  name     = var.database_user
  instance = google_sql_database_instance.this.name
  project  = var.project_id
  password = random_password.db_user.result
}

resource "random_password" "db_user" {
  length  = 32
  special = false
}
