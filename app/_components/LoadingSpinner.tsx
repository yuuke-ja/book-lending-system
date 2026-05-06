type LoadingSpinnerProps = {
  label?: string;
  text?: string;
  className?: string;
  spinnerClassName?: string;
};

export default function LoadingSpinner({
  label,
  text,
  className = "",
  spinnerClassName = "",
}: LoadingSpinnerProps) {
  const statusLabel = label ?? text ?? "読み込み中";

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      role="status"
      aria-label={statusLabel}
    >
      <span
        className={`relative inline-flex shrink-0 animate-spin items-center justify-center rounded-full ${text ? "mr-6" : ""
          } ${spinnerClassName}`}
        style={{ height: 24, width: 24 }}
        aria-hidden="true"
      >
        <span
          className="absolute rounded-full"
          style={{
            backgroundColor: "#dc2626",
            height: 12,
            left: 6,
            opacity: 1,
            top: -6,
            transform: "scale(0.9)",
            width: 12,
          }}
        />
        <span
          className="absolute rounded-full"
          style={{
            backgroundColor: "#dc2626",
            height: 12,
            left: -6,
            opacity: 0.75,
            top: 6,
            transform: "scale(0.9)",
            width: 12,
          }}
        />
        <span
          className="absolute rounded-full"
          style={{
            backgroundColor: "#dc2626",
            height: 12,
            left: 6,
            opacity: 0.5,
            top: 18,
            transform: "scale(0.9)",
            width: 12,
          }}
        />
        <span
          className="absolute rounded-full"
          style={{
            backgroundColor: "#dc2626",
            height: 12,
            left: 18,
            opacity: 0.25,
            top: 6,
            transform: "scale(0.9)",
            width: 12,
          }}
        />
      </span>
      {text}
      <span className="sr-only">{statusLabel}</span>
    </span>
  );
}
