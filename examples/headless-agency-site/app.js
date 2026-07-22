/* global TOURPILOT */

const cfg = window.TOURPILOT || {};
const API = (cfg.apiBase || "").replace(/\/$/, "");
const SLUG = cfg.agencySlug || "";
const WEB = (cfg.webAppUrl || "").replace(/\/$/, "");

const TOKEN_KEY = "tourpilot_headless_token";

const $ = (id) => document.getElementById(id);

function setStatus(msg, isError = false) {
  const el = $("status");
  el.textContent = msg;
  el.classList.toggle("error", isError);
}

function token() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
  refreshAuthState();
}

function refreshAuthState() {
  $("auth-state").textContent = token()
    ? "Signed in (Bearer token stored in localStorage)"
    : "Not signed in";
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (options.auth) {
    const t = token();
    if (!t) throw new Error("Sign in first");
    headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || res.statusText || "Request failed");
  }
  return body;
}

let agency = null;
let challengeId = null;

function money(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `LKR ${Number(n).toLocaleString()}`;
}

function renderTours(tours) {
  const box = $("tours");
  const select = $("tour-select");
  select.innerHTML = "";
  if (!tours?.length) {
    box.innerHTML = `<p class="muted">No published tours.</p>`;
    return;
  }
  box.innerHTML = "";
  for (const t of tours) {
    const row = document.createElement("div");
    row.className = "tour";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(t.title)}</strong>
        <span class="muted">${escapeHtml(t.summary || t.slug || "")}</span>
      </div>
      <div>${money(t.basePriceLkr ?? t.listedPriceLkr)}</div>
    `;
    box.appendChild(row);

    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.title;
    select.appendChild(opt);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadAgency() {
  if (!API || !SLUG) {
    setStatus("Set apiBase and agencySlug in config.js", true);
    return;
  }
  setStatus(`Loading ${API}/agencies/${SLUG} …`);
  const [config, payload] = await Promise.all([
    api(`/agencies/${SLUG}/headless-config`),
    api(`/agencies/${SLUG}`),
  ]);
  agency = payload;
  $("agency-name").textContent = payload.name || SLUG;
  $("agency-tagline").textContent =
    payload.tagline ||
    (config.entitled
      ? "External storefront entitled"
      : "Warning: externalStorefront flag is off for this agency");
  renderTours(payload.tours || []);
  setStatus(
    JSON.stringify(
      {
        entitled: config.entitled,
        features: config.features,
        tripRoomUrlTemplate: config.tripRoomUrlTemplate,
        tourCount: (payload.tours || []).length,
      },
      null,
      2
    )
  );
}

$("btn-otp").addEventListener("click", async () => {
  try {
    const phone = $("phone").value.trim();
    const data = await api("/auth/login-start", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
    challengeId = data.challengeId;
    const hint = data.otp ? ` DEV OTP: ${data.otp}` : "";
    setStatus(`OTP sent.${hint}\nchallengeId=${challengeId}`);
  } catch (e) {
    setStatus(e.message || String(e), true);
  }
});

$("btn-verify").addEventListener("click", async () => {
  try {
    const phone = $("phone").value.trim();
    const otp = $("otp").value.trim();
    if (!challengeId) throw new Error("Send OTP first");
    const data = await api("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ challengeId, phone, otp }),
    });
    if (data.user?.role && data.user.role !== "TOURIST") {
      setStatus(`Signed in as ${data.user.role}. Inquiries require TOURIST role.`, true);
    }
    setToken(data.token);
    setStatus(`Verified. User: ${data.user?.name} (${data.user?.role})`);
  } catch (e) {
    setStatus(e.message || String(e), true);
  }
});

$("btn-logout").addEventListener("click", () => {
  setToken("");
  setStatus("Token cleared");
});

$("btn-inquire").addEventListener("click", async () => {
  try {
    if (!agency?.id) throw new Error("Agency not loaded");
    const tourId = $("tour-select").value;
    const email = $("email").value.trim();
    const pax = Number($("pax").value) || 2;
    const message = $("message").value.trim();
    if (!email) throw new Error("Email is required");
    if (!tourId) throw new Error("Select a tour");

    const inquiry = await api("/inquiries", {
      method: "POST",
      auth: true,
      body: JSON.stringify({
        agencyId: agency.id,
        tourId,
        type: "READY_MADE",
        pax,
        email,
        message: message || undefined,
      }),
    });

    const roomUrl = `${WEB}/trips?room=${inquiry.id}`;
    $("inquiry-result").innerHTML = `Created inquiry <code>${escapeHtml(
      inquiry.id
    )}</code>. <a href="${escapeHtml(roomUrl)}" target="_blank" rel="noopener">Open trip room</a>`;
    setStatus(JSON.stringify(inquiry, null, 2));
  } catch (e) {
    setStatus(e.message || String(e), true);
  }
});

refreshAuthState();
loadAgency().catch((e) => setStatus(e.message || String(e), true));
