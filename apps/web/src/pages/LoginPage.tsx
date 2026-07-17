import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  dashboardPathForRole,
  isValidInternationalPhone,
  DEFAULT_LOGIN_FEE_LKR,
  toStoredPhone,
  type UserRole,
} from "@tourpilot/shared";
import { AUTH_RETURN_PARAM, resolvePostLoginPath } from "../utils/authRedirect";
import { api, ApiError } from "../api/client";
import { useAuth, type AuthUser } from "../context/AuthContext";
import { AuthLayout, AuthSwitch } from "../components/AuthLayout";
import { OtpStep } from "../components/OtpStep";
import { PhoneInput } from "../components/PhoneInput";
import { WalletTopupPanel } from "../components/wallet/WalletTopupPanel";
import "../styles/dashboard.css";

type Step = "phone" | "otp" | "password";

type LoginStartResponse =
  | {
      authMethod: "otp";
      challengeId: string;
      otp?: string;
      bypassOtp?: string;
      role?: UserRole;
      walletBalance?: number;
      loginFee?: number;
      loginFeeCustom?: boolean;
    }
  | {
      authMethod: "password";
      role: "ADMIN";
      walletBalance?: number;
      loginFee?: number;
      loginFeeCustom?: boolean;
      topupChallengeId?: string;
    };

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get(AUTH_RETURN_PARAM);
  const { user, token, refreshUser, setSession } = useAuth();

  function afterLogin(authUser: AuthUser, apiRedirect?: string) {
    if (authUser.role === "AGENCY" || authUser.role === "INFLUENCER") {
      navigate(dashboardPathForRole(authUser.role), { replace: true });
      return;
    }
    const fallback = apiRedirect || dashboardPathForRole(authUser.role);
    navigate(resolvePostLoginPath(returnTo, fallback), { replace: true });
  }

  const [step, setStep] = useState<Step>("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [topupChallengeId, setTopupChallengeId] = useState("");
  const [loginRole, setLoginRole] = useState<UserRole | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loginFee, setLoginFee] = useState<number | null>(null);
  const [demoOtp, setDemoOtp] = useState<string | undefined>();
  const [bypassCode, setBypassCode] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const activeTopupChallengeId = topupChallengeId || challengeId;
  const showWalletPanel =
    (user != null && token != null) ||
    (walletBalance != null && activeTopupChallengeId !== "");

  const panelBalance = walletBalance ?? user?.walletBalance ?? 0;
  const panelFee =
    loginFee ??
    user?.loginFee ??
    (loginRole != null
      ? DEFAULT_LOGIN_FEE_LKR[loginRole]
      : user?.role != null
        ? DEFAULT_LOGIN_FEE_LKR[user.role]
        : undefined);

  useEffect(() => {
    if (!user) return;
    if (user.role === "AGENCY" || user.role === "INFLUENCER") {
      navigate(dashboardPathForRole(user.role), { replace: true });
    }
  }, [user, navigate]);

  async function runTopup(amount: number) {
    if (user && token) {
      const result = await api<{ balance: number }>("/wallet/topup", {
        method: "POST",
        token,
        body: JSON.stringify({ amount }),
      });
      await refreshUser();
      setWalletBalance(result.balance);
      return result.balance;
    }

    if (!phone || !activeTopupChallengeId) {
      throw new Error("Enter your phone number first.");
    }

    const result = await api<{ balance: number; walletBalance: number }>("/auth/login-topup", {
      method: "POST",
      body: JSON.stringify({
        phone,
        challengeId: activeTopupChallengeId,
        amount,
      }),
    });
    const next = result.walletBalance ?? result.balance;
    setWalletBalance(next);
    return next;
  }

  async function handlePhoneSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const normalizedPhone = toStoredPhone(phoneInput);
    if (!isValidInternationalPhone(normalizedPhone)) {
      setError("Enter a valid phone with country code (e.g. +94771234567).");
      return;
    }

    setLoading(true);
    try {
      setPhone(normalizedPhone);
      const data = await api<LoginStartResponse>("/auth/login-start", {
        method: "POST",
        body: JSON.stringify({ phone: normalizedPhone }),
      });

      if (data.authMethod === "password") {
        setChallengeId("");
        setOtp("");
        setDemoOtp(undefined);
        setBypassCode(undefined);
        setLoginRole(data.role);
        setWalletBalance(data.walletBalance ?? 0);
        setLoginFee(data.loginFee ?? DEFAULT_LOGIN_FEE_LKR[data.role] ?? 0);
        setTopupChallengeId(data.topupChallengeId ?? "");
        setStep("password");
        return;
      }

      setChallengeId(data.challengeId);
      setTopupChallengeId(data.challengeId);
      setLoginRole(data.role ?? null);
      setWalletBalance(data.walletBalance ?? 0);
      setLoginFee(
        data.loginFee ??
          (data.role ? DEFAULT_LOGIN_FEE_LKR[data.role] : null)
      );
      setDemoOtp(data.otp);
      setBypassCode(data.bypassOtp);
      if (data.bypassOtp) setOtp(data.bypassOtp);
      setStep("otp");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError(
          "No account for this number. If your agency added you, ask them to confirm the phone includes country code (e.g. +94771234567)."
        );
      } else {
        setError(err instanceof Error ? err.message : "Failed to continue");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api<{
        token: string;
        user: AuthUser;
        redirectTo: string;
      }>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ challengeId, phone, otp }),
      });
      setSession(data.token, data.user);
      afterLogin(data.user, data.redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api<{
        token: string;
        user: AuthUser;
        redirectTo: string;
      }>("/auth/login-password", {
        method: "POST",
        body: JSON.stringify({ phone, password }),
      });
      setSession(data.token, data.user);
      afterLogin(data.user, data.redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid password");
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setStep("phone");
    setOtp("");
    setPassword("");
    setChallengeId("");
    setTopupChallengeId("");
    setLoginRole(null);
    setWalletBalance(null);
    setLoginFee(null);
    setError("");
  }

  return (
    <AuthLayout
      fullScreen
      title="Log in"
      subtitle={
        step === "password"
          ? "Admin account detected. Enter your password to continue."
          : "Enter the phone number you registered with — we'll send a one-time code."
      }
    >
      <AuthSwitch mode="login" returnTo={returnTo} />

      {showWalletPanel && (
        <WalletTopupPanel
          balance={panelBalance}
          feeHint={panelFee}
          onTopup={runTopup}
          className="login-wallet-panel--auth"
        />
      )}

      {error && <p className="form-error">{error}</p>}

      {step === "phone" && (
        <form className="form-grid" onSubmit={handlePhoneSubmit}>
          <PhoneInput value={phoneInput} onChange={setPhoneInput} id="login-phone" />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Checking…" : "Continue"}
          </button>
          <p className="muted phone-input-hint" style={{ margin: 0 }} />

          {error && error.includes("No account") && (
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
              <Link
                to={
                  returnTo
                    ? `/register?${AUTH_RETURN_PARAM}=${encodeURIComponent(returnTo)}`
                    : "/register"
                }
                className="auth-switch-link"
              >
                Create a free tourist account
              </Link>
            </p>
          )}
        </form>
      )}

      {step === "otp" && (
        <>
          <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.9rem" }}>
            Code sent to {phone}
          </p>
          <OtpStep
            otp={otp}
            demoOtp={demoOtp}
            bypassCode={bypassCode}
            loading={loading}
            submitLabel="Verify & log in"
            onOtpChange={setOtp}
            onSubmit={handleOtpSubmit}
            onBack={handleBack}
          />
        </>
      )}

      {step === "password" && (
        <form className="form-grid" onSubmit={handlePasswordSubmit}>
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            Logging in as admin · {phone}
          </p>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            Log in
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleBack} disabled={loading}>
            Back
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
