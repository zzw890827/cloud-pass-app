resource "cloudflare_workers_script" "cloud_pass_api" {
  account_id  = var.account_id
  script_name = "cloud-pass-api"

  # Placeholder content — real code deployed via wrangler
  content     = "export default { fetch() { return new Response('Deploy via wrangler') } }"
  main_module = "index.js"

  bindings = [
    {
      name = "CLOUD_PASS_DB"
      type = "d1"
      id   = cloudflare_d1_database.cloud_pass_db.id
    },
    {
      name = "DEV_MODE"
      type = "plain_text"
      text = "false"
    },
    {
      name = "CF_TEAM_DOMAIN"
      type = "plain_text"
      text = var.cf_team_domain
    }
  ]
}

resource "cloudflare_workers_route" "api_route" {
  zone_id = var.zone_id
  pattern = "${var.api_subdomain}.${var.domain}/*"
  script  = cloudflare_workers_script.cloud_pass_api.script_name
}
