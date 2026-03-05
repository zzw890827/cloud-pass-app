output "d1_database_id" {
  description = "D1 database ID"
  value       = cloudflare_d1_database.cloud_pass_db.id
}

output "api_url" {
  description = "API URL"
  value       = "https://${var.api_subdomain}.${var.domain}"
}

output "frontend_url" {
  description = "Frontend URL"
  value       = "https://${var.app_subdomain}.${var.domain}"
}

output "pages_url" {
  description = "Cloudflare Pages default URL"
  value       = "https://${cloudflare_pages_project.cloud_pass_frontend.name}.pages.dev"
}
