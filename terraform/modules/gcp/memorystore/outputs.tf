output "host" {
  description = "Memorystore Redis host"
  value       = google_redis_instance.this.host
}

output "port" {
  description = "Memorystore Redis port"
  value       = google_redis_instance.this.port
}

output "id" {
  description = "Memorystore instance ID"
  value       = google_redis_instance.this.id
}

output "server_ca_certs" {
  description = "CA certificates for TLS connections"
  value       = google_redis_instance.this.server_ca_certs
  sensitive   = true
}
