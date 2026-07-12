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
| `WEB_APP_URL` | `https://your-domain.com` |

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

Optional seed (once):

```bash
docker compose -f docker-compose.prod.yml exec api npx tsx prisma/seed.ts
# or demo:
# docker compose -f docker-compose.prod.yml exec api npx tsx prisma/seed-demo.ts
```

> Seed needs `tsx` in the image. If missing, run seed from a one-off container or temporarily enable it. Prefer creating the admin via seed on first boot only.

### 1.5 Point domain + HTTPS (recommended)

**Option A — Host nginx + Certbot (common on Hostinger VPS)**

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/tourpilot`:

```nginx
server {
  listen 80;
  server_name tourism.example.com;

  location / {
    proxy_pass http://127.0.0.1:80;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 25m;
  }
}
```

If host nginx and Docker both want port 80, change compose:

```env
HTTP_PORT=8080
```

Then `proxy_pass http://127.0.0.1:8080;`

```bash
sudo ln -s /etc/nginx/sites-available/tourpilot /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d tourism.example.com
```

Set `WEB_APP_URL=https://tourism.example.com` in `.env` and recreate api:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d
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
