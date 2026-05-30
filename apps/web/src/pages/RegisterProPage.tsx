import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  dashboardPathForRole,
  defaultAgencyKyc,
  isValidInternationalPhone,
  toStoredPhone,
  type AgencyKycInput,
  type UserRole,
} from "@tourpilot/shared";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { OtpStep } from "../components/OtpStep";
import { PhoneInput } from "../components/PhoneInput";
import { AgencyKycForm } from "../components/agency/AgencyKycForm";

type Step = "details" | "kyc" | "otp";

export function RegisterProPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("AGENCY");
  const [agencyName, setAgencyName] = useState("");
  const [agencyKyc, setAgencyKyc] = useState<AgencyKycInput>(() => defaultAgencyKyc());
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [demoOtp, setDemoOtp] = useState<string | undefined>();
  const [bypassCode, setBypassCode] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (role !== "AGENCY") return;
    setAgencyKyc((prev) => ({
      ...prev,
      legalBusinessName: agencyName.trim() || prev.legalBusinessName,
    }));
  }, [agencyName, role]);

  function handleDetailsSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const normalizedPhone = toStoredPhone(phoneInput);
    if (!isValidInternationalPhone(normalizedPhone)) {
      setError("Enter a valid phone with country code (e.g. +94771234567).");
      return;
    }

    setPhone(normalizedPhone);

    if (role === "AGENCY") {
      if (!agencyName.trim()) {
        setError("Agency name is required.");
        return;
      }
      setAgencyKyc((prev) => ({
        ...defaultAgencyKyc({ legalBusinessName: agencyName.trim() }),
        ...prev,
        legalBusinessName: agencyName.trim(),
      }));
      setStep("kyc");
      return;
    }

    void requestOtp(normalizedPhone);
  }

  async function handleKycSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!agencyKyc.declarationsAccepted) {
      setError("Please confirm the declarations to continue.");
      return;
    }

    await requestOtp(phone);
  }

  async function requestOtp(normalizedPhone: string) {
    setLoading(true);
    try {
      const data = await api<{ challengeId: string; otp?: string; bypassOtp?: string }>(
        "/auth/register-request",
        {
          method: "POST",
          body: JSON.stringify({
            name,
            phone: normalizedPhone,
            role,
            agencyName: role === "AGENCY" ? agencyName : undefined,
            agencyKyc: role === "AGENCY" ? agencyKyc : undefined,
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
        user: {
          id: string;
          phone: string;
          name: string;
          role: UserRole;
          walletBalance: number;
          agency?: { status: string } | null;
        };
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
              <label htmlFor="agency">Agency display name</label>
              <input
                id="agency"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                required
                placeholder="As travelers will see it"
              />
            </>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {role === "AGENCY" ? "Continue to verification" : "Send OTP"}
          </button>
        </form>
      )}

      {step === "kyc" && role === "AGENCY" && (
        <form className="form-grid agency-kyc-register" onSubmit={handleKycSubmit}>
          <AgencyKycForm value={agencyKyc} onChange={setAgencyKyc} disabled={loading} />
          <div className="agency-kyc-register-actions">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={loading}
              onClick={() => {
                setStep("details");
                setError("");
              }}
            >
              Back
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              Send OTP
            </button>
          </div>
        </form>
      )}

      {step === "otp" && (
        <>
          <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.9rem" }}>
            Code sent to {phone}
            {role === "AGENCY" && (
              <>
                <br />
                After verification, your agency is submitted for review (usually within 1–2 business
                days).
              </>
            )}
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
              setStep(role === "AGENCY" ? "kyc" : "details");
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
