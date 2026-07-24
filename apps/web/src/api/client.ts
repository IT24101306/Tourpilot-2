const API_BASE = "/api";
const TOKEN_KEY = "tourpilotAuthToken";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, ...init } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
    };
    if (res.status === 401 && errBody.code === "SESSION_INACTIVE") {
      localStorage.removeItem(TOKEN_KEY);
      const onLogin = window.location.pathname.startsWith("/login");
      if (!onLogin) {
        const params = new URLSearchParams({ reason: "session_inactive" });
        window.location.assign(`/login?${params.toString()}`);
      }
    }
    if (res.status === 402 && errBody.code === "TRIAL_EXPIRED") {
      const onBilling = window.location.pathname.startsWith("/billing");
      if (!onBilling) {
        window.location.assign("/billing/activate");
      }
    }
    throw new ApiError(errBody.error || res.statusText, res.status, errBody.code);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json().catch(() => ({}));
  return data as T;
}
