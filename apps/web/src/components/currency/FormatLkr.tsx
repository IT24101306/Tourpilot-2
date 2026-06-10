import { useFormatMoney } from "../../context/CurrencyContext";

type Props = {
  amount: number;
  prefix?: string;
  className?: string;
};

/** Renders an LKR-stored amount in the visitor's display currency (default USD). */
export function FormatLkr({ amount, prefix, className }: Props) {
  const { format, formatFrom } = useFormatMoney();
  const text = prefix === "from" ? formatFrom(amount) : prefix ? `${prefix}${format(amount)}` : format(amount);
  return <span className={className}>{text}</span>;
}
