# OTP identity provider is built-in to CF Access — no need to create it.

# Optional: Google OAuth
resource "cloudflare_zero_trust_access_identity_provider" "google" {
  count      = var.google_client_id != "" ? 1 : 0
  account_id = var.account_id
  name       = "Google"
  type       = "google"

  config = {
    client_id     = var.google_client_id
    client_secret = var.google_client_secret
  }
}

# Optional: GitHub OAuth
resource "cloudflare_zero_trust_access_identity_provider" "github" {
  count      = var.github_client_id != "" ? 1 : 0
  account_id = var.account_id
  name       = "GitHub"
  type       = "github"

  config = {
    client_id     = var.github_client_id
    client_secret = var.github_client_secret
  }
}

# CF Access Application — protects the app
resource "cloudflare_zero_trust_access_application" "cloud_pass" {
  account_id       = var.account_id
  name             = "Cloud Pass"
  domain           = "${var.app_subdomain}.${var.domain}"
  type             = "self_hosted"
  session_duration = "24h"

  policies = [{
    decision = "allow"
    name     = "Allow authenticated users"
    include  = [{
      everyone = {}
    }]
  }]
}
