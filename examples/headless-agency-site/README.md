# Headless agency site starter

Minimal static site that talks to the TourPilot API for one agency.

## Setup

1. Copy `.env.example` to `.env` and set values (or edit `config.js` directly).
2. Serve the folder with any static server, e.g.:

```bash
npx --yes serve -l 4173 .
```

3. If the API uses a CORS allowlist, add `http://localhost:4173` to
   `HEADLESS_CORS_ORIGINS` on the API and recreate the API container.
4. In TourPilot admin, enable **External / headless website** for that agency.

## Env / config

| Variable | Example |
|----------|---------|
| `API_BASE` | `https://dev.srilankatourpilot.com/api` |
| `AGENCY_SLUG` | `ceylon-trails` |
| `WEB_APP_URL` | `https://dev.srilankatourpilot.com` |

Because this is plain static HTML, edit [`config.js`](config.js) (loaded by the page).
For a real client build, swap this for Vite/Next and use `import.meta.env`.

## Flows included

- Load agency + tours from `GET /agencies/:slug`
- OTP login via `login-start` + `verify-otp`
- Create ready-made inquiry via `POST /inquiries`
- Deep-link to TourPilot trip room: `{WEB_APP_URL}/trips?room={id}`

Full contract: [`docs/HEADLESS.md`](../../docs/HEADLESS.md).
