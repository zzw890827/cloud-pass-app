resource "cloudflare_d1_database" "cloud_pass_db" {
  account_id = var.account_id
  name       = "cloud-pass-db"

  lifecycle {
    ignore_changes = [read_replication]
  }
}
