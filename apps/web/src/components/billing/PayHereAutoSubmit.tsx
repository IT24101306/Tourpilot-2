import { useEffect, useRef } from "react";

type Props = {
  checkoutUrl: string;
  fields: Record<string, string>;
  buttonLabel?: string;
};

export function PayHereAutoSubmit({ checkoutUrl, fields, buttonLabel = "Continue to PayHere" }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;
    formRef.current?.submit();
  }, [checkoutUrl, fields]);

  return (
    <form ref={formRef} method="post" action={checkoutUrl}>
      {Object.entries(fields).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <p className="muted">Redirecting you to PayHere…</p>
      <button type="submit" className="btn btn-primary">
        {buttonLabel}
      </button>
    </form>
  );
}
