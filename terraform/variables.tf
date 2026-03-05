variable "cloudflare_api_token" {
  description = "Cloudflare API token with appropriate permissions"
  type        = string
  sensitive   = true
}

variable "account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "zone_id" {
  description = "Cloudflare zone ID for the domain"
  type        = string
}

variable "domain" {
  description = "Base domain (e.g., example.com)"
  type        = string
}

variable "api_subdomain" {
  description = "Subdomain for the API worker (e.g., api)"
  type        = string
  default     = "api"
}

variable "app_subdomain" {
  description = "Subdomain for the frontend (e.g., cloudpass)"
  type        = string
  default     = "cloudpass"
}

variable "cf_team_domain" {
  description = "Cloudflare Access team domain (the part before .cloudflareaccess.com)"
  type        = string
}

variable "google_client_id" {
  description = "Google OAuth client ID for CF Access"
  type        = string
  default     = ""
}

variable "google_client_secret" {
  description = "Google OAuth client secret for CF Access"
  type        = string
  sensitive   = true
  default     = ""
}

variable "github_client_id" {
  description = "GitHub OAuth client ID for CF Access"
  type        = string
  default     = ""
}

variable "github_client_secret" {
  description = "GitHub OAuth client secret for CF Access"
  type        = string
  sensitive   = true
  default     = ""
}
