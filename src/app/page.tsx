import Link from "next/link";
import { Brand } from "@/components/ui/Brand";
import { ArrowRight, CalendarDays, ListChecks, Pill, ShieldCheck, Stethoscope, Users } from "lucide-react";

const features = [
  { Icon: Pill, title: "Your medicines", description: "Know what to take and when." },
  { Icon: ListChecks, title: "Your daily weight", description: "Track your weight and how you feel." },
  { Icon: CalendarDays, title: "Your follow-up visits", description: "See what comes next." },
];

export default function Home() {
  return (
    <main className="portal-entry">
      <div className="portal-shell">
        <section className="portal-overview portal-overview--simple" aria-labelledby="portal-title">
          <header className="portal-masthead">
            <Brand size={52} />
          </header>
          <div className="portal-intro">
            <h1 id="portal-title">Your heart care.<br />One step at a time.</h1>
            <p>Your heart-failure plan, clearly explained.</p>
          </div>
          <div className="portal-features">
            {features.map(({ Icon, title, description }) => (
              <article className="portal-feature" key={title}>
                <span className="portal-feature-icon"><Icon size={28} strokeWidth={1.8} aria-hidden="true" /></span>
                <div><h2>{title}</h2><p>{description}</p></div>
              </article>
            ))}
          </div>
          <Link className="portal-recovery-link" href="/p/ELN-7Q2K">View my care plan<ArrowRight size={22} aria-hidden="true" /></Link>
          <footer className="portal-overview-footer"><span>Demonstration · Sample patient data</span></footer>
        </section>
        <aside className="portal-access" aria-labelledby="access-title">
          <div className="portal-access-heading"><span className="portal-kicker">EXPLORE CLEARPATH</span><h2 id="access-title">Choose your portal</h2><p>One recovery journey.<br />Three connected perspectives.</p></div>
          <Link className="portal-patient-link" href="/p/ELN-7Q2K"><span>Open patient portal</span><ArrowRight size={18} aria-hidden="true" /></Link>
          <p className="portal-access-hint">View Eleanor’s sample recovery plan.<br />Use the sample verification code shown on screen.</p>
          <div className="portal-staff-label">CARE TEAM ACCESS</div>
          <Link className="portal-staff-link" href="/signin"><Stethoscope size={24} aria-hidden="true" /><span><b>Provider portal</b><small>Review a heart-failure discharge plan</small></span><ArrowRight size={16} aria-hidden="true" /></Link>
          <Link className="portal-staff-link" href="/coordinator"><Users size={24} aria-hidden="true" /><span><b>Care coordinator</b><small>Review heart-care follow-up needs</small></span><ArrowRight size={16} aria-hidden="true" /></Link>
          <div className="portal-next-step"><h3>Built with hospital workflows in mind</h3><p>This demo illustrates the care experience. Hospital identity, clinical data connections, and care-team notifications are future integration work.</p></div>
          <footer className="portal-access-footer"><ShieldCheck size={16} aria-hidden="true" /><span>Sample data only<br />No live hospital connection</span></footer>
        </aside>
      </div>
    </main>
  );
}
