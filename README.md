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
| Admin | 0779998888 | CMS, approvals |
| Agency | 0771234567 | Wallet LKR 500, agency `ceylon-trails` |
| Tourist | 0771112233 | Inquiries, offers |
| Influencer | 0774445566 | Ref code `ISLAND10` |

### OTP in local dev

| Mode | `.env` | What to enter |
|------|--------|----------------|
| **Bypass (easiest)** | `DEV_BYPASS_OTP=true` | Always **`000000`** after Send OTP |
| **Demo** | `DEMO_OTP_IN_RESPONSE=true` | OTP shown in green box on login screen |

Bypass only works when `NODE_ENV` is not `production`.

With `LOG_OTP_TO_CONSOLE=true` (default in dev), each OTP is printed in the **API terminal** when you click Send OTP.

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
