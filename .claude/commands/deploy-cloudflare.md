Guide the user through deploying Cloud Pass to Cloudflare. This is an interactive deployment — ask the user for required information at each stage.

## Step 1: Collect deployment information

Ask the user for the following values (all required unless marked optional):

- **Cloudflare API token** — with Workers Scripts, D1, DNS, and Access permissions
- **Account ID** — from Cloudflare dashboard
- **Zone ID** — from Cloudflare dashboard
- **Domain** — base domain (e.g., `example.com`)
- **API subdomain** — default: `api`
- **App subdomain** — default: `cloudpass`
- **Cloudflare Access team domain** — the team name from Zero Trust dashboard
- **Admin email** — the email address for the first admin user
- **Google OAuth client ID & secret** (optional) — leave empty for OTP-only auth
- **GitHub OAuth client ID & secret** (optional) — leave empty for OTP-only auth

## Step 2: Terraform — Provision infrastructure

Create `terraform/terraform.tfvars` from the collected values:

```hcl
cloudflare_api_token = "<api_token>"
account_id           = "<account_id>"
zone_id              = "<zone_id>"
domain               = "<domain>"
api_subdomain        = "<api_subdomain>"
app_subdomain        = "<app_subdomain>"
cf_team_domain       = "<team_domain>"
google_client_id     = "<google_client_id or empty>"
google_client_secret = "<google_client_secret or empty>"
github_client_id     = "<github_client_id or empty>"
github_client_secret = "<github_client_secret or empty>"
```

Then run:

```bash
cd terraform
terraform init
terraform plan
```

Show the plan output to the user and **ask for confirmation** before running `terraform apply`.

After apply, capture the **D1 database ID** from the terraform output (`d1_database_id`).

## Step 3: Configure Workers API

Update `workers-api/wrangler.toml`:

1. Under `[env.production.d1_databases]`, set `database_id` to the D1 database ID from terraform output
2. Under `[env.production.vars]`, set `CF_TEAM_DOMAIN` to the user's team domain
3. Under `[env.production.vars]`, set `DEV_MODE` to `"false"`

## Step 4: Configure Frontend

Update `frontend/wrangler.jsonc`:

1. Set `route` to `<app_subdomain>.<domain>/*`
2. Set `zone_name` to `<domain>`

## Step 5: Deploy Workers API

```bash
cd workers-api
npm install
npx wrangler d1 migrations apply CLOUD_PASS_DB --remote --env production
npx wrangler deploy --env production
```

## Step 6: Deploy Frontend

```bash
cd frontend
bun install
NEXT_PUBLIC_API_URL=https://<api_subdomain>.<domain>/api/v1 bun run deploy
```

## Step 7: Create admin user in production

```bash
cd workers-api
npx wrangler d1 execute CLOUD_PASS_DB --remote --env production \
  --command "INSERT OR IGNORE INTO users (email, display_name, is_admin) VALUES ('<admin_email>', 'Admin', 1);"
```

## Step 8: Verify deployment

Tell the user:

> Deployment complete! Your Cloud Pass instance is live:
>
> - **App**: https://<app_subdomain>.<domain>
> - **API**: https://<api_subdomain>.<domain>/api/v1
>
> On first visit, Cloudflare Access will prompt for authentication (OTP sent to your email).

## Important notes

- Always ask for user confirmation before running `terraform apply`
- If any step fails, diagnose the error and suggest a fix before continuing
- Never store the API token in any file other than `terraform.tfvars` (which is gitignored)
- The `wrangler.toml` and `wrangler.jsonc` changes should be committed to the repo
