import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AUTH_RETURN_PARAM, resolvePostLoginPath } from "../utils/authRedirect";
import { isValidInternationalPhone, toStoredPhone } from "@tourpilot/shared";
import { api } from "../api/client";
import { useAuth, type AuthUser } from "../context/AuthContext";
import { AuthLayout, AuthSwitch } from "../components/AuthLayout";
import { OtpStep } from "../components/OtpStep";
import { PhoneInput } from "../components/PhoneInput";
import { RegisterTermsConsent } from "../components/auth/RegisterTermsConsent";

type Step = "details" | "otp";

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get(AUTH_RETURN_PARAM);
  const { setSession } = useAuth();
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [demoOtp, setDemoOtp] = useState<string | undefined>();
  const [bypassCode, setBypassCode] = useState<string | undefined>();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDetailsSubmit(e: FormEvent) {
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

    setLoading(true);
    try {
      setPhone(normalizedPhone);
      const data = await api<{ challengeId: string; otp?: string; bypassOtp?: string }>(
        "/auth/register-request",
        {
          method: "POST",
          body: JSON.stringify({
            name,
            email: normalizedEmail,
            phone: normalizedPhone,
            role: "TOURIST",
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
        user: AuthUser;
        redirectTo: string;
      }>("/auth/verify-registration", {
        method: "POST",
        body: JSON.stringify({ challengeId, phone, otp }),
      });
      setSession(data.token, data.user);
      navigate(resolvePostLoginPath(returnTo, data.redirectTo || "/profile"), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Enter your details — we'll send a one-time code to your phone to verify you."
    >
      <AuthSwitch mode="register" returnTo={returnTo} />

      {error && <p className="form-error">{error}</p>}

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
            Used for trip updates and occasional TourPilot offers.
          </p>
          <PhoneInput value={phoneInput} onChange={setPhoneInput} id="register-phone" />
          <p className="auth-benefit muted">
            Save tours, send inquiries, and keep your trip plans in one place.
          </p>
          <RegisterTermsConsent checked={termsAccepted} onChange={setTermsAccepted} />
          <button type="submit" className="btn btn-primary" disabled={loading || !termsAccepted}>
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
        Travel agency or influencer?{" "}
        <Link to="/register/pro" className="auth-switch-link">
          Register as a professional
        </Link>
      </p>
    </AuthLayout>
  );
}
