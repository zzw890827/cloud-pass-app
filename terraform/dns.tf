# DNS record for the API worker
resource "cloudflare_dns_record" "api" {
  zone_id = var.zone_id
  name    = var.api_subdomain
  content = "100::"
  type    = "AAAA"
  ttl     = 1
  proxied = true
}

# DNS record for the frontend (Pages custom domain)
resource "cloudflare_dns_record" "frontend" {
  zone_id = var.zone_id
  name    = var.app_subdomain
  content = "${cloudflare_pages_project.cloud_pass_frontend.name}.pages.dev"
  type    = "CNAME"
  ttl     = 1
  proxied = true
}
