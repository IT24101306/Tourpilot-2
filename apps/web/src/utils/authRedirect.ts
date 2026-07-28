import type { Location } from "react-router-dom";

export const AUTH_RETURN_PARAM = "redirect";

/** Full in-app path (path + query + hash) for post-login return. */
export function currentPath(location: Location): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  const pathOnly = path.split("?")[0].split("#")[0];
  if (pathOnly === "/login" || pathOnly === "/register" || pathOnly === "/register/pro") {
    return false;
  }
  return true;
}

export function resolvePostLoginPath(redirectParam: string | null, fallback: string): string {
  if (!redirectParam) return fallback;
  try {
    const decoded = decodeURIComponent(redirectParam);
    if (!isSafeInternalPath(decoded)) return fallback;
    return decoded;
  } catch {
    return fallback;
  }
}

export function loginPath(returnTo?: string): string {
  if (!returnTo || !isSafeInternalPath(returnTo)) return "/login";
  return `/login?${AUTH_RETURN_PARAM}=${encodeURIComponent(returnTo)}`;
}

export function registerPath(returnTo?: string): string {
  if (!returnTo || !isSafeInternalPath(returnTo)) return "/register";
  return `/register?${AUTH_RETURN_PARAM}=${encodeURIComponent(returnTo)}`;
}

/** After successful signup — send the user to login (do not auto-start a session). */
export function loginAfterRegisterPath(options?: {
  phone?: string;
  redirect?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("registered", "1");
  if (options?.phone?.trim()) params.set("phone", options.phone.trim());
  const redirect = options?.redirect?.trim();
  if (redirect && isSafeInternalPath(redirect)) {
    params.set(AUTH_RETURN_PARAM, redirect);
  }
  return `/login?${params.toString()}`;
}

export function authSwitchPath(
  target: "login" | "register",
  redirectParam: string | null
): string {
  const returnTo = redirectParam
    ? resolvePostLoginPath(redirectParam, "")
    : "";
  if (!returnTo) return target === "login" ? "/login" : "/register";
  return target === "login" ? loginPath(returnTo) : registerPath(returnTo);
}
