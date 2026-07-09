type Props = {
  message?: string;
};

export function FormFieldError({ message }: Props) {
  if (!message) return null;
  return (
    <p className="field-error" role="alert">
      {message}
    </p>
  );
}

export function FormValidationMessages({ errors }: { errors: Record<string, string> }) {
  const messages = Object.values(errors);
  if (messages.length === 0) return null;

  return (
    <div className="form-validation-messages" role="alert">
      {messages.map((message) => (
        <p key={message} className="form-error">
          {message}
        </p>
      ))}
    </div>
  );
}
