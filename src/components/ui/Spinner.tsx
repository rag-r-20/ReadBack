interface Props {
  size?: number;
  className?: string;
  label?: string;
}

export function Spinner({ size = 20, className = "", label }: Props) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        className="animate-spin text-current"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="3"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {label ? <span>{label}</span> : null}
    </span>
  );
}
