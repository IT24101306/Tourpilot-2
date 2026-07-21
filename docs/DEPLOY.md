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
| `ci.yml` | PR + push to `main` | Install, Prisma generate, build shared/api/web |
| `deploy.yml` | Push to `main` | Build Docker images → push GHCR → SSH to VPS → `compose pull && up` |

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

### 2.5.1 DNS

Add an A record for the subdomain (in addition to `@` and `www`):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `dev` | `200.97.168.95` | 300 |

Confirm: `dig +short dev.srilankatourpilot.com` returns the VPS IP.

### 2.5.2 Create the dev folder + env (one-time)

```bash
sudo mkdir -p /var/www/tourpilot-dev
sudo chown $USER:$USER /var/www/tourpilot-dev
git clone -b development https://github.com/IT24101306/Tourpilot-2.git /var/www/tourpilot-dev
cd /var/www/tourpilot-dev
cp .env.development.example .env
nano .env    # set strong DEV passwords + JWT secrets (different from prod)
```

### 2.5.3 Wire the dev domain + TLS (one-time)

```bash
cd /var/www/tourpilot-dev
bash scripts/wire-dev-domain.sh
```

This creates an **isolated** stack (`COMPOSE_PROJECT_NAME=tourpilot-dev`), a
`tourpilot-dev` nginx site pointing `dev.srilankatourpilot.com` → `127.0.0.1:8081`,
and its own Let's Encrypt cert. Your production site is untouched.

> Make sure the **production** nginx site's `server_name` lists only
> `srilankatourpilot.com www.srilankatourpilot.com` (not `dev.`), so the dev
> subdomain is served exclusively by the dev site.

### 2.5.4 GitHub secret for dev

Add one secret (the rest are reused from production):

| Secret | Value |
|--------|--------|
| `DEV_DEPLOY_PATH` | `/var/www/tourpilot-dev` |

### 2.5.5 Deploy dev

Any push to `development` builds `dev`/`dev-<sha>` images and deploys them to the
dev stack automatically:

```bash
git checkout development
git push origin development
```

Manual dev deploy / rebuild on the server:

```bash
cd /var/www/tourpilot-dev
COMPOSE_PROJECT_NAME=tourpilot-dev docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Verify:

```bash
curl -fsS https://dev.srilankatourpilot.com/api/health
```

> Always prefix dev compose commands with `COMPOSE_PROJECT_NAME=tourpilot-dev`
> (or export it) so you never touch production containers/volumes by accident.

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
| Deploy SSH fails | Check `DEPLOY_HOST`, key, `authorized_keys`, firewall port 22 |
| Old UI after deploy | Hard refresh; confirm `BUILD_SHA` in `/api/health` |
| Uploads lost after recreate | Ensure `tourpilot_uploads` volume is mounted (it is in compose) |

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
