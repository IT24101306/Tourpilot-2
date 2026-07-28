import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  defaultAgencyKyc,
  isValidInternationalPhone,
  toStoredPhone,
  TRIAL_DAYS,
  type AgencyKycInput,
  type PackageBilling,
  type UserRole,
} from "@tourpilot/shared";
import { api } from "../api/client";
import { AuthLayout, AuthSwitch } from "../components/AuthLayout";
import { OtpStep } from "../components/OtpStep";
import { PhoneInput } from "../components/PhoneInput";
import { AgencyKycForm } from "../components/agency/AgencyKycForm";
import { RegisterTermsConsent } from "../components/auth/RegisterTermsConsent";
import { loginAfterRegisterPath } from "../utils/authRedirect";

type Step = "details" | "kyc" | "otp";

export function RegisterProPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("AGENCY");
  const [agencyName, setAgencyName] = useState("");
  const [agencyKyc, setAgencyKyc] = useState<AgencyKycInput>(() => defaultAgencyKyc());
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [demoOtp, setDemoOtp] = useState<string | undefined>();
  const [bypassCode, setBypassCode] = useState<string | undefined>();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedPackage = useMemo(() => {
    const packageId = searchParams.get("package")?.trim();
    const packageName = searchParams.get("name")?.trim();
    if (!packageId || !packageName) return null;
    const priceLkr = Math.max(0, Math.round(Number(searchParams.get("priceLkr") || 0)));
    const priceLabel =
      searchParams.get("priceLabel")?.trim() ||
      (priceLkr > 0 ? `LKR ${priceLkr.toLocaleString("en-LK")}` : "Selected package");
    const billingRaw = (searchParams.get("billing") || "MONTHLY").toUpperCase();
    const billing = (
      ["MONTHLY", "ONE_TIME", "PAYG", "CUSTOM"].includes(billingRaw) ? billingRaw : "CUSTOM"
    ) as PackageBilling;
    return { packageId, packageName, priceLkr, priceLabel, billing };
  }, [searchParams]);

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

    if (!termsAccepted) {
      setError("You must agree to the Terms & Conditions to register.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

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

    if (!termsAccepted) {
      setError("You must agree to the Terms & Conditions to register.");
      return;
    }

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
            email: email.trim().toLowerCase(),
            phone: normalizedPhone,
            role,
            agencyName: role === "AGENCY" ? agencyName : undefined,
            agencyKyc: role === "AGENCY" ? agencyKyc : undefined,
            selectedPackage: selectedPackage ?? undefined,
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
      await api("/auth/verify-registration", {
        method: "POST",
        body: JSON.stringify({ challengeId, phone, otp }),
      });
      navigate(loginAfterRegisterPath({ phone }), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      fullScreen
      billboardLines={["Start", "Manage", "Automate", "Scale"]}
      title="Create your pro account"
    >
      <AuthSwitch mode="register" />

      {selectedPackage && (
        <div className="auth-package-chip">
          <strong>{selectedPackage.packageName}</strong>
          <p>
            {TRIAL_DAYS}-day free trial — then {selectedPackage.priceLabel}.
          </p>
        </div>
      )}

      {error && (
        <p className="form-error">
          {error}
          {(error.toLowerCase().includes("log in") || error.toLowerCase().includes("already exists")) && (
            <>
              {" "}
              <Link to="/login">Go to login</Link>
            </>
          )}
        </p>
      )}

      {step === "details" && (
        <form className="form-grid" onSubmit={handleDetailsSubmit}>
          <label htmlFor="name">Full name</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            minLength={2}
            required
          />
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <p className="muted" style={{ margin: "-4px 0 0", fontSize: "0.85rem" }}>
            Used for trial reminders, account notices, and occasional TourPilot offers.
          </p>
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
          {role === "DRIVER" && (
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              Drivers invited by an agency should use Login with OTP instead — no signup needed.
            </p>
          )}
          <RegisterTermsConsent checked={termsAccepted} onChange={setTermsAccepted} />
          <button type="submit" className="btn btn-primary" disabled={loading || !termsAccepted}>
            {role === "AGENCY" ? "Continue to verification" : "Send OTP"}
          </button>
        </form>
      )}

      {step === "kyc" && role === "AGENCY" && (
        <form className="form-grid agency-kyc-register" onSubmit={handleKycSubmit}>
          <AgencyKycForm value={agencyKyc} onChange={setAgencyKyc} disabled={loading} />
          <RegisterTermsConsent
            checked={termsAccepted}
            onChange={setTermsAccepted}
            id="register-terms-kyc"
          />
          <div className="gov-form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep("details")}
              disabled={loading}
            >
              Back
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || !termsAccepted}>
              {loading ? "Sending…" : "Send OTP"}
            </button>
          </div>
        </form>
      )}

      {step === "otp" && (
        <>
          <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.9rem" }}>
            Code sent to your email{email.trim() ? ` (${email.trim().toLowerCase()})` : ""}. Phone on
            file: {phone}
          </p>
          <OtpStep
            otp={otp}
            onOtpChange={setOtp}
            onSubmit={handleOtpSubmit}
            loading={loading}
            submitLabel="Verify & continue"
            demoOtp={demoOtp}
            bypassCode={bypassCode}
            onBack={() => {
              setStep(role === "AGENCY" ? "kyc" : "details");
              setOtp("");
              setError("");
            }}
          />
        </>
      )}

      <p className="muted auth-footnote">
        Looking for a traveler account?{" "}
        <Link to="/register" className="auth-switch-link">
          Tourist sign up
        </Link>
      </p>
    </AuthLayout>
  );
}
