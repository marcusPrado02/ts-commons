output "instance_name" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.this.name
}

output "connection_name" {
  description = "Cloud SQL instance connection name"
  value       = google_sql_database_instance.this.connection_name
}

output "public_ip" {
  description = "Cloud SQL public IP address"
  value       = google_sql_database_instance.this.public_ip_address
}

output "private_ip" {
  description = "Cloud SQL private IP address"
  value       = google_sql_database_instance.this.private_ip_address
}

output "database_name" {
  description = "Database name"
  value       = google_sql_database.this.name
}
