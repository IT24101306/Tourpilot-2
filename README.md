# TourPilot — Sri Lanka Tourism Platform

PERN stack (PostgreSQL replaced with **MySQL**) + React web + Expo mobile scaffold.

## Stack

| Layer | Tech |
|-------|------|
| API | Node, Express, TypeScript, Prisma |
| DB | MySQL 8 |
| Web | React 19, Vite, React Router |
| Mobile | Expo (React Native) |
| Design | Ported from `design-reference/` HTML (Manrope, Syne, green theme) |

## Quick start

### 1. MySQL

```bash
docker compose up -d
```

### 2. Install & database

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run db:push
npm run db:seed
npm run db:seed:demo   # optional: full demo data for all tables
```

### 3. Run

```bash
npm run dev
```

- Web: http://localhost:5173  
- API: http://localhost:4000  

## Demo accounts (after seed)

| Role | Phone | Notes |
|------|-------|-------|
| Admin | +94779998888 | Password login (default seed password: `admin123`) |
| Agency | +94771234567 | Wallet LKR 500, agency `ceylon-trails` (LANKA TOUR TRAILS) |
| Tourist | +94771112233 | Inquiries, offers |
| Influencer | +94774445566 | Ref code `ISLAND10` |
| Driver | +94776655443 | Driver dashboard (OTP login) |

Phones are stored in international format (E.164, e.g. `+94771234567`). Use the same country code and number when logging in.

### OTP in local dev

| Mode | `.env` | What to enter |
|------|--------|----------------|
| **Bypass (easiest)** | `DEV_BYPASS_OTP=true` | Always **`000000`** after Send OTP |
| **Demo** | `DEMO_OTP_IN_RESPONSE=true` | OTP shown in green box on login screen |

Bypass only works when `NODE_ENV` is not `production`.

With `LOG_OTP_TO_CONSOLE=true` (default in dev), each OTP is printed in the **API terminal** when you click Send OTP.

Admin password can be set via `ADMIN_SEED_PASSWORD` when running `npm run db:seed` (default `admin123`).

### Email (optional)

Copy `apps/api/.env.example` and configure:

| Mode | Env | Behavior |
|------|-----|----------|
| **log** (default) | `EMAIL_MODE=log` | Prints to API console |
| **webhook** | `EMAIL_MODE=webhook` + `EMAIL_WEBHOOK_URL` | POST JSON to your provider |
| **smtp** | `EMAIL_MODE=smtp` + `SMTP_*` | Sends via SMTP |

Set `WEB_APP_URL` for correct links in inquiry/commission emails. OTP stays in dev mode (`DEV_BYPASS_OTP`); no SMS provider required locally.

### Demo dataset

`npm run db:seed:demo` fills **every** Prisma table with demo rows (users, agencies, tours, inquiries, offers, OTP challenges, refresh tokens, etc.). Safe to re-run — prints a row-count checklist when finished. Extra logins include `+94773334400` (Wild Coast agency), `+94778889900` (rejected agency), and `+94774445500` (tourist).

## Project structure

```
apps/api          Express API + Prisma
apps/web          React frontend (TourPilot theme)
apps/mobile       Expo app (shared API)
design-reference  Original HTML prototypes
packages/shared   Shared types & constants
```

## Phase 1 features

- Phone + OTP auth (per-login fee by role)
- Public agency pages & ready-made tours (prices visible)
- Tourist inquiries (custom + ready-made)
- Agency: entities, groups, itineraries with optional line items + totals
- Influencer referral codes & commissions
- Loyalty offers with caps & countdown
- Admin: agency approval, CMS hooks
- Shareable itinerary links

## Mobile

```bash
npm run dev:mobile
```

Set `EXPO_PUBLIC_API_URL` to your machine IP (see `apps/mobile/.env.example`).
