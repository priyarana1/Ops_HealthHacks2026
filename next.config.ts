import type { NextConfig } from "next";

/**
 * Security headers mirror the previous build (recovered from .next/routes-manifest.json).
 * Rationale (see docs/ProjectPlan.md "Non-negotiable rules"): nothing patient-facing should be
 * cached or framed, and PHI must never leak via referrers. Synthetic data only in this build.
 */
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
