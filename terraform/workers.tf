# Workers scripts are deployed via wrangler in CI — not managed by Terraform.
# Terraform only manages the route to avoid overwriting deployed code.

resource "cloudflare_workers_route" "api_route" {
  zone_id = var.zone_id
  pattern = "${var.api_subdomain}.${var.domain}/*"
  script  = "cloud-pass-api"
}
