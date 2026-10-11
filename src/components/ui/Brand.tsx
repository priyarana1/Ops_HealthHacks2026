import Image from "next/image";

// Size of public/brand/clearpath-mark.png (the logo's sun, hills and path, on a transparent background).
const MARK_WIDTH = 286, MARK_HEIGHT = 256;

/**
 * ClearPath logo: the mark followed by the wordmark in the logo's navy. `onDark` makes the
 * wordmark white for dark backgrounds.
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
  const height = Math.round(size * 1.15);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--font-sans)",
        fontWeight: 700,
        fontSize: size * 0.8,
        color: onDark ? "#fff" : "var(--brand-navy)",
        letterSpacing: "-0.01em",
      }}
    >
      <Image
        src="/brand/clearpath-mark.png"
        width={Math.round((height * MARK_WIDTH) / MARK_HEIGHT)}
        height={height}
        alt=""
        aria-hidden="true"
        priority
      />
      {showText && <span>ClearPath</span>}
    </span>
  );
}
