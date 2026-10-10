/**
 * ClearPath wordmark + logo. The mark (a horizon curve with a rising sun) is taken
 * from the Blueprint prototypes, with a restrained red sun accent. `onDark`
 * swaps the curve stroke to white for dark backgrounds.
 */
export function Brand({
  size = 30,
  onDark = false,
  showText = true,
}: {
  size?: number;
  onDark?: boolean;
  showText?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--font-sans)",
        fontWeight: 700,
        fontSize: size * 0.8,
        color: onDark ? "#fff" : "var(--ink)",
        letterSpacing: "-0.01em",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 22c4-12 22-12 26 0"
          stroke={onDark ? "#fff" : "var(--ink)"}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M3 22h26"
          stroke={onDark ? "#a7c6e5" : "var(--ink-soft)"}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="16" cy="10.5" r="3" fill="var(--brand-red)" />
      </svg>
      {showText && <span>ClearPath</span>}
    </span>
  );
}
