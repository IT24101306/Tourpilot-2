import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { dashboardPathForRole, type UserRole } from "@tourpilot/shared";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

type Step = "phone" | "otp" | "register";

export function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [demoOtp, setDemoOtp] = useState<string | undefined>();
  const [bypassCode, setBypassCode] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("TOURIST");
  const [agencyName, setAgencyName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handlePhoneSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api<{
        challengeId: string;
        otp?: string;
        bypassOtp?: string;
      }>("/auth/send-otp", { method: "POST", body: JSON.stringify({ phone }) });
      setChallengeId(data.challengeId);
      setDemoOtp(data.otp);
      setBypassCode(data.bypassOtp);
      if (data.bypassOtp) setOtp(data.bypassOtp);
      setStep("otp");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setIsRegistering(true);
        setStep("register");
      } else {
        setError(err instanceof Error ? err.message : "Failed");
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
        user: { id: string; phone: string; name: string; role: UserRole; walletBalance: number };
        redirectTo: string;
        loginFeeCharged?: number;
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

  async function handleRegisterRequest(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api<{ challengeId: string; otp?: string; bypassOtp?: string }>(
        "/auth/register-request",
        {
        method: "POST",
        body: JSON.stringify({ name, phone, role, agencyName: role === "AGENCY" ? agencyName : undefined }),
      });
      setChallengeId(data.challengeId);
      setDemoOtp(data.otp);
      setBypassCode(data.bypassOtp);
      if (data.bypassOtp) setOtp(data.bypassOtp);
      setIsRegistering(true);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterVerify(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api<{
        token: string;
        user: { id: string; phone: string; name: string; role: UserRole; walletBalance: number };
        redirectTo: string;
      }>("/auth/verify-registration", {
        method: "POST",
        body: JSON.stringify({ challengeId, phone, otp }),
      });
      setSession(data.token, data.user);
      navigate(data.redirectTo || dashboardPathForRole(data.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <Link to="/" className="brand">
          Tour<span>Pilot</span>
        </Link>
        <div
          className="hero-image"
          style={{
            margin: "24px 0 0",
            minHeight: 480,
            backgroundImage:
              'linear-gradient(to top, rgba(0,0,0,.6), rgba(0,0,0,.2)), url("https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1800")',
          }}
        >
          <h1>Your Sri Lanka journey starts here</h1>
          <p>Phone + OTP login. No passwords. Secure and simple.</p>
        </div>
      </div>

      <div className="auth-card">
        <div className="auth-box">
          <h2 style={{ margin: "0 0 8px" }}>
            {step === "register" ? "Create account" : "Welcome back"}
          </h2>
          <p className="muted" style={{ marginBottom: 20 }}>
            Username is your phone number. OTP is your password.
          </p>

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
              <button type="button" className="btn btn-ghost" onClick={() => setStep("phone")}>
                Back to login
              </button>
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
  );
}
