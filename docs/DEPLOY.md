# TourPilot — Production deploy (Docker + CI/CD)

This guide takes you from a bare Ubuntu VPS to **automated deploys** on every push to `main`.

## Architecture

```text
Internet
   │
   ▼
 Ubuntu host (80/443)  ── optional: host nginx/Caddy for HTTPS
   │
   ▼
 docker compose (prod)
   ├── web   (nginx SPA)  :80 inside → proxies /api + /uploads
   ├── api   (Node/Express + Prisma)
   └── mysql (persistent volume)
```

Mobile apps (Expo) do **not** run on the server. They call `https://your-domain/api`.

---

## Part 1 — One-time server setup

### 1.1 SSH in and install Docker

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl git

# Docker official install
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# log out and back in so `docker` works without sudo
```

Verify:

```bash
docker --version
docker compose version
```

### 1.2 Clone the repo

```bash
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
cd /var/www
git clone https://github.com/YOUR_USER/Tourpilot-2.git tourpilot
cd tourpilot
```

### 1.3 Create production secrets

```bash
cp .env.production.example .env
nano .env
```

**Must change:**

| Variable | How to generate |
|----------|-----------------|
| `MYSQL_ROOT_PASSWORD` | long random string |
| `MYSQL_PASSWORD` | long random string |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | `openssl rand -hex 32` |
| `WEB_APP_URL` | `https://srilankatourpilot.com` |

**Never commit `.env`.**

### 1.4 First manual deploy (proves Docker works)

```bash
cd /var/www/tourpilot
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Check:

```bash
docker compose -f docker-compose.prod.yml ps
curl -s http://127.0.0.1/api/health
# open http://YOUR_SERVER_IP in a browser
```

Optional seed (once) — production starts with **empty tables** (`db push` only):

```bash
cd /var/www/tourpilot   # or your DEPLOY_PATH
docker compose -f docker-compose.prod.yml --env-file .env exec api npx tsx prisma/seed.ts
# full demo dataset:
# docker compose -f docker-compose.prod.yml --env-file .env exec api npx tsx prisma/seed-demo.ts
```

Default admin after `seed.ts`: phone `+94779998888` / password `admin123` (override with `ADMIN_SEED_PASSWORD`).

### 1.5 Point domain + HTTPS (srilankatourpilot.com)

**DNS (at your registrar — Hostinger, Cloudflare, etc.)**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `200.97.168.95` | 300 |
| A | `www` | `200.97.168.95` | 300 |

Wait until `dig +short srilankatourpilot.com` returns the VPS IP.

**Option A — Host nginx + Certbot (common on Hostinger VPS)**

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Set Docker web off port 80 so host nginx can terminate TLS. In `/var/www/tourpilot/.env`:

```bash
WEB_APP_URL=https://srilankatourpilot.com
HTTP_PORT=8080
```

Recreate web so it binds 8080:

```bash
cd /var/www/tourpilot
docker compose -f docker-compose.prod.yml --env-file .env up -d web
```

`/etc/nginx/sites-available/tourpilot`:

```nginx
server {
  listen 80;
  server_name srilankatourpilot.com www.srilankatourpilot.com;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 25m;
  }
}
```

Keep `client_max_body_size 25m;` — the default (1m) causes upload failures (HTTP 413).

If uploads fail with permission / “not writable”, fix the volume once:

```bash
docker compose -f docker-compose.prod.yml --env-file .env exec -u root api \
  chown -R tourpilot:tourpilot /app/apps/api/uploads
```

```bash
sudo ln -sf /etc/nginx/sites-available/tourpilot /etc/nginx/sites-enabled/
# remove default site if it conflicts:
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d srilankatourpilot.com -d www.srilankatourpilot.com
```

Set `WEB_APP_URL=https://srilankatourpilot.com` in `.env` and recreate api (email/notification links):

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

In Admin → **Platform settings**, set Public site URL to `https://srilankatourpilot.com` as well (overrides env when set).

Verify:

```bash
curl -fsS https://srilankatourpilot.com/api/health
curl -fsS https://www.srilankatourpilot.com/api/health
```

---

## Part 2 — CI/CD with GitHub Actions

### What the pipelines do

| Workflow | When | What |
|----------|------|------|
| `ci.yml` | PR + push to `main` or `development` | Install, Prisma generate, build shared/api/web |
| `deploy.yml` | Push to `main` | Build → GHCR → deploy on VPS (**self-hosted** when `DEPLOY_USE_SELF_HOSTED=true`, else SSH) |
| `deploy-dev.yml` | Push to `development` | Same for `dev` / `dev-<sha>` tags → `/var/www/tourpilot-dev` |

**Database schema (automatic):** each API container start runs `prisma db push` via [`docker/api-entrypoint.sh`](../docker/api-entrypoint.sh). GitHub deploys force-recreate the API so the new schema always applies before health checks pass. Default is `PRISMA_ACCEPT_DATA_LOSS=true` (set `false` in `.env` to refuse destructive changes).

### 2.1 GitHub Container Registry

Images will be:

- `ghcr.io/<your-github-user>/tourpilot-api`
- `ghcr.io/<your-github-user>/tourpilot-web`

Make packages public (or grant the server a pull token).

### 2.2 Create a pull token for the server

1. GitHub → Settings → Developer settings → Personal access tokens  
2. Create a token with `read:packages`  
3. On the server (optional test):

```bash
echo YOUR_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
```

### 2.3 Add GitHub Actions secrets

Repo → **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|--------|
| `DEPLOY_HOST` | VPS IP or hostname |
| `DEPLOY_USER` | e.g. `deploy` or `ubuntu` |
| `DEPLOY_SSH_KEY` | **Private** SSH key (full PEM) |
| `DEPLOY_PORT` | `22` (optional; digits only — no trailing newline/space) |
| `DEPLOY_PATH` | `/var/www/tourpilot` |
| `DEV_DEPLOY_PATH` | `/var/www/tourpilot-dev` (required for `deploy-dev.yml`) |
| `GHCR_PULL_USER` | your GitHub username |
| `GHCR_PULL_TOKEN` | PAT with `read:packages` |

### 2.4 Deploy SSH key on the server

On your laptop:

```bash
ssh-keygen -t ed25519 -C "tourpilot-deploy" -f tourpilot_deploy -N ""
```

On server:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Put the **private** key contents into `DEPLOY_SSH_KEY`.

### 2.5 Ensure compose on server uses GHCR images

In server `.env` you can leave `API_IMAGE` / `WEB_IMAGE` unset — the deploy script exports them.

Keep `docker-compose.prod.yml` and `.env` on the server. After the first clone, updates come from image pulls (code is inside images). Optionally still `git pull` for compose file changes:

```bash
cd /var/www/tourpilot && git pull
```

Or include `git pull` in the deploy script (already runs in repo path).

### 2.6 Trigger deploy

```bash
git add .
git commit -m "Add Docker production stack and CI/CD"
git push origin main
```

Watch: GitHub → **Actions**.

---

## Part 2.5 — Separate dev environment (dev.srilankatourpilot.com)

Production (`main` → `srilankatourpilot.com`) and dev (`development` →
`dev.srilankatourpilot.com`) run as **two isolated Docker stacks on the same VPS**.
Each has its own folder, containers, network, MySQL volume, and uploads — nothing
is shared.

| | Production | Development |
|---|---|---|
| Folder | `/var/www/tourpilot` | `/var/www/tourpilot-dev` |
| Branch | `main` | `development` |
| Domain | `srilankatourpilot.com` (+`www`) | `dev.srilankatourpilot.com` |
| Web port (Docker) | `8080` | `8081` |
| MySQL host port | `3307` | `3308` |
| Compose project | `tourpilot` | `tourpilot-dev` |
| Workflow | `deploy.yml` | `deploy-dev.yml` |
| Image tags (GHCR) | `latest`, `<sha>` | `dev`, `dev-<sha>` |

> **Never-touch-prod rule:** always prefix DEV compose with
> `COMPOSE_PROJECT_NAME=tourpilot-dev`. Never run seed scripts in `/var/www/tourpilot`.

### 2.5.0 Diagnose who owns ports 80/443 (do this first)

SSH to the VPS:

```bash
cd /var/www/tourpilot   # or wherever the repo is
bash scripts/diagnose-edge.sh
```

Or manually:

```bash
sudo ss -tlnp | grep -E ':80|:443'
systemctl is-active nginx || true
docker ps --format 'table {{.Names}}\t{{.Ports}}' | grep -Ei 'caddy|web|api'
```

| Verdict | Meaning | Wire DEV with |
|---------|---------|---------------|
| Host nginx on 80/443 | Path A | `bash scripts/wire-dev-domain.sh` |
| Caddy container on 80/443 | Path B | `bash scripts/wire-dev-via-caddy.sh` |
| Both | Conflict — stop one | Fix before continuing |

### 2.5.1 DNS

Add an A record for the subdomain (in addition to `@` and `www`):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `dev` | `200.97.168.95` | 300 |

Confirm: `dig +short dev.srilankatourpilot.com` returns the VPS IP.

### 2.5.2 Create the DEV stack + separate DB + demo seed (one-time)

**Why the DB is separate:** Compose project name `tourpilot-dev` prefixes Docker
volumes (`tourpilot-dev_tourpilot_mysql_data`). Production keeps
`tourpilot_mysql_data` on host port `3307`. DEV uses `3308`. Same internal DB
name `tourpilot`, different volume — no shared data.

Easiest path (generates secrets, starts stack, seeds demo):

```bash
# Prefer running the script from a checkout that already has the new scripts
# (e.g. after git pull on prod, or clone development first).
bash /var/www/tourpilot/scripts/bootstrap-dev-stack.sh
# or, after clone:
# cd /var/www/tourpilot-dev && bash scripts/bootstrap-dev-stack.sh
```

Manual equivalent:

```bash
sudo mkdir -p /var/www/tourpilot-dev
sudo chown $USER:$USER /var/www/tourpilot-dev
git clone -b development https://github.com/IT24101306/Tourpilot-2.git /var/www/tourpilot-dev
cd /var/www/tourpilot-dev
cp .env.development.example .env
nano .env    # strong DEV passwords + JWT (never copy prod secrets)

export COMPOSE_PROJECT_NAME=tourpilot-dev
docker compose -f docker-compose.prod.yml --env-file .env up -d

# Seed DEMO data into DEV only
COMPOSE_PROJECT_NAME=tourpilot-dev docker compose -f docker-compose.prod.yml --env-file .env \
  exec api npx tsx prisma/seed-demo.ts
```

Demo agency phone after seed: `+94771234567` (OTP shown in UI/logs on DEV).

### 2.5.3 Wire the DEV domain + TLS (one-time)

**Path A — host Nginx owns 80/443**

```bash
cd /var/www/tourpilot-dev
bash scripts/wire-dev-domain.sh
```

Creates `/etc/nginx/sites-available/tourpilot-dev` → `127.0.0.1:8081` and a
Certbot cert for `dev.srilankatourpilot.com` only. Confirm production nginx
`server_name` lists only apex + `www` (not `dev.`).

**Path B — Caddy owns 80/443**

Do **not** run `wire-dev-domain.sh` (it will exit and point you here). Production
Caddy already has an explicit site block `dev.{$PLATFORM_DOMAIN}` that
reverse-proxies to `DEV_UPSTREAM` (default `172.17.0.1:8081`).

```bash
# Ensure prod .env has USE_CADDY_EDGE=true and DEV_UPSTREAM=172.17.0.1:8081
# (wire-caddy.sh sets these). Then:
cd /var/www/tourpilot
git pull   # pick up updated docker/Caddyfile
bash scripts/wire-dev-via-caddy.sh
```

Agency custom domains stay on Caddy On-Demand TLS; `dev.` is a fixed platform site.

### 2.5.4 Sync the `development` branch (so the pipeline exists)

GitHub Actions only runs workflow files that exist **on the branch you push**.
`deploy-dev.yml` must be on `development`:

```bash
git fetch origin
git checkout development
git merge main
git push origin development
```

### 2.5.5 GitHub secret for DEV

| Secret | Value |
|--------|--------|
| `DEV_DEPLOY_PATH` | `/var/www/tourpilot-dev` |

Other secrets (`DEPLOY_HOST`, SSH key, `GHCR_*`) are shared with production.

### 2.5.6 Deploy DEV (ongoing)

Any push to `development` builds `dev`/`dev-<sha>` images and deploys them:

```bash
git checkout development
git push origin development
```

Manual rebuild on the server:

```bash
cd /var/www/tourpilot-dev
COMPOSE_PROJECT_NAME=tourpilot-dev docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Verify isolation + health:

```bash
docker ps --format 'table {{.Names}}\t{{.Ports}}' | grep -E 'tourpilot|8080|8081|3307|3308'
curl -fsS https://srilankatourpilot.com/api/health
curl -fsS https://dev.srilankatourpilot.com/api/health
```

### 2.5.7 Daily workflow

```bash
# Feature work → test on DEV
git checkout development
# ... code ...
git push origin development          # Actions → Deploy (dev)

# Promote to PROD when ready
git checkout main
git merge development
git push origin main                 # Actions → Deploy (production)
```

Ignore the stale local branch name `develop` if present — official branch is
**`development`**.

---

## Part 2.7 — Custom domains for agencies (Caddy On-Demand TLS)

Agencies can serve their storefront on their own domain (e.g. `myagency.com`),
Shopify-style. This uses a **Caddy** edge container that issues HTTPS
certificates automatically, including for agency domains via On-Demand TLS.
Caddy asks the API (`GET /api/tls/check?domain=...`) before issuing a
certificate, so it only ever issues for the platform domain and verified,
active agency domains.

```text
Internet :80/:443
   │
   ▼
 Caddy (edge, auto-HTTPS + On-Demand TLS)   ── ask → API /api/tls/check
   │  reverse_proxy
   ▼
 web (nginx SPA)  →  api (:4000)
```

### 2.7.1 One-time: switch the edge to Caddy

This replaces the host nginx + certbot setup from Part 1.5. Caddy binds 80/443,
so the web container moves to `HTTP_PORT=8080` (internal proxy target).

```bash
cd /var/www/tourpilot
# Set CADDY_EMAIL / CUSTOM_DOMAIN_A_TARGET as needed (see .env.production.example)
bash scripts/wire-caddy.sh
```

The script updates `.env` (`PLATFORM_DOMAIN`, `PLATFORM_DOMAINS`, `CADDY_EMAIL`,
`CUSTOM_DOMAIN_A_TARGET`, `HTTP_PORT=8080`), stops host nginx, and brings the
stack up with the edge profile:

```bash
docker compose -f docker-compose.prod.yml --env-file .env --profile edge up -d
```

Caddy obtains the platform certificate automatically. Verify:

```bash
curl -fsS https://srilankatourpilot.com/api/health
```

### 2.7.2 Enable the feature for an agency

Admin → Users (or Agencies) → the agency's feature toggles → enable
**Custom domain**. The agency then sees a **Domain** tab in their dashboard.

### 2.7.3 What the agency does

1. In the dashboard **Domain** tab, enter their domain (e.g. `myagency.com`).
2. At their domain registrar, add the DNS record shown:
   - `A` record: host `@` → the server IP (`CUSTOM_DOMAIN_A_TARGET`).
   - Optional `CNAME` record: host `www` → the platform domain.
3. Click **Verify DNS**. Once it resolves to the server, the status becomes
   **Live**. On the first HTTPS visit, Caddy issues the certificate
   automatically (may take a few seconds the first time).

Apex domains cannot use CNAME, so the A record is the primary instruction; `www`
can use CNAME. DNS propagation can take minutes to hours.

---

## Part 2.8 — Fully custom (headless) websites

Some revenue packages include a **separately coded website** that still uses
TourPilot as the backend (tours, OTP login, inquiries). That is different from
Part 2.7 Custom Domain (which serves the TourPilot SPA on the client hostname).

| Product | DNS points to | Frontend |
|---------|---------------|----------|
| Custom domain (2.7) | TourPilot Caddy / VPS | TourPilot SPA |
| Headless custom site (2.8) | Client site host (Vercel, etc.) | Your coded site |

**Do not** enable both for the same hostname.

Full API contract, CORS, OTP, inquire, and delivery checklist:
[docs/HEADLESS.md](HEADLESS.md).

Starter: [examples/headless-agency-site](../examples/headless-agency-site).

Ops summary:

1. Admin → Features → enable **External / headless website** for the agency.
2. Build/adapt the starter with `API_BASE` + `AGENCY_SLUG`.
3. Point the client domain at the **custom site** host.
4. If using a CORS allowlist, add the site origin to `HEADLESS_CORS_ORIGINS` and recreate API.
5. Smoke-test: list tours → OTP → create inquiry → agency sees it in the dashboard.

---

## Part 3 — Day-to-day operations

### Useful commands

```bash
cd /var/www/tourpilot

# Status
docker compose -f docker-compose.prod.yml ps

# Logs
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web

# Restart
docker compose -f docker-compose.prod.yml --env-file .env restart api

# Rebuild from local files (no CI)
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

### Remote MySQL from your PC (recommended: SSH tunnel)

MySQL is bound to **127.0.0.1 on the VPS only** (`MYSQL_HOST_PORT`, default `3306`). Do **not** open port 3306 in the firewall.

**1. On the VPS** — after deploy, MySQL is on **localhost:3307** by default (avoids host MySQL on 3306).

Optional in server `.env`: `MYSQL_HOST_PORT=3307`

**2. On your Windows PC** — open a tunnel (keep this window open):

```powershell
ssh -L 3307:127.0.0.1:3307 YOUR_SSH_USER@YOUR_VPS_IP
```

(Left `3307` = port on your PC; right `3307` = MySQL on the VPS localhost.)

**3. Connect from MySQL Workbench / DBeaver / VS Code:**

| Field | Value |
|--------|--------|
| Host | `127.0.0.1` |
| Port | `3307` |
| User | `tourpilot` (or `root`) |
| Password | from VPS `.env` → `MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD` |
| Database | `tourpilot` |

### Backups (do this)

```bash
# DB dump
docker compose -f docker-compose.prod.yml exec -T mysql \
  mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" tourpilot > backup-$(date +%F).sql

# Uploads volume
docker run --rm -v tourpilot_tourpilot_uploads:/data -v "$PWD":/backup alpine \
  tar czf /backup/uploads-$(date +%F).tgz -C /data .
```

Schedule with `cron` weekly.

### Production checklist

- [ ] `NODE_ENV=production` (set in compose)
- [ ] Strong JWT + DB passwords
- [ ] `DEV_BYPASS_OTP=false` (compose forces this)
- [ ] HTTPS + `WEB_APP_URL=https://...`
- [ ] Firewall: only 22, 80, 443 open (`ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable`)
- [ ] Backups for MySQL + uploads
- [ ] Real email (`EMAIL_MODE=smtp` or webhook) when you need OTP/notifications off console
- [ ] Mobile apps point to `https://your-domain/api`

---

## Part 4 — Mental model (how CI/CD works)

```text
You push to main
        │
        ▼
 GitHub Actions CI   →  does the app still build?
        │
        ▼
 Build Docker images →  push to ghcr.io
        │
        ▼
 SSH into Ubuntu     →  docker login → pull → compose up
        │
        ▼
 Live site updated   →  curl /api/health
```

You no longer SSH and run `npm run build` by hand for every change.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| 502 / blank error | `docker compose ... logs api` — often DB not ready or bad `DATABASE_URL` |
| Images won’t pull | GHCR login / package visibility / wrong owner name (must be lowercase) |
| Deploy SSH fails (`dial tcp … i/o timeout`) | **Cause:** GitHub cloud runners cannot open TCP to your VPS (firewall, fail2ban, provider filtering, or flaky route). Retries only mask it. **Permanent fix:** install a [self-hosted runner](#permanent-fix-self-hosted-runner) on the VPS, then set repo variable `DEPLOY_USE_SELF_HOSTED=true`. Temporary: ensure port 22 is open to the internet (key-only auth) and check fail2ban bans. |
| Old UI after deploy | Hard refresh; confirm `BUILD_SHA` in `/api/health` |
| Uploads lost after recreate | Ensure `tourpilot_uploads` volume is mounted (it is in compose) |

### Permanent fix: self-hosted runner

GitHub’s `ubuntu-latest` runners live on changing public IPs. Your VPS (or fail2ban / cloud firewall) often drops or rate-limits that traffic → **`dial tcp … i/o timeout`**. Whitelisting GitHub IPs is brittle; raising SSH `timeout` does not help if the port never answers.

**Solution:** build images in the cloud (unchanged), run the **deploy job on the VPS** via a self-hosted Actions runner. No inbound SSH from GitHub is required for deploys.

1. On the VPS (as the deploy user that can run `docker`):

```bash
cd /var/www/tourpilot   # or wherever the repo lives
git pull

# GitHub → Settings → Actions → Runners → New self-hosted runner → copy token
export GITHUB_REPO_URL="https://github.com/OWNER/TourPilot"
export RUNNER_TOKEN="AAAA..."   # from that page (expires quickly)
bash scripts/setup-github-actions-runner.sh
```

2. Confirm the runner shows **Idle** under Actions → Runners, with labels `self-hosted`, `linux`, `tourpilot`.

3. Repo → **Settings → Variables → Actions** → create **`DEPLOY_USE_SELF_HOSTED`** = `true`.

4. Optionally lock down SSH to your laptop IP only — CI no longer needs port 22 open to the world.

Until that variable is set, workflows keep using SSH (with a port probe). Remove `DEPLOY_USE_SELF_HOSTED` only if you must fall back to SSH.

---

## Local Docker (optional)

MySQL only for local dev (existing):

```bash
docker compose up -d
# then npm run dev on the host
```

Full stack locally:

```bash
cp .env.production.example .env.local.docker
# set passwords + WEB_APP_URL=http://localhost
docker compose -f docker-compose.prod.yml --env-file .env.local.docker up -d --build
```
