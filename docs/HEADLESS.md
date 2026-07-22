# Headless custom websites (TourPilot backend)

Use this when a client buys a **fully custom website** package: you code a
separate frontend, host it on **their** domain, and wire it to TourPilot APIs.
Agency staff still operate tours, inquiries, and wallet inside the TourPilot
dashboard.

> This is **not** the [Custom Domain](DEPLOY.md) feature (Shopify-style SPA on
> `myagency.com`). Do **not** point the same hostname at both Caddy and the
> custom site host.

## Architecture

```text
Traveler → custom site (Vercel / Netlify / client VPS)
                │
                │  HTTPS fetch + Bearer JWT
                ▼
         TourPilot API  (/api/…)
                │
                ▼
         MySQL (tours, inquiries, users, …)

Agency staff → TourPilot dashboard (srilankatourpilot.com)
```

## Entitlement

Admin → Users/Agencies → **Features** → enable **External / headless website**
(`featureExternalStorefront`).

Bootstrap:

```http
GET /api/agencies/:slug/headless-config
```

Response includes `entitled` (must be `true` for the paid package), `apiBase`,
`webAppUrl`, `features`, `endpoints`, and `tripRoomUrlTemplate`.

## Environments

| Env | API / web base |
|-----|----------------|
| Production | `https://srilankatourpilot.com/api` |
| Development | `https://dev.srilankatourpilot.com/api` |
| Local API | `http://localhost:4000/api` (or whatever you run) |

Custom sites must call the **absolute** API URL (not relative `/api`).

## CORS

Until you set an allowlist, the API accepts any browser origin (backward compatible).

When either `CORS_ORIGINS` or `HEADLESS_CORS_ORIGINS` is set (or `CORS_STRICT=true`),
only listed origins are allowed. `WEB_APP_URL` and `http://localhost:5173` are
always included in the allowlist builder.

Example production `.env`:

```bash
CORS_ORIGINS=https://srilankatourpilot.com,https://dev.srilankatourpilot.com
HEADLESS_CORS_ORIGINS=https://www.client-agency.com,https://client-agency.com
```

Then recreate the API container so env is picked up.

## Public browse (no auth)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/agencies/:slug` | Agency + published tours + display + `features` |
| GET | `/api/agencies/:slug/headless-config` | Bootstrap for headless sites |
| GET | `/api/tours/public/:agencySlug/:tourSlug` | Tour detail |
| GET | `/api/entities/public/:agencySlug` | Entity catalog |
| GET | `/api/offers/active` | Active offers |

Gate CTAs using `features` from the agency payload (e.g. hide inquire when
`customInquiries` / `readyMadeTours` is false).

### Example

```js
const API = "https://srilankatourpilot.com/api";
const slug = "ceylon-trails";

const agency = await fetch(`${API}/agencies/${slug}`).then((r) => r.json());
console.log(agency.name, agency.tours?.length, agency.features);
```

## Auth (OTP on the custom site)

Tourists must be TourPilot users (role `TOURIST`). Implement OTP in your UI.

### Login

1. `POST /api/auth/login-start` `{ "phone": "+9477…" }`
2. Show OTP (on DEV, OTP may appear in the JSON response / API logs)
3. `POST /api/auth/verify-otp` `{ "challengeId", "phone", "otp" }`
4. Store `token` from the response; send `Authorization: Bearer <token>` afterward

### Register (new tourist)

1. `POST /api/auth/register-request` `{ "phone", "name", "role": "TOURIST" }`
2. `POST /api/auth/verify-registration` `{ "challengeId", "phone", "otp", … }`
3. Then login as above if needed

### Session

```http
GET /api/auth/me
Authorization: Bearer <token>
```

## Create an inquiry

Requires tourist JWT. Agency must be approved and the matching feature flag on.

```http
POST /api/inquiries
Authorization: Bearer <token>
Content-Type: application/json

{
  "agencyId": "<from agency payload>",
  "tourId": "<optional ready-made tour id>",
  "type": "READY_MADE",
  "pax": 2,
  "startDate": "2026-08-01",
  "email": "guest@example.com",
  "message": "We want this package for 2 adults."
}
```

`type`: `READY_MADE` | `CUSTOM`. Custom / `tripPlan` requires `features.customInquiries`.

On success, deep-link the traveler into TourPilot trip room (v1):

```text
https://srilankatourpilot.com/trips?room=<inquiryId>
```

(`tripRoomUrlTemplate` from headless-config — replace `{inquiryId}`.)

Agency replies and negotiation stay in the TourPilot dashboard / trip room.

## Package delivery checklist

1. Create/approve the agency in TourPilot; publish tours/entities in the dashboard.
2. Admin: enable **External / headless website** (+ inquire/tours flags as sold).
3. Clone [`examples/headless-agency-site`](../examples/headless-agency-site); set `API_BASE` + `AGENCY_SLUG`.
4. Design/brand the site; keep API wiring.
5. Deploy the custom site; point the **client domain DNS** to that host (not TourPilot Caddy).
6. Add the site origin to `HEADLESS_CORS_ORIGINS` if using a CORS allowlist; recreate API.
7. Smoke-test: list tours → OTP login → create inquiry → agency sees it in dashboard.
8. Do **not** enable TourPilot **Custom domain** for the same hostname.

## Starter

See [`examples/headless-agency-site/README.md`](../examples/headless-agency-site/README.md).

## Phase 2 (not in v1)

- Agency API keys
- Anonymous lead / inquire-lite without OTP
- Webhooks for inquiry status
- Full trip-room UI embedded in the custom site
