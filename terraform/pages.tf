resource "cloudflare_pages_project" "cloud_pass_frontend" {
  account_id = var.account_id
  name       = "cloud-pass"

  production_branch = "main"

  build_config = {
    build_command   = "cd frontend && bun install && bun run build"
    destination_dir = "frontend/.next/standalone"
  }
}
