import { FormEvent } from "react";

type OtpStepProps = {
  otp: string;
  demoOtp?: string;
  bypassCode?: string;
  loading: boolean;
  submitLabel: string;
  onOtpChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onBack?: () => void;
};

export function OtpStep({
  otp,
  demoOtp,
  bypassCode,
  loading,
  submitLabel,
  onOtpChange,
  onSubmit,
  onBack,
}: OtpStepProps) {
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <label htmlFor="otp">Enter the 6-digit OTP sent to your phone</label>
      <input
        id="otp"
        value={otp}
        onChange={(e) => onOtpChange(e.target.value)}
        maxLength={6}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
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
              Temporary OTP: <strong>{demoOtp}</strong>
            </>
          )}
        </div>
      )}
      <button type="submit" className="btn btn-primary" disabled={loading}>
        {submitLabel}
      </button>
      {onBack && (
        <button type="button" className="btn btn-ghost" onClick={onBack} disabled={loading}>
          Back
        </button>
      )}
    </form>
  );
}
