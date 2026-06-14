import { Link } from "react-router-dom";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
};

export function RegisterTermsConsent({ checked, onChange, id = "register-terms" }: Props) {
  return (
    <label className="register-terms-consent" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
      />
      <span>
        I agree to the{" "}
        <Link to="/terms" target="_blank" rel="noopener noreferrer" className="register-terms-consent__link">
          Terms &amp; Conditions
        </Link>
      </span>
    </label>
  );
}
