import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { dashboardPathForRole, isValidInternationalPhone, toStoredPhone } from "@tourpilot/shared";
import { api, ApiError } from "../api/client";
import { useAuth, type AuthUser } from "../context/AuthContext";
import { AuthLayout, AuthSwitch } from "../components/AuthLayout";
import { OtpStep } from "../components/OtpStep";
import { PhoneInput } from "../components/PhoneInput";

type Step = "phone" | "otp" | "password";

type LoginStartResponse =
  | {
      authMethod: "otp";
      challengeId: string;
      otp?: string;
      bypassOtp?: string;
    }
  | {
      authMethod: "password";
      role: "ADMIN";
    };

export function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [demoOtp, setDemoOtp] = useState<string | undefined>();
  const [bypassCode, setBypassCode] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      const data = await api<LoginStartResponse>("/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone: normalizedPhone }),
      });

      if (data.authMethod === "password") {
        setStep("password");
        return;
      }

      setChallengeId(data.challengeId);
      setDemoOtp(data.otp);
      setBypassCode(data.bypassOtp);
      if (data.bypassOtp) setOtp(data.bypassOtp);
      setStep("otp");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError("No account for this number.");
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
      navigate(data.redirectTo || dashboardPathForRole(data.user.role));
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
      navigate(data.redirectTo || dashboardPathForRole(data.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid password");
    } finally {
      setLoading(false);
    }
  }

<<<<<<< HEAD
  function handleBack() {
    setStep("phone");
    setOtp("");
    setPassword("");
    setError("");
=======
  function openRegister() {
    setError("");
    setIsRegistering(false);
    setStep("register");
  }

  function openLogin() {
    setError("");
    setIsRegistering(false);
    setStep("phone");
>>>>>>> a1fb766 (Implement dashboard and API updates)
  }

  return (
    <AuthLayout
      title="Log in"
      subtitle={
        step === "password"
          ? "Admin account detected. Enter your password to continue."
          : "Enter the same phone number you registered with, including country code."
      }
    >
      <AuthSwitch mode="login" />

      {error && <p className="form-error">{error}</p>}

      {step === "phone" && (
        <form className="form-grid" onSubmit={handlePhoneSubmit}>
          <PhoneInput
            value={phoneInput}
            onChange={setPhoneInput}
            id="login-phone"
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            Continue
          </button>
          {error && error.includes("No account") && (
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
              <Link to="/register" className="auth-switch-link">
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

<<<<<<< HEAD
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
=======
          {error && <p style={{ color: "#b42318", fontWeight: 700 }}>{error}</p>}

          {step === "phone" && (
            <form className="form-grid" onSubmit={handlePhoneSubmit}>
              <label htmlFor="phone">Mobile number</label>
              <input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0771234567"
                required
              />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                Send OTP
              </button>
              <p className="auth-switch">
                Don&apos;t have an account?{" "}
                <button type="button" className="auth-link" onClick={openRegister}>
                  Create account
                </button>
              </p>
            </form>
          )}

          {step === "register" && (
            <form className="form-grid" onSubmit={handleRegisterRequest}>
              <label htmlFor="name">Full name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              <label htmlFor="phone-r">Mobile number</label>
              <input id="phone-r" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              <label htmlFor="role">I am a</label>
              <select id="role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                <option value="TOURIST">Tourist</option>
                <option value="AGENCY">Travel agency</option>
                <option value="INFLUENCER">Influencer</option>
                <option value="DRIVER">Driver</option>
              </select>
              {role === "AGENCY" && (
                <>
                  <label htmlFor="agency">Agency name</label>
                  <input
                    id="agency"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    required
                  />
                </>
              )}
              <button type="submit" className="btn btn-primary" disabled={loading}>
                Register & get OTP
              </button>
              <p className="auth-switch">
                Already have an account?{" "}
                <button type="button" className="auth-link" onClick={openLogin}>
                  Sign in
                </button>
              </p>
            </form>
          )}

          {step === "otp" && (
            <form
              className="form-grid"
              onSubmit={isRegistering ? handleRegisterVerify : handleOtpSubmit}
            >
              <label htmlFor="otp">Enter OTP</label>
              <input
                id="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                required
              />
              {(demoOtp || bypassCode) && (
                <div className="otp-hint">
                  {bypassCode ? (
                    <>
                      Dev bypass: always use <strong>{bypassCode}</strong>
                    </>
                  ) : (
                    <>
                      Demo OTP: <strong>{demoOtp}</strong>
                    </>
                  )}
                </div>
              )}
              <button type="submit" className="btn btn-primary" disabled={loading}>
                Verify & continue
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
>>>>>>> a1fb766 (Implement dashboard and API updates)
  );
}
