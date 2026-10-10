import Link from "next/link";
import { Brand } from "@/components/ui/Brand";

/**
 * Landing page. In production this would redirect by role; for the hackathon demo it
 * offers clearly labeled entry points into each portal. Synthetic data only.
 */
export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="card"
        style={{ maxWidth: 560, width: "100%", textAlign: "center" }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Brand size={40} />
        </div>
        <h1 style={{ margin: "18px 0 6px" }}>No patient leaves confused.</h1>
        <p className="muted">
          ClearPath turns complex discharge instructions into clear, translated,
          actionable recovery plans. Choose a portal to explore the demo.
        </p>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "center",
            marginTop: 20,
          }}
        >
          <Link className="cp-btn" href="/signin">
            Provider portal
          </Link>
          <Link className="cp-btn cp-btn--ghost" href="/p/ELN-7Q2K">
            Patient portal
          </Link>
          <Link className="cp-btn cp-btn--ghost" href="/coordinator">
            Coordinator
          </Link>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 18 }}>
          Prototype — synthetic data only. No real patient information.
        </p>
      </div>
    </main>
  );
}
