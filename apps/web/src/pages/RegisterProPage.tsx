import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { dashboardPathForRole, isValidInternationalPhone, toStoredPhone, type UserRole } from "@tourpilot/shared";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { OtpStep } from "../components/OtpStep";
import { PhoneInput } from "../components/PhoneInput";

type Step = "details" | "otp";

export function RegisterProPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("AGENCY");
  const [agencyName, setAgencyName] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [demoOtp, setDemoOtp] = useState<string | undefined>();
  const [bypassCode, setBypassCode] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDetailsSubmit(e: FormEvent) {
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
      const data = await api<{ challengeId: string; otp?: string; bypassOtp?: string }>(
        "/auth/register-request",
        {
          method: "POST",
          body: JSON.stringify({
            name,
            phone: normalizedPhone,
            role,
            agencyName: role === "AGENCY" ? agencyName : undefined,
          }),
        }
      );
      setChallengeId(data.challengeId);
      setDemoOtp(data.otp);
      setBypassCode(data.bypassOtp);
      if (data.bypassOtp) setOtp(data.bypassOtp);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
    <AuthLayout
      title="Professional registration"
      subtitle="For travel agencies, influencers, and drivers. Drivers invited by an agency should use Login with OTP instead — no signup here."
    >
      <p className="muted auth-footnote" style={{ marginTop: 0 }}>
        <Link to="/register" className="auth-switch-link">
          ← Tourist sign up
        </Link>
      </p>

      {error && <p className="form-error">{error}</p>}

      {step === "details" && (
        <form className="form-grid" onSubmit={handleDetailsSubmit}>
          <label htmlFor="name">Full name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          <PhoneInput value={phoneInput} onChange={setPhoneInput} id="pro-phone" />
          <label htmlFor="role">I am a</label>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
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
            Send OTP
          </button>
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
            submitLabel="Verify & create account"
            onOtpChange={setOtp}
            onSubmit={handleOtpSubmit}
            onBack={() => {
              setStep("details");
              setOtp("");
              setError("");
            }}
          />
        </>
      )}

      <p className="muted auth-footnote">
        Already registered? <Link to="/login" className="auth-switch-link">Log in</Link>
      </p>
    </AuthLayout>
  );
}
