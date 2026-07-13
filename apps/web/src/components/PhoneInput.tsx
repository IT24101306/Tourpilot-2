type PhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
};

export function PhoneInput({ value, onChange, id = "phone" }: PhoneInputProps) {
  return (
    <>
      <label htmlFor={id}>Phone number</label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="+94771234567"
        inputMode="tel"
        autoComplete="tel"
        required
      />
      <p className="phone-input-hint muted">
        Use your full number with + country code. You'll use this to log in.
      </p>
    </>
  );
}
