"use client";

import { useEffect, useRef, useState } from "react";
import { Brand } from "@/components/ui/Brand";
import { clsx } from "@/lib/clsx";
import {
  Home,
  Pill,
  ListChecks,
  LifeBuoy,
  MessageCircle,
  Volume2,
  Globe,
  Lock,
  AlertTriangle,
  Phone,
  Calendar,
  Heart,
  Share2,
  Check,
  Plus,
  Minus,
  Ban,
  RefreshCw,
  ChevronRight,
  Clock,
  Send,
  Siren,
  ShieldCheck,
} from "lucide-react";
import { ELEANOR_PLAN_CONTENT } from "@/mocks/plan";
import { DEMO_OTP } from "@/mocks/patient";
import { UI } from "@/lib/i18n";
import { LANGUAGE_LABELS, LANGUAGE_DIR } from "@/types/plan";
import type { Language } from "@/types/plan";

const PHONE = "(732) 555-0100";
type Screen = "otp" | "home" | "meds" | "todo" | "help" | "chat" | "checkin" | "expired";

export function PatientApp({ expired = false }: { expired?: boolean }) {
  const [lang, setLang] = useState<Language>("en");
  const [screen, setScreen] = useState<Screen>(expired ? "expired" : "otp");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [calling, setCalling] = useState<string | null>(null);
  const [sos, setSos] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const deviceRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t = UI[lang];
  const dir = LANGUAGE_DIR[lang];
  const daysLeft = 27;

  useEffect(() => {
    if (!sos && !calling) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialogs = deviceRef.current?.querySelectorAll<HTMLElement>(".pt-overlay");
    const dialog = dialogs?.[dialogs.length - 1];
    if (!dialog) return;
    dialog.focus();
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab" || !dialog) return;
      const buttons = Array.from(dialog.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]"));
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
        event.preventDefault();
        first?.focus();
      }
    }
    dialog.addEventListener("keydown", trapFocus);
    return () => {
      dialog.removeEventListener("keydown", trapFocus);
      previous?.focus();
    };
  }, [sos, calling]);

  function showToast(m: string) {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }

  function call(who: string) {
    setCalling(who);
  }

  function changeLang(l: Language) {
    setLang(l);
    showToast(`${LANGUAGE_LABELS[l]}`);
  }

  const bare = screen === "otp" || screen === "expired";

  return (
    <div className="pt-stage">
      <div className="pt-device pt-clinical" ref={deviceRef}>
        {/* prototype chrome */}
        <div className="pt-proto">
          <span className="pt-demo-label">Demonstration · Sample patient data</span>
          {!bare && (
            <button
              type="button"
              className="demo"
              onClick={() => setScreen("expired")}
            >
              DEMO: expire
            </button>
          )}
        </div>

        <div className="pt-top">
          <div className="pt-portal-brand"><Brand size={28} /><span>Patient recovery portal</span></div>
          <span className="pt-who">{bare ? "" : "Eleanor"}</span>
        </div>

        <main
          className={clsx(
            "pt-main",
            lang === "zh" && "lang-zh",
            lang === "ar" && "lang-ar",
          )}
          dir={dir}
          lang={lang}
        >
          {screen === "otp" && (
            <OtpScreen onSuccess={() => setScreen("home")} />
          )}
          {screen === "home" && (
            <HomeScreen
              t={t}
              lang={lang}
              setLang={changeLang}
              daysLeft={daysLeft}
              go={setScreen}
              done={done}
              setDone={setDone}
            />
          )}
          {screen === "meds" && (
            <MedsScreen t={t} lang={lang} setLang={changeLang} />
          )}
          {screen === "todo" && <TodoScreen call={call} done={done} setDone={setDone} />}
          {screen === "help" && <HelpScreen call={call} setSos={setSos} />}
          {screen === "chat" && <ChatScreen setSos={setSos} call={call} />}
          {screen === "checkin" && <CheckinScreen setSos={setSos} call={call} />}
          {screen === "expired" && (
            <ExpiredScreen call={call} onRestart={() => setScreen("otp")} />
          )}
        </main>

        {!bare && (
          <nav className="pt-tabs" aria-label="Main">
            {(
              [
                ["home", t.tabHome, Home],
                ["meds", t.tabMeds, Pill],
                ["todo", t.tabTodo, ListChecks],
                ["help", t.tabHelp, LifeBuoy],
                ["chat", t.tabChat, MessageCircle],
              ] as Array<[Screen, string, typeof Home]>
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                className={clsx(screen === key && "pt-tab-on")}
                aria-current={screen === key ? "page" : undefined}
                onClick={() => setScreen(key)}
              >
                <Icon size={26} aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>
        )}

        {/* 911 takeover */}
        {sos && (
          <div className="pt-overlay pt-sos" role="alertdialog" aria-modal="true" aria-labelledby="sosH" aria-describedby="sosDescription" tabIndex={-1}>
            <header className="pt-emergency-header"><Brand size={26} /><span>Emergency guidance</span></header>
            <div className="pt-emergency-body">
              <div className="pt-emergency-label"><AlertTriangle size={20} aria-hidden="true" />Immediate attention needed</div>
              <h1 id="sosH">Call 911 now</h1>
              <p id="sosDescription">Chest pain can be serious. Do not wait for a response through this portal.</p>
              <div className="pt-emergency-guidance">
                <h2>What to do now</h2>
                <ol><li>Call 911 for emergency assistance.</li><li>Do not drive yourself.</li></ol>
              </div>
              <button className="pt-btn pt-emergency-call" onClick={() => call("911")}><Phone size={22} aria-hidden="true" />Call 911</button>
              <p className="pt-emergency-note">Demonstration only. This button previews the call screen; it does not place a call or notify your care team.</p>
              <button className="pt-btn back" onClick={() => setSos(false)}>Return to my plan</button>
            </div>
            <footer className="pt-emergency-footer"><ShieldCheck size={16} aria-hidden="true" />ClearPath · Patient recovery support</footer>
          </div>
        )}

        {/* calling mock */}
        {calling && (
          <div className="pt-overlay pt-calling" role="dialog" aria-modal="true" aria-labelledby="callH" tabIndex={-1}>
            <div className="box">
              <Phone size={44} aria-hidden="true" />
              <h2 id="callH" style={{ marginTop: 8 }}>
                Call preview: {calling}
              </h2>
              <p className="fine">Demonstration only. No call is placed.</p>
              <button className="pt-btn" onClick={() => setCalling(null)}>
                Close preview
              </button>
            </div>
          </div>
        )}

        {toast && (
          <div className="pt-toast" role="status">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- OTP ---------- */
function OtpScreen({ onSuccess }: { onSuccess: () => void }) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [tries, setTries] = useState(5);
  const [state, setState] = useState<"" | "wrong" | "cool">("");
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, "").slice(0, 1);
    setDigits((d) => {
      const next = [...d];
      next[i] = clean;
      return next;
    });
    if (clean && i < 5) refs.current[i + 1]?.focus();
  }

  function submit() {
    const code = digits.join("");
    if (code === DEMO_OTP) {
      setState("");
      onSuccess();
      return;
    }
    const left = Math.max(0, tries - 1);
    setTries(left);
    setState(left === 0 ? "cool" : "wrong");
  }

  const disabled = state === "cool";

  return (
    <section aria-labelledby="h-otp">
      <h1 id="h-otp">Welcome, Eleanor.</h1>
      <p className="lead">
        Your hospital sent you a secure link. Enter the 6-digit code to see your
        plan.
      </p>
      <button
        type="button"
        className="pt-sms"
        onClick={() => setDigits([..."418203"])}
      >
        <span className="cp-chip cp-chip--blue">
          <Lock size={18} aria-hidden="true" />
          MOCK: not a real text message
        </span>
        <q>RWJ: Your ClearPath code is 418-203. Expires in 15 minutes.</q>
        <small>Tap this message to fill in the code (demo shortcut).</small>
      </button>
      <div className="pt-otp" role="group" aria-label="6-digit code">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            inputMode="numeric"
            maxLength={1}
            disabled={disabled}
            aria-label={`Digit ${i + 1}`}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0)
                refs.current[i - 1]?.focus();
              if (e.key === "Enter") submit();
            }}
          />
        ))}
      </div>
      {state === "wrong" && (
        <div className="pt-msg pt-msg--red" role="alert">
          <AlertTriangle size={26} aria-hidden="true" />
          <span>
            That code didn&apos;t match. Please try again. ({tries}{" "}
            {tries === 1 ? "try" : "tries"} left)
          </span>
        </div>
      )}
      {state === "cool" && (
        <div className="pt-msg pt-msg--red" role="alert">
          <Lock size={26} aria-hidden="true" />
          <span>
            Too many tries. For your safety, please wait 15 minutes, or call your
            care team at {PHONE}.
          </span>
        </div>
      )}
      <button className="pt-btn" onClick={submit} disabled={disabled}>
        See my plan
      </button>
      <p className="fine center" style={{ marginTop: 16, textAlign: "center" }}>
        No code? Call your care team at {PHONE}.
      </p>
    </section>
  );
}

/* ---------- Language bar ---------- */
function LangBar({
  lang,
  setLang,
}: {
  lang: Language;
  setLang: (l: Language) => void;
}) {
  return (
    <div className="pt-langbar" role="group" aria-label="Language">
      {(Object.keys(LANGUAGE_LABELS) as Language[]).map((k) => (
        <button
          key={k}
          type="button"
          className={clsx("pt-pill", lang === k && "pt-pill--on")}
          aria-pressed={lang === k}
          onClick={() => setLang(k)}
        >
          <Globe size={22} aria-hidden="true" />
          <span lang={k}>{LANGUAGE_LABELS[k]}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Home ---------- */
function HomeScreen({
  t,
  lang,
  setLang,
  daysLeft,
  go,
  done,
  setDone,
}: {
  t: (typeof UI)[Language];
  lang: Language;
  setLang: (l: Language) => void;
  daysLeft: number;
  go: (s: Screen) => void;
  done: Record<string, boolean>;
  setDone: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const content = ELEANOR_PLAN_CONTENT[lang];
  const C = 2 * Math.PI * 38;
  const off = C * (1 - daysLeft / 30);
  const expDate = new Date(Date.now() + daysLeft * 864e5).toLocaleDateString(
    t.localeDate,
    { year: "numeric", month: "long", day: "numeric" },
  );
  return (
    <section>
      <h1>{t.hello}</h1>
      <p className="lead">{t.sub}</p>
      <div className="pt-daily-plan">
        <div className="pt-plan-heading"><h2>{t.todoNav}</h2><span className="muted tn">{content.todos.filter((item) => done[item.id]).length} / {content.todos.length}</span></div>
        <progress className="pt-plan-progress" aria-label={t.todoNav} value={content.todos.filter((item) => done[item.id]).length} max={content.todos.length} />
        {content.todos.map((item) => <button key={item.id} className="pt-todo" type="button" aria-pressed={!!done[item.id]} onClick={() => setDone((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}><span className="box"><Check size={22} aria-hidden="true" /></span><span className="t">{item.label}</span></button>)}
        <button className="pt-btn pt-btn--ghost" type="button" onClick={() => go("checkin")}><Heart size={22} aria-hidden="true" />{t.checkin}<ChevronRight size={20} aria-hidden="true" /></button>
      </div>
      <button className="pt-buddy" type="button" onClick={() => go("chat")}><span className="pt-buddy-icon"><MessageCircle size={26} aria-hidden="true" /></span><span><b>{t.tabChat}</b><small>{lang === "en" ? "Review information from your discharge plan." : t.sub}</small></span><ChevronRight size={22} aria-hidden="true" /></button>
      <button className="pt-btn pt-btn--big" type="button">
        <Volume2 size={30} aria-hidden="true" />
        <span>{t.play}</span>
      </button>
      <p className="fine center" style={{ marginTop: 8, textAlign: "center" }}>
        {t.playSub}
      </p>
      <LangBar lang={lang} setLang={setLang} />
      <div className="pt-card pt-card--sage pt-count">
        <div
          className="pt-ring"
          role="img"
          aria-label={`${daysLeft} of 30 days left`}
        >
          <svg width="92" height="92" viewBox="0 0 92 92">
            <circle cx="46" cy="46" r="38" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="9" />
            <circle
              cx="46"
              cy="46"
              r="38"
              fill="none"
              stroke="currentColor"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={C.toFixed(1)}
              strokeDashoffset={off.toFixed(1)}
            />
          </svg>
          <b>{daysLeft}</b>
        </div>
        <div>
          <h2 style={{ margin: 0 }}>{t.daysLeft(daysLeft)}</h2>
          <p style={{ margin: "6px 0 0", fontSize: 18 }}>{t.stays(expDate)}</p>
        </div>
      </div>
      <div className="pt-card">
        <h2>{content.whyTitle}</h2>
        <p style={{ margin: 0 }}>{content.why}</p>
      </div>
      <button className="pt-linkcard" type="button" onClick={() => go("todo")}>
        <ListChecks size={30} aria-hidden="true" />
        <span>
          <b>{t.todoNav}</b>
          <small>{t.todoNavSub}</small>
        </span>
        <span className="go">
          <ChevronRight size={24} aria-hidden="true" />
        </span>
      </button>
      <button
        className="pt-linkcard"
        type="button"
        onClick={() => go("help")}
        style={{ border: "2px solid var(--amber)" }}
      >
        <LifeBuoy size={30} aria-hidden="true" />
        <span>
          <b>{t.helpNav}</b>
          <small>{t.helpNavSub}</small>
        </span>
        <span className="go">
          <ChevronRight size={24} aria-hidden="true" />
        </span>
      </button>
      <h2 style={{ marginTop: 24 }}>{t.more}</h2>
      <button className="pt-linkcard" type="button" onClick={() => go("checkin")}>
        <Heart size={28} aria-hidden="true" />
        <span>
          <b>{t.checkin}</b>
        </span>
        <span className="go">
          <ChevronRight size={24} aria-hidden="true" />
        </span>
      </button>
      <button className="pt-linkcard" type="button">
        <Share2 size={28} aria-hidden="true" />
        <span>
          <b>{t.share}</b>
        </span>
        <span className="go">
          <ChevronRight size={24} aria-hidden="true" />
        </span>
      </button>
    </section>
  );
}

/* ---------- Meds ---------- */
function MedsScreen({
  t,
  lang,
  setLang,
}: {
  t: (typeof UI)[Language];
  lang: Language;
  setLang: (l: Language) => void;
}) {
  const content = ELEANOR_PLAN_CONTENT[lang];
  const groups: Array<{
    key: "new" | "keep" | "stop";
    verb: string;
    label: string;
    Icon: typeof Plus;
  }> = [
    { key: "new", verb: t.verbNew, label: t.groupNew, Icon: Plus },
    { key: "keep", verb: t.verbKeep, label: t.groupKeep, Icon: RefreshCw },
    { key: "stop", verb: t.verbStop, label: t.groupStop, Icon: Ban },
  ];
  return (
    <section>
      <h1>{t.medsTitle}</h1>
      <p className="lead">{t.medsIntro}</p>
      <LangBar lang={lang} setLang={setLang} />
      {groups.map(({ key, verb, label, Icon }) => (
        <section
          key={key}
          className={`pt-block pt-block--${key}`}
          aria-label={label}
        >
          <div className="pt-block-h">
            <Icon size={28} aria-hidden="true" />
            <span className="verb">{verb}</span>
            <button className="pt-listen" type="button" aria-label={`${t.listen}: ${label}`}>
              <Volume2 size={22} aria-hidden="true" />
              {t.listen}
            </button>
            <span style={{ fontSize: 18, fontWeight: 700, flex: "1 1 100%" }}>
              {label}
            </span>
          </div>
          {content.medications[key].map((m) => (
            <div className="pt-med" key={m.name}>
              <div className="pt-med-name">
                <bdi dir="ltr">{m.name}</bdi>
                {m.dose ? (
                  <>
                    {" "}
                    <bdi dir="ltr" className="dose">
                      {m.dose}
                    </bdi>
                  </>
                ) : null}
              </div>
              {m.frequency && <div className="pt-med-time">{m.frequency}</div>}
              {m.note && <div className="pt-med-note">{m.note}</div>}
              {m.warning && (
                <div className="pt-warn" role="note">
                  <AlertTriangle size={26} aria-hidden="true" />
                  <span>{m.warning}</span>
                </div>
              )}
            </div>
          ))}
        </section>
      ))}
    </section>
  );
}

/* ---------- To-do + appointments ---------- */
function TodoScreen({ call, done, setDone }: { call: (who: string) => void; done: Record<string, boolean>; setDone: React.Dispatch<React.SetStateAction<Record<string, boolean>>> }) {
  const content = ELEANOR_PLAN_CONTENT.en;
  return (
    <section aria-labelledby="h-todo">
      <h1 id="h-todo">Today&apos;s to-do</h1>
      <p className="lead">Tap each one when it is done.</p>
      {content.todos.map((item) => (
        <button
          key={item.id}
          className="pt-todo"
          type="button"
          aria-pressed={!!done[item.id]}
          onClick={() => setDone((d) => ({ ...d, [item.id]: !d[item.id] }))}
        >
          <span className="box">
            <Check size={22} aria-hidden="true" />
          </span>
          <span className="t">{item.label}</span>
        </button>
      ))}

      <h2 style={{ marginTop: 28 }}>Your appointments</h2>
      {content.appointments.map((a) => (
        <div className="pt-card" key={a.type}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Calendar size={30} aria-hidden="true" />
            <div>
              <h3>{a.type}</h3>
              <p className="lead" style={{ margin: 0 }}>
                {a.when}
              </p>
              {a.scheduleNeeded && (
                <p style={{ margin: "8px 0 12px" }}>
                  <span className="cp-chip cp-chip--amber">
                    <AlertTriangle size={18} aria-hidden="true" />
                    No date yet. Call to set.
                  </span>
                </p>
              )}
            </div>
          </div>
          {a.scheduleNeeded && (
            <button
              className="pt-btn pt-btn--sm pt-btn--ghost"
              type="button"
              onClick={() => call("Care team")}
            >
              Call to set
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

/* ---------- Help ---------- */
function HelpScreen({
  call,
  setSos,
}: {
  call: (who: string) => void;
  setSos: (b: boolean) => void;
}) {
  const content = ELEANOR_PLAN_CONTENT.en;
  const yellow = content.warnings.find((w) => w.severity === "yellow");
  const red = content.warnings.find((w) => w.severity === "red");
  return (
    <section aria-labelledby="h-help">
      <h1 id="h-help">Get help</h1>
      <p className="lead">Review the symptoms below to find the appropriate level of care.</p>
      <div className="pt-zone pt-zone--yellow">
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Phone size={34} aria-hidden="true" />
          <span className="cp-chip cp-chip--amber" style={{ border: "2px solid var(--amber)" }}>
            Call your care team
          </span>
        </div>
        <h2 style={{ marginTop: 12 }}>Call your care team if you have:</h2>
        <ul>
          {yellow?.items.map((it) => (
            <li key={it}>{it}</li>
          ))}
        </ul>
        <button
          className="pt-btn pt-btn--amber"
          type="button"
          onClick={() => call("Care team")}
          style={{ borderWidth: 3 }}
        >
          <Phone size={24} aria-hidden="true" />
          Call care team {PHONE}
        </button>
      </div>
      <div className="pt-zone pt-zone--red">
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Siren size={34} aria-hidden="true" />
          <span className="cp-chip cp-chip--red" style={{ border: "2px solid var(--red)" }}>
            Emergency — call 911
          </span>
        </div>
        <h2 style={{ marginTop: 12 }}>Go to the ER or call 911 if you have:</h2>
        <ul>
          {red?.items.map((it) => (
            <li key={it}>{it}</li>
          ))}
        </ul>
        <button
          className="pt-btn pt-btn--red"
          type="button"
          onClick={() => call("911")}
          style={{ minHeight: 72, fontSize: 24 }}
        >
          <Phone size={28} aria-hidden="true" />
          Call 911
        </button>
      </div>

      {/* keep setSos referenced for parity with chat/check-in escalation */}
      <button
        type="button"
        className="pt-btn pt-btn--ghost pt-btn--sm"
        onClick={() => setSos(true)}
        style={{ marginTop: 4 }}
      >
        Show emergency screen
      </button>
    </section>
  );
}

/* ---------- Chat (plan-grounded + triage) ---------- */
type Bubble = { who: "bot" | "me" | "care"; html: string };
const CHIPS = [
  "When do I take apixaban?",
  "Can I take ibuprofen?",
  "Can I drink alcohol?",
  "What's for dinner?",
  "I have chest pain",
  "I feel alone",
];

function ChatScreen({
  setSos,
  call,
}: {
  setSos: (b: boolean) => void;
  call: (who: string) => void;
}) {
  const [msgs, setMsgs] = useState<Bubble[]>([
    {
      who: "bot",
      html: "Hi Eleanor. I can answer questions about your plan. I don't give new medical advice.",
    },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  function ask(qRaw: string) {
    const q = qRaw.trim();
    if (!q) return;
    const l = q.toLowerCase();
    setMsgs((m) => [...m, { who: "me", html: q }]);
    setInput("");
    setTimeout(() => {
      let reply: Bubble;
      if (/hurt myself|kill myself|end my life|suicid|want to die|don'?t want to live/.test(l)) {
        reply = {
          who: "care",
          html: "I'm really glad you told me. Please call or text <b>988</b>. It is free and open all day, every day. If you are in danger right now, call 911. <b>Your care team has been flagged.</b>",
        };
      } else if (/chest (pain|pressure)|can'?t breathe|cannot breathe|faint|passed out/.test(l)) {
        setSos(true);
        reply = {
          who: "care",
          html: "<b>This can be an emergency. Call 911 now.</b> This demonstration does not notify your care team.",
        };
      } else if (/alone|lonely|sad|depress/.test(l)) {
        reply = {
          who: "care",
          html: "I'm sorry you're feeling this way. You are not alone. You can call or text <b>988</b> anytime to talk to someone. <b>Your care team has been told.</b>",
        };
      } else if (/apixaban|blood thinner/.test(l)) {
        reply = {
          who: "bot",
          html: 'Apixaban 5 mg, twice a day. It is a blood thinner. Watch for bleeding.<span class="src">From: Your medicines, KEEP TAKING</span>',
        };
      } else if (/ibuprofen|advil|motrin|naproxen|aleve|nsaid/.test(l)) {
        reply = {
          who: "bot",
          html: 'No. Your plan says avoid ibuprofen (Advil, Motrin) and naproxen (Aleve). They can hurt your heart and kidneys.<span class="src">From: Your medicines, STOP or HOLD</span>',
        };
      } else if (/dinner|eat|food|salt|meal/.test(l)) {
        reply = {
          who: "bot",
          html: 'Keep meals low salt: about 2 grams of sodium a day.<span class="src">From: Today\'s to-do</span>',
        };
      } else {
        reply = {
          who: "bot",
          html: `I don't see that in your plan. Please call your care team at ${PHONE}.`,
        };
      }
      setMsgs((m) => [...m, reply]);
    }, 380);
  }

  return (
    <section aria-labelledby="h-chat">
      <h1 id="h-chat">Ask about your plan</h1>
      <p className="fine">Answers are based on your approved discharge plan.</p><div className="pt-message-notice"><Clock size={18} aria-hidden="true" /><span>For urgent concerns, call your care team. For an emergency, call 911.</span></div>
      <div className="pt-chat" aria-live="polite">
        {msgs.map((b, i) => (
          <div
            key={i}
            className={clsx("pt-bub", `pt-bub--${b.who}`)}
            dangerouslySetInnerHTML={{ __html: b.html }}
          />
        ))}
        {msgs.some((m) => m.who === "care" && /988/.test(m.html)) && (
          <button
            className="pt-btn pt-btn--sm"
            type="button"
            onClick={() => call("988")}
          >
            <Phone size={22} aria-hidden="true" />
            Call 988
          </button>
        )}
        <div ref={endRef} />
      </div>
      <div className="pt-chips">
        {CHIPS.map((c) => (
          <button key={c} className="pt-qchip" type="button" onClick={() => ask(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="pt-composer">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ask(input);
          }}
          placeholder="Type your question"
          aria-label="Type your question"
          autoComplete="off"
        />
        <button type="button" aria-label="Send" onClick={() => ask(input)}>
          <Send size={26} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

/* ---------- Check-in ---------- */
function CheckinScreen({
  setSos,
  call,
}: {
  setSos: (b: boolean) => void;
  call: (who: string) => void;
}) {
  const BASE = 182;
  const [wt, setWt] = useState(BASE);
  const [sym, setSym] = useState<Set<string>>(new Set(["fine"]));
  const [result, setResult] = useState<"green" | "yellow" | "red" | null>(null);

  function toggle(v: string) {
    setSym((s) => {
      const next = new Set(s);
      if (v === "fine") return new Set(next.has("fine") ? [] : ["fine"]);
      next.delete("fine");
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  }

  function submit() {
    const gain = wt - BASE;
    if (sym.has("chest")) {
      setSos(true);
      setResult("red");
    } else if (gain >= 3 || sym.has("breath") || sym.has("swell") || sym.has("dizzy")) {
      setResult("yellow");
    } else {
      setResult("green");
    }
  }

  const SYMS: Array<[string, string]> = [
    ["breath", "More short of breath"],
    ["swell", "More swelling"],
    ["chest", "Chest pain"],
    ["dizzy", "Dizzy"],
    ["fine", "Feeling fine"],
  ];

  return (
    <section aria-labelledby="h-ci">
      <h1 id="h-ci">Daily check-in</h1>
      <p className="lead">
        Yesterday you weighed <b>182 lb</b>. What do you weigh this morning?
      </p>
      <div className="pt-stepper">
        <button type="button" aria-label="One pound less" onClick={() => setWt((w) => Math.max(120, w - 1))}>
          <Minus size={34} aria-hidden="true" />
        </button>
        <div className="num" aria-live="polite">
          {wt}
          <small>pounds</small>
        </div>
        <button type="button" aria-label="One pound more" onClick={() => setWt((w) => Math.min(260, w + 1))}>
          <Plus size={34} aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        className="pt-btn pt-btn--ghost pt-btn--sm"
        onClick={() => setWt(186)}
      >
        DEMO: set to 186 lb (+4)
      </button>
      <h2 style={{ marginTop: 16 }}>How do you feel?</h2>
      <div className="pt-chips" style={{ gap: 10 }}>
        {SYMS.map(([v, label]) => (
          <button
            key={v}
            className="pt-tog"
            type="button"
            aria-pressed={sym.has(v)}
            onClick={() => toggle(v)}
          >
            {label}
          </button>
        ))}
      </div>
      <button className="pt-btn" type="button" onClick={submit} style={{ marginTop: 12 }}>
        Submit check-in
      </button>
      <div role="status">
        {result === "green" && (
          <div className="pt-result pt-result--green">
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <Check size={34} aria-hidden="true" />
              <div>
                <h2>You&apos;re on track</h2>
                <p style={{ margin: 0 }}>See you tomorrow.</p>
              </div>
            </div>
          </div>
        )}
        {result === "yellow" && (
          <div className="pt-result pt-result--yellow">
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <Phone size={34} aria-hidden="true" />
              <div>
                <h2>Call your care team today</h2>
                <p style={{ margin: "0 0 10px" }}>
                  Your weight is up {wt - BASE} lb. Please call your care team
                  today. {PHONE}.
                </p>
                <p style={{ margin: 0 }}>
                  This demonstration does not notify your care team.
                </p>
              </div>
            </div>
            <button
              className="pt-btn pt-btn--amber"
              type="button"
              onClick={() => call("Care team")}
              style={{ marginTop: 14, borderWidth: 3 }}
            >
              <Phone size={24} aria-hidden="true" />
              Call care team
            </button>
          </div>
        )}
        {result === "red" && (
          <div className="pt-card pt-card--red">
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <Siren size={34} aria-hidden="true" />
              <div>
                <h2>Call 911</h2>
                <p style={{ margin: 0 }}>Chest pain can be serious. Do not wait.</p>
              </div>
            </div>
            <button
              className="pt-btn pt-btn--red"
              type="button"
              onClick={() => call("911")}
            >
              <Phone size={26} aria-hidden="true" />
              Call 911
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- Expired ---------- */
function ExpiredScreen({
  call,
  onRestart,
}: {
  call: (who: string) => void;
  onRestart: () => void;
}) {
  return (
    <section aria-labelledby="h-exp">
      <div className="pt-card pt-card--gray" style={{ marginTop: 40, padding: "32px 22px", textAlign: "center" }}>
        <Clock size={56} aria-hidden="true" />
        <h1 id="h-exp" style={{ marginTop: 14 }}>
          This plan has expired.
        </h1>
        <p>
          Your plan was only kept for 30 days and has now been removed for your
          privacy. If you need your instructions, please call your care team at{" "}
          {PHONE}.
        </p>
        <button className="pt-btn" type="button" onClick={() => call("Care team")}>
          <Phone size={24} aria-hidden="true" />
          Call care team
        </button>
      </div>
      <p className="fine center" style={{ textAlign: "center" }}>
        <button
          className="pt-btn pt-btn--ghost pt-btn--sm"
          type="button"
          onClick={onRestart}
        >
          DEMO: restart the prototype
        </button>
      </p>
    </section>
  );
}

// Expired state is reached from the DEMO expire button or the /p/[token]?expired path.
