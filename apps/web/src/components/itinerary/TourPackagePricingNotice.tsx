type Props = {
  className?: string;
};

export function TourPackagePricingNotice({ className }: Props) {
  return (
    <aside
      className={["tour-package-pricing-notice", className].filter(Boolean).join(" ")}
      aria-label="Package pricing note"
    >
      <p>
        This package is designed for <strong>one person</strong> traveling in a{" "}
        <strong>sedan vehicle</strong>. If your group size increases, please inquire and the
        agency will send exact costing.
      </p>
    </aside>
  );
}
