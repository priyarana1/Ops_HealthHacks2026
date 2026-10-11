"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Brand } from "@/components/ui/Brand";
import { clsx } from "@/lib/clsx";
import {
  Home,
  Pill,
  ListChecks,
  ClipboardPen,
  Lightbulb,
  Heart,
  Download,
  X,
  MessageCircle,
  Lock,
  AlertTriangle,
  Phone,
  Calendar,
  Check,
  Ban,
  ChevronRight,
  Clock,
  Send,
  ShieldCheck,
  Sunrise,
  Sun,
  Moon,
  UserRound,
  Utensils,
  GlassWater,
  MapPin,
  ExternalLink,
  CircleHelp,
} from "lucide-react";
import { ELEANOR_PLAN_CONTENT } from "@/mocks/plan";
import { medicationSchedule } from "@/lib/plan-adapter";
import { downloadProgressPdf, type ProgressReport } from "@/lib/progress-pdf";
import { DEMO_OTP, ELEANOR } from "@/mocks/patient";
import { UI } from "@/lib/i18n";
import { LANGUAGE_LABELS, LANGUAGE_DIR } from "@/types/plan";
import type { Language, PlanContent, Medication } from "@/types/plan";

const PHONE = "(732) 555-0100";
type Screen = "otp" | "home" | "meds" | "todo" | "chat" | "checkin" | "expired" | "profile" | "articles";

/** The plan shown in the app. The default is the Eleanor demo; real patients get their approved plan. */
export interface PatientData {
  name: string;
  firstName: string;
  age?: number;
  diagnosis: string;
  expiresAt: string;
  content: Partial<Record<Language, PlanContent>>;
  demo: boolean;
}
const DEMO_DATA: PatientData = { name: ELEANOR.name, firstName: "Eleanor", age: ELEANOR.age, diagnosis: ELEANOR.primaryDiagnosis, expiresAt: new Date(Date.now() + 27 * 864e5).toISOString(), content: ELEANOR_PLAN_CONTENT, demo: true };
const PatientDataContext = createContext<PatientData>(DEMO_DATA);
const usePatientData = () => useContext(PatientDataContext);
/** Content in the chosen language, falling back to English when that language is not published. */
function usePlanContent(lang: Language): PlanContent {
  const data = usePatientData();
  return data.content[lang] ?? data.content.en!;
}
/** Result of checking a 6-digit code against the server. */
export type CodeCheck = { ok: true } | { ok: false; triesLeft: number };

export function PatientApp({ expired = false, data = DEMO_DATA, verify, signedIn = false, locked = false }: {
  expired?: boolean;
  data?: PatientData;
  /** Real patients: checks the code with the server. Omitted for the demo, which uses the sample code. */
  verify?: (code: string) => Promise<CodeCheck>;
  signedIn?: boolean;
  locked?: boolean;
}) {
  const [lang, setLang] = useState<Language>("en");
  const [screen, setScreen] = useState<Screen>(expired ? "expired" : signedIn ? "home" : "otp");
  const [done, setDone] = useState<Record<string, boolean>>({});
  // Support plan members, kept here so they survive switching tabs (on screen only; nothing is stored or sent).
  const [members, setMembers] = useState<SupportMember[]>([]);
  const [calling, setCalling] = useState<string | null>(null);
  const [sos, setSos] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const deviceRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cp_patient_language");
      if (saved && Object.prototype.hasOwnProperty.call(data.content, saved)) setLang(saved as Language);
    } catch { /* Language selection still works when browser storage is unavailable. */ }
  }, [data.content]);
  useEffect(() => { if (expired) setScreen("expired"); }, [expired]);

  const t = UI[lang];
  const dir = LANGUAGE_DIR[lang];
  // Today's date, set after mount so it uses the patient's own clock and time zone.
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => { setToday(new Date()); }, []);
  const daysLeft = Math.max(0, Math.ceil((new Date(data.expiresAt).getTime() - Date.now()) / 864e5));

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
    try { localStorage.setItem("cp_patient_language", l); } catch { /* Keep the selection for this visit. */ }
    showToast(`${LANGUAGE_LABELS[l]}`);
  }

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [screen]);

  const bare = screen === "otp" || screen === "expired";

  return (
    <PatientDataContext.Provider value={data}>
    <div className="pt-stage">
      <div className="pt-device pt-clinical" ref={deviceRef}>

        <div className="pt-top">
          <div className="pt-portal-brand"><Brand size={28} /></div>
          <div className="pt-top-meta">
            {!bare && <span className="pt-who">{data.firstName}</span>}
            {today && <time className="pt-today" dateTime={today.toISOString().slice(0, 10)}>{today.toLocaleDateString(t.localeDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</time>}
          </div>
        </div>

        <main
          ref={mainRef}
          className={clsx(
            "pt-main",
            lang === "zh" && "lang-zh",
            lang === "ar" && "lang-ar",
          )}
          dir={dir}
          lang={lang}
        >
          {screen === "otp" && (
            <OtpScreen onSuccess={() => setScreen("home")} verify={verify} initiallyLocked={locked} />
          )}
          {screen === "home" && (
            <HomeScreen
              t={t}
              lang={lang}
              daysLeft={daysLeft}
              go={setScreen}
            />
          )}
          {screen === "meds" && (
            <MedsScreen t={t} lang={lang} />
          )}
          {screen === "todo" && <TodoScreen lang={lang} go={setScreen} call={call} done={done} setDone={setDone} />}
          {screen === "articles" && <ArticlesScreen lang={lang} go={setScreen} />}
          {screen === "profile" && <ProfileScreen lang={lang} changeLang={changeLang} members={members} setMembers={setMembers} done={done} />}
          {screen === "chat" && <ChatScreen lang={lang} setSos={setSos} call={call} />}
          {screen === "checkin" && <CheckinScreen onClose={() => setScreen("todo")} onExit={() => setScreen("home")} />}
          {screen === "expired" && (
            <ExpiredScreen call={call} onRestart={() => setScreen("otp")} />
          )}
        </main>

        {!bare && (
          <nav className="pt-tabs" aria-label="Main">
            {(
              [
                ["home", t.tabHome, Home],
                ["todo", t.tabTodo, ListChecks],
                ["chat", CHAT_HELP_LABEL[lang], MessageCircle],
                ["meds", t.tabMeds, Pill],
                ["profile", PROFILE_COPY[lang].title, UserRound],
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
                Calling {calling}…
              </h2>
              <button className="pt-btn" onClick={() => setCalling(null)}>
                End call
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
    </PatientDataContext.Provider>
  );
}

/* ---------- OTP ---------- */
function OtpScreen({ onSuccess, verify, initiallyLocked = false }: { onSuccess: () => void; verify?: (code: string) => Promise<CodeCheck>; initiallyLocked?: boolean }) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [tries, setTries] = useState(5);
  const [state, setState] = useState<"" | "wrong" | "cool">(initiallyLocked ? "cool" : "");
  const [checking, setChecking] = useState(false);
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

  async function submit() {
    const code = digits.join("");
    if (verify) {
      if (code.length !== 6 || checking) return;
      setChecking(true);
      const result = await verify(code).catch(() => ({ ok: false as const, triesLeft: tries }));
      setChecking(false);
      if (result.ok) {
        setState("");
        onSuccess();
        return;
      }
      setTries(result.triesLeft);
      setState(result.triesLeft === 0 ? "cool" : "wrong");
      return;
    }
    if (code === DEMO_OTP) {
      setState("");
      onSuccess();
      return;
    }
    const left = Math.max(0, tries - 1);
    setTries(left);
    setState(left === 0 ? "cool" : "wrong");
  }

  const disabled = state === "cool" || checking;

  return (
    <section aria-labelledby="h-otp">
      <h1 id="h-otp">{verify ? "Welcome." : "Welcome, Eleanor."}</h1>
      <p className="lead">
        Your hospital sent you a secure link. Enter the 6-digit code to see your
        plan.
      </p>
      {!verify && <button
        type="button"
        className="pt-sms"
        onClick={() => setDigits([..."418203"])}
      >
        <span className="cp-chip cp-chip--blue">
          <Lock size={18} aria-hidden="true" />
          Text message
        </span>
        <q>RWJ: Your ClearPath code is 418-203. Expires in 15 minutes.</q>
        <small>Tap this message to fill in the code.</small>
      </button>}
      {verify && <p className="fine">Use the 6-digit code your care team gave you at discharge.</p>}
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
            {verify ? <>Too many tries. For your safety this link is locked. Call your care team at {PHONE} for a new code.</> : <>Too many tries. For your safety, please wait 15 minutes, or call your
            care team at {PHONE}.</>}
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

/* ---------- Home ---------- */
const RECOVERY_COPY = {
  en: { title: "30-day recovery", dayOf: (n: number) => `Day ${n} of 30`, start: "Discharged", end: "Day 30" },
  es: { title: "Recuperación de 30 días", dayOf: (n: number) => `Día ${n} de 30`, start: "Alta", end: "Día 30" },
  zh: { title: "30 天康复", dayOf: (n: number) => `第 ${n} 天（共 30 天）`, start: "出院", end: "第 30 天" },
  ar: { title: "التعافي خلال 30 يومًا", dayOf: (n: number) => `اليوم ${n} من 30`, start: "الخروج", end: "اليوم 30" },
};

function HomeScreen({
  t,
  lang,
  daysLeft,
  go,
}: {
  t: (typeof UI)[Language];
  lang: Language;
  daysLeft: number;
  go: (s: Screen) => void;
}) {
  const data = usePatientData();
  const recovery = RECOVERY_COPY[lang];
  // Day 1 is the discharge day; the plan ends 30 days later.
  const day = Math.min(30, Math.max(1, 31 - daysLeft));
  const pct = (day / 30) * 100;
  const endsAt = new Date(data.expiresAt), dischargeAt = new Date(endsAt.getTime() - 30 * 864e5);
  const shortDate = (d: Date) => d.toLocaleDateString(t.localeDate, { month: "short", day: "numeric" });
  const expDate = new Date(data.expiresAt).toLocaleDateString(
    t.localeDate,
    { year: "numeric", month: "long", day: "numeric" },
  );
  return (
    <section>
      <h1>{t.hello.replace("Eleanor", data.firstName)}</h1>
      <p className="lead">{t.sub}</p>
      <section className="pt-card pt-recovery" aria-label={recovery.dayOf(day)}>
        <div className="pt-recovery-head">
          <span className="pt-recovery-icon"><Heart size={26} aria-hidden="true" /></span>
          <div>
            <p className="pt-recovery-kicker">{recovery.title}</p>
            <h2>{recovery.dayOf(day)}</h2>
          </div>
          <span className="pt-recovery-left">{t.daysLeft(daysLeft)}</span>
        </div>
        <div className="pt-recovery-track" role="progressbar" aria-valuemin={1} aria-valuemax={30} aria-valuenow={day} aria-valuetext={recovery.dayOf(day)}>
          <div className="pt-recovery-fill" style={{ width: `${pct}%` }} />
          {[7, 14, 21].map((week) => <span key={week} className={clsx("pt-recovery-tick", day >= week && "pt-recovery-tick--passed")} style={{ insetInlineStart: `${(week / 30) * 100}%` }} aria-hidden="true" />)}
          <span className="pt-recovery-marker" style={{ insetInlineStart: `${pct}%` }} aria-hidden="true"><Heart size={16} fill="currentColor" /></span>
        </div>
        <div className="pt-recovery-ends">
          <span>{recovery.start}<b>{shortDate(dischargeAt)}</b></span>
          <span>{recovery.end}<b>{shortDate(endsAt)}</b></span>
        </div>
        <p className="pt-recovery-note">{t.stays(expDate)}</p>
      </section>
      <div className="pt-home-actions">
        <button className="pt-linkcard" type="button" onClick={() => go("todo")}><span className="pt-link-icon pt-link-icon--blue"><ListChecks size={26} aria-hidden="true" /></span><span><b>{ARTICLE_COPY[lang].todo}</b></span><ChevronRight size={24} className="go" aria-hidden="true" /></button>
        <button className="pt-linkcard" type="button" onClick={() => go("checkin")}><span className="pt-link-icon pt-link-icon--sage"><ClipboardPen size={26} aria-hidden="true" /></span><span><b>{{ en: "Bring me to my questionnaire", es: "Ir a mi cuestionario", zh: "查看我的问卷", ar: "انتقل إلى استبياني" }[lang]}</b></span><ChevronRight size={24} className="go" aria-hidden="true" /></button>
      </div>
      <RecommendedTips lang={lang} />
    </section>
  );
}

const ARTICLE_COPY = {
  en: { todo: "Bring me to my to-do list", open: "Bring me to recommended articles", title: "Recommended articles", intro: "Learn more about caring for your heart.", external: "Opens the source website · Articles are in English", back: "Back to Home", titles: ["Understanding heart failure", "Keeping track of symptoms", "Understanding your medicines"] },
  es: { todo: "Ir a mi lista de tareas", open: "Ver artículos recomendados", title: "Artículos recomendados", intro: "Aprenda más sobre el cuidado de su corazón.", external: "Abre el sitio original · Artículos en inglés", back: "Volver al inicio", titles: ["Entender la insuficiencia cardíaca", "Registrar los síntomas", "Entender sus medicamentos"] },
  zh: { todo: "查看待办事项", open: "查看推荐文章", title: "推荐文章", intro: "了解更多心脏护理知识。", external: "打开原网站——文章为英文", back: "返回首页", titles: ["了解心力衰竭", "记录症状", "了解您的药物"] },
  ar: { todo: "انتقل إلى قائمة مهامي", open: "عرض المقالات الموصى بها", title: "مقالات موصى بها", intro: "تعرّف على رعاية قلبك.", external: "يفتح موقع المصدر — المقالات باللغة الإنجليزية", back: "العودة للرئيسية", titles: ["فهم قصور القلب", "تتبع الأعراض", "فهم أدويتك"] },
};
const TIP_COPY = {
  en: { title: "Recommended Tips", intro: "For your heart-failure recovery.", diet: "Low-salt eating", meals: "Low-sodium meals", foods: "Foods to limit and simple swaps", activity: "Physical activity with heart failure", note: "Follow your care team’s food and activity plan. Ask before starting new exercise." },
  es: { title: "Consejos recomendados", intro: "Para su recuperación de la insuficiencia cardíaca.", diet: "Comer con menos sal", meals: "Comidas bajas en sodio", foods: "Alimentos que limitar y alternativas", activity: "Actividad física con insuficiencia cardíaca", note: "Siga el plan de alimentación y actividad de su equipo. Consulte antes de comenzar un ejercicio nuevo." },
  zh: { title: "推荐建议", intro: "帮助您的心力衰竭康复。", diet: "低盐饮食", meals: "低钠食谱", foods: "需要限制的食物和替代选择", activity: "心力衰竭患者的身体活动", note: "遵循护理团队的饮食和活动计划。开始新的运动前，请先咨询。" },
  ar: { title: "نصائح موصى بها", intro: "للتعافي مع قصور القلب.", diet: "طعام قليل الملح", meals: "وجبات قليلة الصوديوم", foods: "أطعمة للحد منها وبدائل بسيطة", activity: "النشاط البدني مع قصور القلب", note: "اتبع خطة الغذاء والنشاط من فريق الرعاية. اسأل قبل بدء تمرين جديد." },
};
const HEART_FAILURE_TIPS = [
  { key: "meals" as const, topic: "salt", title: "Sodium-Smart Recipes", cover: "/article-covers/sodium-smart-recipes.png", source: "American Heart Association", url: "https://www.heart.org/-/media/Files/Health-Topics/Brochures/Sodium-Smart-Recipes.pdf" },
  { key: "foods" as const, topic: "salt", title: "The Salty Six: Stay Away", cover: "/article-covers/salty-six.jpg", source: "American Heart Association", url: "https://www.heart.org/-/media/aha/h4gm/pdf-files/salty-six-adults-english-infographic.pdf" },
  { key: "activity" as const, topic: "activity", title: "Living Well with Heart Failure", cover: "/article-covers/living-with-heart-failure.png", source: "Veterans Affairs · Veterans Health Library", url: "https://www.veteranshealthlibrary.va.gov/LivingWith/HeartFailure/" },
];
const READ_GUIDE = { en: "Read guide", es: "Leer guía", zh: "阅读指南", ar: "اقرأ الدليل" };
function RecommendedTips({ lang, showHeading = true }: { lang: Language; showHeading?: boolean }) {
  const copy = TIP_COPY[lang];
  const data = usePatientData();
  const content = usePlanContent(lang);
  const hasHeartFailure = /heart failure|hfref|hfpef/i.test(data.diagnosis);
  const hasLowSaltPlan = content.todos.some((item) => item.id === "salt");
  const tips = hasHeartFailure ? HEART_FAILURE_TIPS.filter((tip) => tip.topic !== "salt" || hasLowSaltPlan) : [];
  if (!tips.length) return null;
  return <section className="pt-recommended-tips pt-reading-library" aria-label={copy.title}>
    {showHeading && <><h2 className="pt-tips-title"><span className="pt-link-icon pt-link-icon--amber"><Lightbulb size={24} aria-hidden="true" /></span>{copy.title}</h2><p className="muted">{copy.intro}</p></>}
    <div className="pt-bookshelf">
      {tips.map((tip) => <a className="pt-book-card" key={tip.key} href={tip.url} target="_blank" rel="noopener noreferrer">
        <div className={clsx("pt-book-cover", `pt-book-cover--${tip.key}`)}><Image src={tip.cover} alt="" width={400} height={540} sizes="(max-width: 480px) 180px, 200px" className="pt-real-cover" /><span className="pt-book-pages" aria-hidden="true" /></div>
        <h3>{tip.title}</h3><p className="pt-book-publisher">{tip.source}</p>
        <span className="pt-book-read">{READ_GUIDE[lang]}<ChevronRight size={20} aria-hidden="true" /></span>
      </a>)}
    </div>
    <p className="pt-tip-note">{copy.note}</p><p className="fine">{ARTICLE_COPY[lang].external}</p>
  </section>;
}
function ArticlesScreen({ lang, go }: { lang: Language; go: (screen: Screen) => void }) {
  const copy = ARTICLE_COPY[lang];
  return <section aria-labelledby="articles-title"><h1 id="articles-title">{copy.title}</h1><p className="lead">{copy.intro}</p><RecommendedTips lang={lang} showHeading={false} /><button className="pt-btn pt-btn--ghost" type="button" onClick={() => go("home")} style={{ marginTop: 24 }}>{copy.back}</button></section>;
}

// Lowercase short words inside English title case ("Twice Daily for 3 Additional Days").
const MINOR_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "per", "the", "to", "with"]);
/** Capitalizes a schedule or route label: title case in English, first letter elsewhere. */
function labelCase(text: string | undefined, lang: Language) {
  if (!text) return text;
  if (lang !== "en") return text.charAt(0).toLocaleUpperCase(lang) + text.slice(1);
  return text.split(" ").map((word, i) => (i > 0 && MINOR_WORDS.has(word.toLowerCase()) ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1))).join(" ");
}

function pillCountLabel(count: number, lang: Language) {
  return { en: `${count} ${count === 1 ? "pill" : "pills"}`, es: `${count} ${count === 1 ? "pastilla" : "pastillas"}`, zh: `${count} 片`, ar: `${count} حبة` }[lang];
}

/* ---------- Meds: illustrative daily schedule ---------- */
const MED_TIMELINE_COPY = {
  en: { intro: "Your medicines, at a glance.", sample: "Sample times — confirm your schedule with your care team.", morning: "Morning", midday: "Midday", night: "Night", daily: "Daily view", details: "More details", none: "No medicines shown at this sample time.", stop: "Do not take these", sampleTime: "Sample time", nightTime: "At night", new: "New", keep: "Continue", doses: "medicines", bedtime: "Bedtime" },
  es: { intro: "Sus medicinas, de un vistazo.", sample: "Horas de ejemplo — confirme su horario con su equipo de atención.", morning: "Mañana", midday: "Mediodía", night: "Noche", daily: "Vista diaria", details: "Más detalles", none: "No se muestran medicinas a esta hora de ejemplo.", stop: "No tome estas", sampleTime: "Hora de ejemplo", nightTime: "Por la noche", new: "Nueva", keep: "Continuar", doses: "medicinas", bedtime: "Al acostarse" },
  zh: { intro: "一目了然的用药安排。", sample: "示例时间——请与护理团队确认您的用药时间。", morning: "早晨", midday: "中午", night: "夜间", daily: "每日安排", details: "更多详情", none: "此示例时间没有显示药物。", stop: "不要服用这些药物", sampleTime: "示例时间", nightTime: "夜间服用", new: "新药", keep: "继续", doses: "种药物", bedtime: "睡前" },
  ar: { intro: "أدويتك في لمحة.", sample: "أوقات توضيحية — أكد جدولك مع فريق الرعاية.", morning: "الصباح", midday: "الظهر", night: "الليل", daily: "الجدول اليومي", details: "مزيد من التفاصيل", none: "لا توجد أدوية معروضة في هذا الوقت التوضيحي.", stop: "لا تتناول هذه", sampleTime: "وقت توضيحي", nightTime: "ليلاً", new: "جديد", keep: "استمرار", doses: "أدوية", bedtime: "وقت النوم" },
};

const MED_CARD_COPY = {
  en: { dose: "Take", purpose: "What it’s for", route: "How to take it", label: "Use the pharmacy label for the number of tablets or liquid amount. If it differs from this plan, ask your pharmacist or care team." },
  es: { dose: "Tome", purpose: "Para qué sirve", route: "Cómo tomarla", label: "Use la etiqueta de la farmacia para el número de tabletas o la cantidad de líquido. Si difiere de este plan, consulte a su farmacéutico o equipo de atención." },
  zh: { dose: "剂量", purpose: "用途", route: "服用方式", label: "药片数量或液体用量以药房标签为准。如果与此计划不同，请咨询药剂师或护理团队。" },
  ar: { dose: "الجرعة", purpose: "الغرض", route: "طريقة التناول", label: "راجع ملصق الصيدلية لعدد الأقراص أو كمية السائل. إذا اختلف عن هذه الخطة، اسأل الصيدلي أو فريق الرعاية." },
};

type MedPeriod = "morning" | "midday" | "night";
// Clock times are presentation examples, never clinician-approved instructions.
// The source specifies frequencies and atorvastatin at night, not exact hours.
const SAMPLE_MED_PERIODS: Record<string, MedPeriod[]> = {
  Furosemide: ["morning"],
  Losartan: ["morning"],
  Empagliflozin: ["morning"],
  "Amoxicillin-clavulanate": ["morning", "night"],
  "Metoprolol succinate": ["morning"],
  Apixaban: ["morning", "night"],
  Atorvastatin: ["night"],
  Metformin: ["morning", "night"],
};

/** Illustrative times of day for a medicine, from its prescribed frequency. Never a clinical instruction. */
function medPeriods(m: Medication): MedPeriod[] {
  if (SAMPLE_MED_PERIODS[m.name]) return SAMPLE_MED_PERIODS[m.name];
  // English and Spanish wording (translated plans keep the same schedule).
  const f = (m.frequency ?? "").toLowerCase();
  if (/night|bedtime|noche|acostarse/.test(f)) return ["night"];
  if (/four times|4 times|qid|every 6 hours|cuatro veces|cada 6 horas/.test(f)) return ["morning", "midday", "night"];
  if (/three times|3 times|tid|every 8 hours|tres veces|cada 8 horas/.test(f)) return ["morning", "midday", "night"];
  if (/twice|two times|2 times|bid|every 12 hours|dos veces|cada 12 horas/.test(f)) return ["morning", "night"];
  if (/once|daily|every day|a day|every morning|qd|una vez|al día|diari|cada mañana/.test(f)) return ["morning"];
  return [];
}

function MedsScreen({ t, lang }: {
  t: (typeof UI)[Language];
  lang: Language;
}) {
  const [period, setPeriod] = useState<MedPeriod>("morning");
  const [helpMedicine, setHelpMedicine] = useState<string | null>(null);
  const helpDialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = helpDialogRef.current;
    if (helpMedicine && dialog) {
      dialog.closest("main")?.scrollTo({ top: 0, behavior: "instant" });
      if (!dialog.open) dialog.showModal();
      dialog.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
      dialog.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [helpMedicine]);
  const content = usePlanContent(lang);
  const data = usePatientData();
  const copy = MED_TIMELINE_COPY[lang];
  const cardCopy = MED_CARD_COPY[lang];
  const meds = [...content.medications.new.map((m) => ({ ...m, group: "new" as const })), ...content.medications.keep.map((m) => ({ ...m, group: "keep" as const }))];
  const slots = [
    { key: "morning" as const, time: "8 AM", Icon: Sunrise },
    { key: "midday" as const, time: "12 PM", Icon: Sun },
    { key: "night" as const, time: "8 PM", Icon: Moon },
  ];
  const selectedMeds = meds.filter((m) => medPeriods(m).includes(period));
  const helpMed = meds.find((m) => m.name === helpMedicine);
  const safetyNoteNames = ["Apixaban", "Metformin"];
  const medicationWarnings = meds.flatMap((m) => {
    const messages = [m.warning, safetyNoteNames.includes(m.name) ? m.note : undefined].filter((message): message is string => !!message);
    return messages.map((message) => ({ name: m.name, message }));
  });
  const helpCopy = {
    en: { button: "Medicine help", when: "When to take it", instructions: "What to do", close: "Close" },
    es: { button: "Ayuda con la medicina", when: "Cuándo tomarla", instructions: "Qué hacer", close: "Cerrar" },
    zh: { button: "用药帮助", when: "何时服用", instructions: "该怎么做", close: "关闭" },
    ar: { button: "مساعدة الدواء", when: "متى تتناوله", instructions: "ما يجب فعله", close: "إغلاق" },
  }[lang];
  const slot = slots.find((s) => s.key === period)!;
  return (
    <section className="pt-medicine-timeline" aria-labelledby="med-title">
      <h1 id="med-title">{t.medsTitle}</h1>
      {data.demo && <p className="pt-demo-pill-note">{{ en: "Confirm with your pharmacy label.", es: "Confirme con la etiqueta de la farmacia.", zh: "请核对药房标签。", ar: "تحقق من ملصق الصيدلية." }[lang]}</p>}
      <div className="pt-day-timeline pt-pill-case" role="group" aria-label={copy.daily}>
        {slots.map(({ key, time, Icon }) => {
          const count = meds.filter((m) => medPeriods(m).includes(key)).length;
          return <button key={key} type="button" aria-pressed={period === key} onClick={() => setPeriod(key)} className={clsx("pt-time-slot", `pt-pill-compartment--${key}`, period === key && "pt-time-slot--active")}>
            <span className="pt-pill-lid"><span className="pt-time-icon"><Icon size={28} aria-hidden="true" /></span><b>{copy[key]}</b><span className="pt-time-hour" dir="ltr">{time}</span></span>
            <span className="pt-pill-well"><Pill size={28} aria-hidden="true" /><span className="pt-time-count">{count} {copy.doses}</span></span>
            <span className="pt-pill-tab" aria-hidden="true">{period === key ? <Check size={20} /> : <ChevronRight size={20} />}</span>
          </button>;
        })}
      </div>
      <div className={clsx("pt-simple-meds", `pt-simple-meds--${period}`)}>
      <div className="pt-dose-heading"><span className="pt-period-icon"><slot.Icon size={28} aria-hidden="true" /></span><div><h2>{copy[period]}</h2><span className="pt-period-time" dir="ltr">{slot.time}</span></div></div>
      <div className="pt-dose-list">
        {selectedMeds.length === 0 && <p className="pt-no-doses">{copy.none}</p>}
        {selectedMeds.map((m) => <article className="pt-dose-card" key={m.name}>
          <div className="pt-dose-main"><Pill size={22} aria-hidden="true" /><div><h3><bdi dir="ltr">{m.name}</bdi></h3><p className="pt-dose-frequency">{labelCase(m.frequency, lang)}</p></div><div className="pt-dose-value"><span>{cardCopy.dose}</span><bdi className="pt-dose-amount">{m.tabletCount ? pillCountLabel(m.tabletCount, lang) : m.dose ?? cardCopy.label}</bdi></div></div>
          <button className="pt-medicine-help" type="button" aria-label={`${helpCopy.button}: ${m.name}`} aria-haspopup="dialog" onClick={() => setHelpMedicine(m.name)}><CircleHelp size={28} aria-hidden="true" /><span>{helpCopy.button}</span></button>
        </article>)}
      </div>
      </div>
      <dialog ref={helpDialogRef} className="pt-medicine-dialog" aria-labelledby="medicine-help-title" onCancel={() => setHelpMedicine(null)} onClose={() => setHelpMedicine(null)}>
        {helpMed && <>
          <h2 id="medicine-help-title" tabIndex={-1}><bdi dir="ltr">{helpMed.name}</bdi></h2>
          <dl className="pt-medicine-help-facts">
            <div><dt>{cardCopy.dose}</dt><dd>{helpMed.tabletCount ? pillCountLabel(helpMed.tabletCount, lang) : helpMed.dose ?? cardCopy.label}</dd></div>
            <div><dt>{helpCopy.when}</dt><dd>{labelCase(medicationSchedule(helpMed), lang)}</dd><dd>{medPeriods(helpMed).map((key) => { const time = slots.find((item) => item.key === key)!; return `${copy[key]} · ${time.time}`; }).join(" / ")}</dd></div>
            {helpMed.purpose && <div><dt>{cardCopy.purpose}</dt><dd>{helpMed.purpose}</dd></div>}
            {helpMed.route && <div><dt>{cardCopy.route}</dt><dd>{labelCase(helpMed.route, lang)}</dd></div>}
          </dl>
          {helpMed.note && !safetyNoteNames.includes(helpMed.name) && <div className="pt-medicine-help-instructions"><h3>{helpCopy.instructions}</h3><p>{helpMed.note}</p></div>}
          <p className="pt-med-label-note">{cardCopy.label}</p>
          <button className="pt-btn" type="button" onClick={() => helpDialogRef.current?.close()}>{helpCopy.close}</button>
        </>}
      </dialog>
      <p className="pt-med-label-note">{cardCopy.label}</p>
      <section className="pt-stopped-meds" aria-labelledby="stopped-title">
        <h2 id="stopped-title"><Ban size={22} aria-hidden="true" />{copy.stop}</h2>
        {content.medications.stop.map((m) => <div className="pt-stopped-row" key={m.name}><h3><bdi dir="ltr">{m.name}</bdi></h3><p>{m.note}</p></div>)}
      </section>
      {medicationWarnings.length > 0 && <section className="pt-medication-warnings" aria-labelledby="medication-warnings-title">
        <h2 id="medication-warnings-title">{{ en: "Medication safety", es: "Seguridad de los medicamentos", zh: "用药安全", ar: "سلامة الأدوية" }[lang]}</h2>
        <ul>{medicationWarnings.map(({ name, message }) => <li key={`${name}:${message}`}><h3><bdi dir="ltr">{name}</bdi></h3><p>{message}</p></li>)}</ul>
      </section>}
    </section>
  );
}

const CHECKLIST_COPY = {
  en: { title: "Today’s priorities", reminders: "Keep in mind all day", morning: "Take morning medicines", night: "Take night medicines", schedule: "Sample timing — confirm with your care team.", review: "See medicines and doses" },
  es: { title: "Prioridades de hoy", reminders: "Recuerde durante el día", morning: "Tome las medicinas de la mañana", night: "Tome las medicinas de la noche", schedule: "Horario de ejemplo — confirme con su equipo de atención.", review: "Ver medicinas y dosis" },
  zh: { title: "今天的重要事项", reminders: "全天注意", morning: "服用早晨药物", night: "服用夜间药物", schedule: "示例时间——请与护理团队确认。", review: "查看药物和剂量" },
  ar: { title: "أولويات اليوم", reminders: "تذكّر طوال اليوم", morning: "تناول أدوية الصباح", night: "تناول أدوية الليل", schedule: "أوقات توضيحية — أكدها مع فريق الرعاية.", review: "عرض الأدوية والجرعات" },
};

function DailyChecklist({ lang, done, setDone, onCheckin }: { onCheckin: () => void; lang: Language; done: Record<string, boolean>; setDone: React.Dispatch<React.SetStateAction<Record<string, boolean>>> }) {
  const content = usePlanContent(lang);
  const copy = CHECKLIST_COPY[lang];
  const activeMeds = [...content.medications.new, ...content.medications.keep];
  const tasks = content.todos.filter((item) => !["salt", "fluids", "meds", "checkin"].includes(item.id));
  const medicationTasks = (["morning", "night"] as const).map((period) => ({ id: `meds-${period}`, label: ({ en: "Took ALL medications", es: "Tomé TODOS los medicamentos", zh: "已服用所有药物", ar: "تناولت جميع الأدوية" })[lang], period }));
  const priorities = [...tasks, ...medicationTasks];
  const doseKey = (period: MedPeriod, name: string) => `dose:${period}:${name}`;
  const periodMeds = (period: MedPeriod) => activeMeds.filter((m) => medPeriods(m).includes(period));
  const isComplete = (id: string, state: Record<string, boolean>) => {
    const medicationTask = medicationTasks.find((item) => item.id === id);
    if (!medicationTask) return !!state[id];
    const medicines = periodMeds(medicationTask.period);
    return medicines.length > 0 && medicines.every((m) => state[doseKey(medicationTask.period, m.name)]);
  };
  function toggleTask(id: string) {
    setDone((prev) => {
      const medicationTask = medicationTasks.find((item) => item.id === id);
      if (!medicationTask) return { ...prev, [id]: !prev[id] };
      const next = { ...prev };
      const checked = !isComplete(id, prev);
      periodMeds(medicationTask.period).forEach((m) => { next[doseKey(medicationTask.period, m.name)] = checked; });
      return next;
    });
  }
  const completed = priorities.filter((item) => isComplete(item.id, done)).length;
  return <>
    <div className="pt-daily-plan">
      <div className="pt-plan-heading"><h2>{copy.title}</h2><span className="muted tn">{completed} / {priorities.length}</span></div>
      <progress className="pt-plan-progress" aria-label={copy.title} value={completed} max={priorities.length} />
      <p className="pt-checklist-timing">{copy.schedule}</p>
      {medicationTasks.map((medTask) => {
        const Icon = medTask.period === "morning" ? Sunrise : Moon;
        const periodTasks = medTask.period === "morning" ? [...tasks, medTask] : [medTask];
        return <section className={clsx("pt-priority-period", `pt-priority-period--${medTask.period}`)} key={medTask.period}>
          <div className="pt-period-heading"><span className="pt-period-icon"><Icon size={28} aria-hidden="true" /></span><div><h3>{MED_TIMELINE_COPY[lang][medTask.period]}</h3><span className="pt-period-time">{medTask.period === "morning" ? "8 AM" : "8 PM"}</span></div><span className="pt-period-progress" aria-label={`${copy.title}: ${periodTasks.filter((item) => isComplete(item.id, done)).length} / ${periodTasks.length}`}>{periodTasks.every((item) => isComplete(item.id, done)) && <Check size={18} aria-hidden="true" />}{periodTasks.filter((item) => isComplete(item.id, done)).length} / {periodTasks.length}</span></div>
          {periodTasks.map((item) => <div className="pt-priority-task" key={item.id}>
            <button className="pt-todo" type="button" aria-pressed={isComplete(item.id, done)} onClick={() => toggleTask(item.id)}><span className="box"><Check size={22} aria-hidden="true" /></span><span className="t">{item.id === "weigh" ? PROFILE_COPY[lang].weigh : item.label}</span></button>
            {item.id === medTask.id && <details className="pt-task-medicines"><summary>{copy.review} <span className="pt-med-taken-count">{periodMeds(medTask.period).filter((m) => done[doseKey(medTask.period, m.name)]).length}/{periodMeds(medTask.period).length}</span></summary><ul className="pt-individual-doses">{periodMeds(medTask.period).map((m) => {
              const key = doseKey(medTask.period, m.name);
              return <li key={m.name}><label className={clsx("pt-dose-checkbox", done[key] && "pt-dose-checkbox--taken")}><input type="checkbox" checked={!!done[key]} onChange={(event) => { const checked = event.target.checked; setDone((prev) => ({ ...prev, [key]: checked })); }} /><span><bdi dir="ltr">{m.name} <b>{m.tabletCount ? pillCountLabel(m.tabletCount, lang) : m.dose}</b></bdi></span></label></li>;
            })}</ul></details>}
          </div>)}
        </section>;
      })}
    </div>
    <section className="pt-daily-plan pt-daily-reminders"><div className="pt-plan-heading"><h2>{copy.reminders}</h2></div><ul>{content.todos.filter((item) => ["salt", "fluids"].includes(item.id)).map((item) => <li key={item.id}><span className={clsx("pt-reminder-icon", `pt-reminder-icon--${item.id}`)}>{item.id === "salt" ? <Utensils size={26} aria-hidden="true" /> : <GlassWater size={26} aria-hidden="true" />}</span><span>{item.label}</span></li>)}</ul><button className="pt-btn pt-btn--ghost" type="button" onClick={onCheckin}>{content.todos.find((item) => item.id === "checkin")?.label || UI[lang].checkin}<ChevronRight size={20} aria-hidden="true" /></button></section>
  </>;
}

const PROFILE_COPY = {
  en: { title: "Profile", info: "Your information", age: "Age", years: "years", condition: "Heart failure", language: "Language", full: "Your full discharge plan", intro: "Your care instructions in simple words.", daily: "Each day", visits: "Your follow-up", urgent: "Get urgent help · Call 911 for an emergency", team: "Call your heart care team", avoid: "Do not take ibuprofen or other NSAIDs unless your treating clinician approves them.", weigh: "Weigh yourself", hold: "Ask your care team before restarting a medicine on hold.", support: "Add Member to my Support Plan", name: "Name", phone: "Phone number", enroll: "Enroll", enrolled: "Enrolled", remove: "Remove" },
  es: { title: "Perfil", info: "Su información", age: "Edad", years: "años", condition: "Insuficiencia cardíaca", language: "Idioma", full: "Su plan completo de alta", intro: "Sus instrucciones en palabras sencillas.", daily: "Cada día", visits: "Su seguimiento", urgent: "Busque ayuda urgente · Llame al 911 en una emergencia", team: "Llame a su equipo de atención cardíaca", avoid: "No tome ibuprofeno ni otros AINE sin la aprobación de su médico tratante.", weigh: "Pésese", hold: "Consulte a su equipo antes de volver a tomar un medicamento suspendido.", support: "Agregar un miembro a mi plan de apoyo", name: "Nombre", phone: "Número de teléfono", enroll: "Inscribir", enrolled: "Inscrito", remove: "Quitar" },
  zh: { title: "个人资料", info: "您的信息", age: "年龄", years: "岁", condition: "心力衰竭", language: "语言", full: "完整出院计划", intro: "用简单语言解释的护理指导。", daily: "每天", visits: "复诊", urgent: "寻求紧急帮助——紧急情况下拨打911", team: "联系心脏护理团队", avoid: "未经主治医生批准，请勿服用布洛芬或其他非甾体抗炎药。", weigh: "称体重", hold: "恢复服用暂停的药物前，请咨询护理团队。", support: "添加支持计划成员", name: "姓名", phone: "电话号码", enroll: "登记", enrolled: "已登记", remove: "移除" },
  ar: { title: "الملف", info: "معلوماتك", age: "العمر", years: "سنة", condition: "قصور القلب", language: "اللغة", full: "خطة الخروج الكاملة", intro: "تعليمات الرعاية بكلمات بسيطة.", daily: "كل يوم", visits: "المتابعة", urgent: "اطلب مساعدة عاجلة — اتصل بـ 911 في الطوارئ", team: "اتصل بفريق رعاية القلب", avoid: "لا تتناول إيبوبروفين أو مضادات الالتهاب غير الستيرويدية الأخرى إلا بموافقة الطبيب المعالج.", weigh: "زن نفسك", hold: "اسأل فريق الرعاية قبل استئناف دواء تم إيقافه مؤقتاً.", support: "إضافة عضو إلى خطة الدعم الخاصة بي", name: "الاسم", phone: "رقم الهاتف", enroll: "تسجيل", enrolled: "مسجَّل", remove: "إزالة" },
};

type SupportMember = { name: string; phone: string };

const HOSPITAL = "Robert Wood Johnson University Hospital - New Brunswick";
// The PDF uses Western European fonts, so the report is in Spanish or English.
const REPORT_COPY = {
  en: { button: "Download Discharge Progress", heading: "Progress report", title: "Discharge Progress", patient: "Patient", hospital: "Hospital", generated: "Report date", accessUntil: "Plan available until", progress: "Today's progress", done: "done", appointments: "Appointments", scheduled: "Scheduled", morning: "Morning medicines (8 AM)", night: "Night medicines (8 PM)", taken: "Taken", notYet: "Not yet", history: "Progress since discharge", daysTracked: "Days tracked", tasksCompleted: "Tasks completed", day: "Day", date: "Date", tasks: "Done", progressColumn: "Progress", cumulativeNote: "This report is cumulative: each day you use ClearPath adds a new row, for up to 30 days after discharge. Earlier days stay in the report." },
  es: { button: "Descargar progreso del alta", heading: "Informe de progreso", title: "Progreso del alta", patient: "Paciente", hospital: "Hospital", generated: "Fecha del informe", accessUntil: "Plan disponible hasta", progress: "Progreso de hoy", done: "completadas", appointments: "Citas", scheduled: "Programada", morning: "Medicinas de la mañana (8 AM)", night: "Medicinas de la noche (8 PM)", taken: "Tomadas", notYet: "Pendientes", history: "Progreso desde el alta", daysTracked: "Días registrados", tasksCompleted: "Tareas completadas", day: "Día", date: "Fecha", tasks: "Hechas", progressColumn: "Progreso", cumulativeNote: "Este informe es acumulativo: cada día que use ClearPath se agrega una fila nueva, hasta 30 días después del alta. Los días anteriores se conservan en el informe." },
};
const REPORT_BUTTON = { zh: { button: "下载出院进度", heading: "进度报告" }, ar: { button: "تنزيل تقدم الخروج", heading: "تقرير التقدم" } };

/** Today's checklist as shown in the To-do tab: tasks, then morning and night medicines. */
function todayProgress(content: PlanContent, lang: "en" | "es", done: Record<string, boolean>) {
  const copy = REPORT_COPY[lang];
  const activeMeds = [...content.medications.new, ...content.medications.keep];
  const tasks = content.todos.filter((item) => !["salt", "fluids", "meds", "checkin"].includes(item.id)).map((item) => ({ label: item.id === "weigh" ? PROFILE_COPY[lang].weigh : item.label, done: !!done[item.id] }));
  const medicines = (["morning", "night"] as const).flatMap((period) => {
    const list = activeMeds.filter((m) => medPeriods(m).includes(period));
    if (!list.length) return [];
    const taken = list.filter((m) => done[`dose:${period}:${m.name}`]).map((m) => m.name), notYet = list.filter((m) => !taken.includes(m.name)).map((m) => m.name);
    const detail = [taken.length ? `${copy.taken}: ${taken.join(", ")}` : "", notYet.length ? `${copy.notYet}: ${notYet.join(", ")}` : ""].filter(Boolean).join(" · ");
    return [{ label: copy[period], done: notYet.length === 0, detail }];
  });
  const items = [...tasks, ...medicines];
  return { completed: items.filter((item) => item.done).length, total: items.length, items };
}

function ProfileScreen({ lang, changeLang, members, setMembers, done }: { lang: Language; changeLang: (lang: Language) => void; members: SupportMember[]; setMembers: React.Dispatch<React.SetStateAction<SupportMember[]>>; done: Record<string, boolean> }) {
  const copy = PROFILE_COPY[lang];
  const content = usePlanContent(lang);
  const data = usePatientData();
  const t = UI[lang];
  const [name, setName] = useState(""), [phone, setPhone] = useState("");
  const [downloading, setDownloading] = useState(false);
  const buttonCopy = lang === "en" || lang === "es" ? REPORT_COPY[lang] : REPORT_BUTTON[lang];
  async function downloadReport() {
    const reportLang = lang === "es" ? "es" : "en", copy = REPORT_COPY[reportLang], ui = UI[reportLang], profile = PROFILE_COPY[reportLang];
    const plan = data.content[reportLang] ?? data.content.en ?? content;
    const progress = todayProgress(plan, reportLang, done);
    const now = new Date(), dateLong = (d: Date) => d.toLocaleDateString(ui.localeDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const report: ProgressReport = {
      fileName: `ClearPath-Discharge-Progress-${(data.firstName || "patient").replace(/[^A-Za-z0-9-]/g, "")}-${now.toISOString().slice(0, 10)}.pdf`,
      labels: { title: copy.title, patient: copy.patient, hospital: copy.hospital, generated: copy.generated, accessUntil: copy.accessUntil, progress: copy.progress, done: copy.done, stopped: MED_TIMELINE_COPY[reportLang].stop, appointments: copy.appointments, scheduled: copy.scheduled, history: copy.history, daysTracked: copy.daysTracked, tasksCompleted: copy.tasksCompleted, day: copy.day, date: copy.date, tasks: copy.tasks, progressColumn: copy.progressColumn, cumulativeNote: copy.cumulativeNote },
      patient: data.name, hospital: HOSPITAL, generated: dateLong(now), accessUntil: dateLong(new Date(data.expiresAt)),
      progress,
      // Progress is kept for today only, so the cumulative table has one row; each further day of use adds a row.
      history: [{ day: `${copy.day} 1`, date: now.toLocaleDateString(ui.localeDate, { weekday: "short", month: "long", day: "numeric" }), completed: progress.completed, total: progress.total }],
      whyTitle: plan.whyTitle, why: plan.why,
      medicineGroups: (["new", "keep"] as const).map((group) => ({
        title: group === "new" ? ui.groupNew : ui.groupKeep,
        rows: plan.medications[group].map((m) => ({ name: m.name, dose: [m.dose, m.tabletCount ? pillCountLabel(m.tabletCount, reportLang) : ""].filter(Boolean).join(" · "), schedule: [labelCase(medicationSchedule(m), reportLang), labelCase(m.route, reportLang)].filter(Boolean).join(" · ") })),
      })),
      stopped: plan.medications.stop.map((m) => ({ name: m.name, note: m.note })),
      appointments: plan.appointments.map((a) => ({ title: a.type, when: a.when, clinic: a.clinic, location: a.location, phone: a.phone })),
      warnings: plan.warnings.map((zone) => ({ title: zone.severity === "red" ? profile.urgent : profile.team, urgent: zone.severity === "red", items: zone.items })),
    };
    setDownloading(true);
    try { await downloadProgressPdf(report); } finally { setDownloading(false); }
  }
  const digits = phone.replace(/\D/g, "");
  const memberOk = name.trim().length > 0 && /^\+?[\d\s().-]+$/.test(phone.trim()) && digits.length >= 7 && digits.length <= 15 && !members.some((m) => m.phone.replace(/\D/g, "") === digits);
  function enroll(event: React.FormEvent) {
    event.preventDefault();
    if (!memberOk) return;
    setMembers((list) => [...list, { name: name.trim(), phone: phone.trim() }]);
    setName(""); setPhone("");
  }
  return <section className="pt-profile" aria-labelledby="profile-title">
    <h1 id="profile-title">{copy.title}</h1>
    <section className="pt-card pt-profile-info"><UserRound size={28} aria-hidden="true" /><div><h2>{data.name}</h2>{data.age != null && <p>{copy.age}: {data.age} {copy.years}</p>}<p>{data.demo ? copy.condition : data.diagnosis}</p></div></section>
    <div className="pt-profile-split">
      <section className="pt-card"><h2>{copy.language}</h2><label className="pt-language-setting"><span className="sr-only">{copy.language}</span><select value={lang} onChange={(event) => changeLang(event.target.value as Language)} aria-label={copy.language}>{(Object.keys(LANGUAGE_LABELS) as Language[]).filter((key) => data.content[key]).map((key) => <option key={key} value={key} lang={key}>{LANGUAGE_LABELS[key]}</option>)}</select></label></section>
      <section className="pt-card pt-progress-card"><h2>{buttonCopy.heading}</h2><button type="button" className="pt-btn pt-btn--sm" onClick={downloadReport} disabled={downloading}><Download size={20} aria-hidden="true" />{buttonCopy.button}</button></section>
    </div>
    <section className="pt-card" aria-labelledby="support-title">
      <h2 id="support-title">{copy.support}</h2>
      <form className="pt-support-form" onSubmit={enroll}>
        <label className="sr-only" htmlFor="support-name">{copy.name}</label>
        <input id="support-name" type="text" autoComplete="name" placeholder={copy.name} value={name} onChange={(event) => setName(event.target.value)} maxLength={60} />
        <label className="sr-only" htmlFor="support-phone">{copy.phone}</label>
        <input id="support-phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder={copy.phone} value={phone} onChange={(event) => setPhone(event.target.value)} />
        <button type="submit" className="pt-btn pt-btn--sm" disabled={!memberOk}>{copy.enroll}</button>
      </form>
      {members.length > 0 && <ul className="pt-support-list">{members.map((member) => <li key={member.phone}>
        <span className="pt-support-member"><b>{member.name}</b><bdi dir="ltr">{member.phone}</bdi></span>
        <span className="pt-support-enrolled"><Check size={18} aria-hidden="true" />{copy.enrolled}</span>
        <button type="button" className="pt-btn pt-btn--sm pt-btn--ghost" onClick={() => setMembers((list) => list.filter((m) => m !== member))} aria-label={`${copy.remove} ${member.name}`}>{copy.remove}</button>
      </li>)}</ul>}
    </section>
    <details className="pt-profile-discharge" open>
      <summary>{copy.full}</summary><p className="muted">{copy.intro}</p>
      <section><h2>{content.whyTitle}</h2><p>{content.why}</p></section>
      {(["new", "keep", "stop"] as const).map((group) => <section key={group}><h2>{group === "new" ? t.groupNew : group === "keep" ? t.groupKeep : t.groupStop}</h2>{content.medications[group].map((m) => <article className="pt-profile-med" key={m.name}><h3><bdi dir="ltr">{m.name}{m.tabletCount && ` — ${pillCountLabel(m.tabletCount, lang)}`}</bdi></h3>{medicationSchedule(m) && <p>{labelCase(medicationSchedule(m), lang)}{m.route && ` · ${labelCase(m.route, lang)}`}</p>}{m.purpose && <p>{m.purpose}</p>}{m.note && <p>{m.note}</p>}{m.warning && m.warning !== m.note && <p className="pt-profile-warning">{m.warning}</p>}</article>)}{group === "stop" && <><p>{copy.hold}</p>{data.demo && <p>{copy.avoid}</p>}</>}</section>)}
      <section><h2>{copy.daily}</h2><ul>{content.todos.map((item) => <li key={item.id}>{item.label}</li>)}</ul></section>
      <section><h2>{copy.visits}</h2><ul>{content.appointments.map((visit) => <li key={visit.type}><b>{visit.type}</b>{visit.when && <><br />{visit.when}</>}</li>)}</ul></section>
      {content.warnings.map((zone) => <section key={zone.severity} className={zone.severity === "red" ? "pt-profile-urgent" : ""}><h2>{zone.severity === "red" ? copy.urgent : copy.team}</h2><ul>{zone.items.map((item) => <li key={item}>{item}</li>)}</ul></section>)}
    </details>
  </section>;
}

/* ---------- To-do + appointments ---------- */
function TodoScreen({ lang, go, call, done, setDone }: { go: (screen: Screen) => void; lang: Language; call: (who: string) => void; done: Record<string, boolean>; setDone: React.Dispatch<React.SetStateAction<Record<string, boolean>>> }) {
  const content = usePlanContent(lang);
  const data = usePatientData();
  return (
    <section aria-labelledby="h-todo">
      <h1 id="h-todo">{CHECKLIST_COPY[lang].title}</h1>
      <p className="lead">Tap each one when it is done.</p>
      <DailyChecklist lang={lang} done={done} setDone={setDone} onCheckin={() => go("checkin")} />

      <h2 style={{ marginTop: 28 }}>Your appointments</h2>
      {(data.demo ? content.appointments.slice(0, 2) : content.appointments).map((a) => (
        <div className="pt-card" key={a.type}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Calendar size={30} aria-hidden="true" />
            <div style={{ minWidth: 0 }}>
              <h3>{a.type}</h3>
              <p className="lead" style={{ margin: 0 }}>
                {a.when}
              </p>
              <p style={{ margin: "10px 0 0" }}><span className="cp-chip cp-chip--sage"><Check size={18} aria-hidden="true" />{{ en: "Scheduled", es: "Programada", zh: "已预约", ar: "تم تحديد الموعد" }[lang]}</span></p>
              <div className="pt-appointment-contact">
                {a.clinic && <p className="pt-appointment-clinic">{a.clinic}</p>}
                {a.location && (a.mapsUrl
                  ? <a href={a.mapsUrl} target="_blank" rel="noopener noreferrer"><MapPin size={22} aria-hidden="true" /><span>{a.location}</span></a>
                  : <p><MapPin size={22} aria-hidden="true" /><span>{a.location}</span></p>)}
                {a.phone && <button className="pt-appointment-phone" type="button" onClick={() => call(a.phone!)}><Phone size={22} aria-hidden="true" /><span>{a.phone}</span></button>}
                {a.website && <a href={a.website} target="_blank" rel="noopener noreferrer">{{ en: "View clinic information", es: "Ver información de la clínica", zh: "查看诊所信息", ar: "عرض معلومات العيادة" }[lang]}<ExternalLink size={20} aria-hidden="true" /></a>}
              </div>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

/* ---------- Help ---------- */
const CALL_HELP_COPY = {
  en: { title: "Need help?", team: "Call your care team", emergency: "Emergency · Call 911" },
  es: { title: "¿Necesita ayuda?", team: "Llame a su equipo de atención", emergency: "Emergencia · Llame al 911" },
  zh: { title: "需要帮助？", team: "联系护理团队", emergency: "紧急情况——拨打911" },
  ar: { title: "تحتاج مساعدة؟", team: "اتصل بفريق الرعاية", emergency: "طوارئ — اتصل بـ 911" },
};
function HelpScreen({ call, lang }: { call: (who: string) => void; lang: Language }) {
  const copy = CALL_HELP_COPY[lang];
  return <section className="pt-call-shortcuts" aria-labelledby="h-help">
    <h2 id="h-help">{copy.title}</h2>
    <div className="pt-call-actions">
      <button type="button" className="pt-call-action pt-call-action--team" onClick={() => call("Care team")}><Phone size={26} aria-hidden="true" /><span><b>{copy.team}</b><small dir="ltr">{PHONE}</small></span><ChevronRight size={22} aria-hidden="true" /></button>
      <button type="button" className="pt-call-action pt-call-action--emergency" onClick={() => call("911")}><Phone size={26} aria-hidden="true" /><span><b>{copy.emergency}</b></span><ChevronRight size={22} aria-hidden="true" /></button>
    </div>
  </section>;
}

/* ---------- Chat (plan-grounded + triage) ---------- */
const CHAT_HELP_LABEL = { en: "Chat & Help", es: "Chat y ayuda", zh: "聊天与帮助", ar: "الدردشة والمساعدة" };

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
  lang,
  setSos,
  call,
}: {
  lang: Language;
  setSos: (b: boolean) => void;
  call: (who: string) => void;
}) {
  const { firstName } = usePatientData();
  const [msgs, setMsgs] = useState<Bubble[]>([
    {
      who: "bot",
      html: `Hi ${firstName}. I can answer questions about your plan. I don't give new medical advice.`,
    },
  ]);
  const [input, setInput] = useState("");
  const chatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (msgs.length > 1 && chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
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
          html: "<b>This can be an emergency. Call 911 now.</b> This chat does not notify your care team.",
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
      <h1 id="h-chat">{CHAT_HELP_LABEL[lang]}</h1>
      <HelpScreen lang={lang} call={call} />
      <p className="fine">Answers are based on your approved discharge plan.</p>
      <div className="pt-chat" ref={chatRef} aria-live="polite">
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
const CHECKIN_SYMPTOMS = [
  "Pain or discomfort",
  "Breathing problems",
  "Feeling dizzy or weak",
  "Swelling",
  "Weight changes",
  "Heart or heartbeat problems",
  "Stomach or bathroom problems",
  "Feeling tired or unwell",
  "Anxiety, stress, or mood changes",
  "Other symptoms",
];

type SymptomAdvice = { now: string; doctor?: string; urgent?: string; emergency: string };
const SYMPTOM_ADVICE: Record<string, SymptomAdvice> = {
  "Pain or discomfort": { now: "Take pain medicine only if prescribed in your discharge plan. Take it exactly as directed and rest the area.", doctor: "If pain is not controlled or keeps getting worse.", emergency: "For chest pain, sudden severe pain, or pain with fainting or trouble breathing." },
  "Breathing problems": { now: "If you are having trouble breathing now, get medical attention right away. Call 911.", emergency: "For trouble breathing now. Do not wait to finish this check-in." },
  "Feeling dizzy or weak": { now: "Sit or lie down right away. Stand up slowly.", doctor: "If it keeps happening.", emergency: "If you faint or have chest pain, confusion, trouble speaking, or weakness on one side." },
  "Swelling": { now: "For swelling in an arm or leg, raise it above heart level while resting, if comfortable.", doctor: "If swelling increases or the area is red, warm, or painful.", emergency: "For swelling with trouble breathing, or swelling of the face, lips, or throat." },
  "Weight changes": { now: "Record your weight and follow the weight instructions in your discharge plan.", doctor: "For a sudden change, or a change beyond the limit your care team gave you.", emergency: "If you also have chest pain, fainting, or trouble breathing." },
  "Heart or heartbeat problems": { now: "If your heart is racing, sit down, rest, and take slow breaths.", doctor: "If it keeps happening.", emergency: "If a racing heart comes with chest pain, trouble breathing, or fainting, or does not settle in a few minutes." },
  "Stomach or bathroom problems": { now: "Eat bland foods if you can. If sipping fluids, stay within your care team’s daily fluid limit.", doctor: "If it lasts more than 24–48 hours or you cannot keep fluids down.", urgent: "For dark urine, dizziness, dry mouth, or worsening fluid loss.", emergency: "For severe belly pain, blood in vomit or stool, fainting, or confusion." },
  "Feeling tired or unwell": { now: "Rest and check your temperature. Follow your prescribed fluid limit.", doctor: "If you have a fever or feel worse after a few days.", urgent: "For fever with chills, or redness or drainage at a wound.", emergency: "For confusion, trouble breathing, or if you cannot stay awake." },
  "Anxiety, stress, or mood changes": { now: "Talk to someone you trust today.", doctor: "If these feelings last more than a couple of weeks or get in the way of daily life.", emergency: "If you are in immediate danger. If you feel unsafe or think about hurting yourself, call or text 988." },
  "Other symptoms": { now: "Check your discharge instructions or contact your care team.", doctor: "If the symptom persists or gets worse.", urgent: "If you cannot reach your doctor and need prompt help.", emergency: "For sudden or severe symptoms." },
};

function CheckinActionSummary({ symptoms, chestPain }: { symptoms: string[]; chestPain: boolean }) {
  const hasChestPain = symptoms.includes("Pain or discomfort") && chestPain;
  const titles: Record<string, string> = { "Pain or discomfort": "Pain", "Breathing problems": "Breathing", "Feeling dizzy or weak": "Dizziness", "Swelling": "Swelling", "Weight changes": "Weight", "Heart or heartbeat problems": "Heartbeat", "Stomach or bathroom problems": "Stomach / bathroom", "Feeling tired or unwell": "Feeling tired", "Anxiety, stress, or mood changes": "Mood", "Other symptoms": "Other symptoms" };
  return <div className="pt-checkin-summary">
    {hasChestPain && <section className="pt-symptom-guidance pt-symptom-guidance--emergency"><h2>Chest pain: Call 911 now</h2><p>Do not drive yourself.</p></section>}
    <section className="pt-summary-actions"><h2>What to do now</h2><ul>{symptoms.filter((symptom) => !(hasChestPain && symptom === "Pain or discomfort")).map((symptom) => <li key={symptom}><strong>{titles[symptom]}</strong><p>{SYMPTOM_ADVICE[symptom].now}</p></li>)}</ul></section>
    <section className="pt-summary-call"><h2>Call your care team</h2><p>If symptoms are new, keep happening, or get worse.</p><p className="pt-summary-number"><Phone size={24} aria-hidden="true" />{PHONE}</p>
      <details><summary>When else to call or get urgent care</summary><ul>{symptoms.map((symptom) => { const advice = SYMPTOM_ADVICE[symptom]; return (advice.doctor || advice.urgent) && <li key={symptom}><strong>{titles[symptom]}</strong>{advice.doctor && <p>Call your doctor: {advice.doctor}</p>}{advice.urgent && <p>Get urgent care: {advice.urgent}</p>}</li>; })}</ul></details>
    </section>
    <section className="pt-summary-emergency"><h2>Call 911 for an emergency</h2><p>Chest pain, trouble breathing, fainting, confusion, or sudden severe symptoms.</p>
      <details><summary>More emergency signs</summary><ul>{symptoms.map((symptom) => <li key={symptom}><strong>{titles[symptom]}</strong><p>{SYMPTOM_ADVICE[symptom].emergency}</p></li>)}</ul></details>
    </section>
    {symptoms.includes("Anxiety, stress, or mood changes") && <section className="pt-summary-call"><h2>Feeling unsafe?</h2><p>If you think about hurting yourself, call or text 988. Call 911 for immediate danger.</p><p className="pt-crisis-links"><a href="tel:988?oai_link_source=model_response_hotline">Call 988</a><a href="sms:988?oai_link_source=model_response_hotline">Text 988</a></p></section>}
  </div>;
}

const BODY_REGIONS = [
  { id: "head", label: "Head", path: "M120 12 C88 12 88 76 120 76 C152 76 152 12 120 12Z" },
  { id: "neck", label: "Neck", path: "M108 80 L132 80 L138 103 L102 103Z" },
  { id: "upper", label: "Chest", backLabel: "Upper back", path: "M102 103 Q120 112 138 103 L157 116 Q151 149 146 177 L94 177 Q89 149 83 116Z" },
  { id: "middle", label: "Belly", backLabel: "Lower back", path: "M94 177 L146 177 Q141 205 149 234 L91 234 Q99 205 94 177Z" },
  { id: "pelvis", label: "Hips / groin", backLabel: "Hips / buttocks", path: "M91 234 L149 234 Q157 253 153 275 L122 284 L118 284 L87 275 Q83 253 91 234Z" },
  { id: "screen-left-arm", label: "arm", side: "left", path: "M77 120 L87 144 L76 203 L62 244 L39 235 L53 190 L60 134Z" },
  { id: "screen-right-arm", label: "arm", side: "right", path: "M163 120 L153 144 L164 203 L178 244 L201 235 L187 190 L180 134Z" },
  { id: "screen-left-hand", label: "hand", side: "left", path: "M38 240 L60 250 L52 278 Q37 290 27 275Z" },
  { id: "screen-right-hand", label: "hand", side: "right", path: "M202 240 L180 250 L188 278 Q203 290 213 275Z" },
  { id: "screen-left-leg", label: "leg", side: "left", path: "M87 278 L116 290 L112 358 L106 420 L81 420 L78 352Z" },
  { id: "screen-right-leg", label: "leg", side: "right", path: "M153 278 L124 290 L128 358 L134 420 L159 420 L162 352Z" },
  { id: "screen-left-foot", label: "foot", side: "left", path: "M81 424 L106 424 L105 449 L67 449 Q65 435 81 424Z" },
  { id: "screen-right-foot", label: "foot", side: "right", path: "M134 424 L159 424 Q175 435 173 449 L135 449Z" },
];

function SymptomBodyMap({ symptom, selected, onChange }: { symptom: "pain" | "swelling"; selected: string[]; onChange: (areas: string[]) => void }) {
  const toggle = (key: string) => onChange(selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key]);
  const views = (["front", "back"] as const).map((view) => ({ view, regions: BODY_REGIONS.map((region) => {
    const side = region.side ? (view === "back" ? region.side : region.side === "left" ? "right" : "left") : null;
    return { ...region, key: `${view}:${side ? `${side}-${region.label}` : region.id}`, name: side ? `${side === "left" ? "Left" : "Right"} ${region.label}` : view === "back" ? region.backLabel || region.label : region.label };
  }) }));
  const selectedNames = views.flatMap(({ view, regions }) => regions.filter((region) => selected.includes(region.key)).map((region) => `${view === "front" ? "Front" : "Back"}: ${region.name}`));
  return <section className="pt-body-map" aria-labelledby={`${symptom}-location-title`}>
    <h2 id={`${symptom}-location-title`}>{symptom === "pain" ? "Where does it hurt?" : "Where is the swelling?"}</h2>
    <p>{symptom === "pain" ? "Tap any area that hurts." : "Tap any swollen area."} Tap again to clear it.</p>
    <div className="pt-static-body-views">
      {views.map(({ view, regions }) => <div className="pt-static-body-view" key={view}>
        <h3>{view === "front" ? "Front" : "Back"}</h3>
        <div className="pt-static-side-labels"><span>{view === "front" ? "Right" : "Left"}</span><span>{view === "front" ? "Left" : "Right"}</span></div>
        <svg viewBox="0 0 240 462" className="pt-static-body-image" role="group" aria-label={`${view} body areas. Left and right refer to your body.`}>
          {regions.map((region) => <path key={region.key} d={region.path} role="button" tabIndex={0} aria-label={`${view}: ${region.name}`} aria-pressed={selected.includes(region.key)} className={clsx("pt-body-region", selected.includes(region.key) && "is-selected")} onClick={() => toggle(region.key)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(region.key); } }}><title>{region.name}</title></path>)}
          {view === "front" ? <g fill="none" stroke="#34516a" strokeWidth="2.5" strokeLinecap="round" pointerEvents="none" aria-hidden="true"><circle cx="110" cy="38" r="2" fill="#34516a" /><circle cx="130" cy="38" r="2" fill="#34516a" /><path d="M109 52 Q120 62 131 52" /></g> : <path d="M120 117 L120 225 M103 132 Q110 144 115 144 M137 132 Q130 144 125 144" stroke="#93a8ba" strokeWidth="2" fill="none" pointerEvents="none" aria-hidden="true" />}
        </svg>
      </div>)}
    </div>
    <details className="pt-body-text-options"><summary>Choose an area by name</summary>
      {views.map(({ view, regions }) => <div key={view}><h3>{view === "front" ? "Front" : "Back"}</h3><div className="pt-body-area-buttons">{regions.map((region) => <button type="button" key={region.key} aria-pressed={selected.includes(region.key)} onClick={() => toggle(region.key)}>{selected.includes(region.key) && <Check size={20} aria-hidden="true" />}{region.name}</button>)}</div></div>)}
    </details>
    <div className="pt-body-map-selection" role="status"><b>Selected areas</b><p>{selectedNames.length ? selectedNames.join("; ") : "No areas selected yet."}</p></div>
  </section>;
}

function CheckinScreen({ onClose, onExit }: { onClose: () => void; onExit: () => void }) {
  const [step, setStep] = useState<"mood" | "symptoms" | "categories" | "complete">("mood");
  const [mood, setMood] = useState<number | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [painAreas, setPainAreas] = useState<string[]>([]);
  const [swellingAreas, setSwellingAreas] = useState<string[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.closest("main")?.scrollTo({ top: 0, behavior: "instant" }); headingRef.current?.focus({ preventScroll: true }); }, [step]);
  const moods = ["Very sad", "Sad", "Okay", "Happy", "Very happy"];

  return (
    <section className="pt-questionnaire" aria-labelledby="h-ci">
      <button className="pt-questionnaire-close" type="button" onClick={onExit} aria-label="Exit questionnaire and go to Home"><X size={28} aria-hidden="true" /></button>
      <p className="pt-questionnaire-kicker">Daily check-in</p>
      <h1 id="h-ci" ref={headingRef} tabIndex={-1}>
        {step === "mood" ? "How are you feeling?" : step === "symptoms" ? "Any symptoms?" : step === "categories" ? "What symptoms do you have?" : symptoms.length ? "Your next steps" : "Thank you!"}
      </h1>
      {step === "mood" && <>
        <p className="lead">Choose the face that matches how you feel.</p>
        <fieldset className="pt-mood-options">
          <legend className="sr-only">How are you feeling?</legend>
          {moods.map((label, index) => <label key={label} className={clsx("pt-mood-option", mood === index && "is-selected")}>
            <input type="radio" name="checkin-mood" value={index} checked={mood === index} onChange={() => setMood(index)} />
            <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
              <circle cx="32" cy="32" r="27" /><circle cx="23" cy="25" r="1.5" fill="currentColor" /><circle cx="41" cy="25" r="1.5" fill="currentColor" />
              <path d={["M19 45 Q32 29 45 45", "M21 43 Q32 33 43 43", "M21 40 L43 40", "M21 37 Q32 48 43 37", "M19 35 Q32 55 45 35"][index]} strokeLinecap="round" />
            </svg>
            <span>{label}</span>
          </label>)}
        </fieldset>
        <button className="pt-btn" type="button" disabled={mood === null} onClick={() => setStep("symptoms")}>Next<ChevronRight size={22} aria-hidden="true" /></button>
      </>}
      {step === "symptoms" && <div className="pt-questionnaire-actions">
        <button className="pt-btn" type="button" onClick={() => { setSymptoms([]); setPainAreas([]); setSwellingAreas([]); setStep("complete"); }}>No</button>
        <button className="pt-btn pt-btn--ghost" type="button" onClick={() => setStep("categories")}>Yes</button>
        <button className="pt-btn pt-btn--ghost" type="button" onClick={() => setStep("mood")}>Back</button>
      </div>}
      {step === "categories" && <>
        <p className="lead">Check all that apply.</p>
        <fieldset className="pt-symptom-options">
          <legend className="sr-only">Your symptoms</legend>
          {CHECKIN_SYMPTOMS.map((label) => <div key={label}>
            <label className="pt-symptom-option">
              <input type="checkbox" checked={symptoms.includes(label)} onChange={(event) => { const checked = event.target.checked; setSymptoms((current) => checked ? [...current, label] : current.filter((item) => item !== label)); if (!checked && label === "Pain or discomfort") setPainAreas([]); if (!checked && label === "Swelling") setSwellingAreas([]); }} />
              <span>{label}</span>
            </label>
            {label === "Pain or discomfort" && symptoms.includes(label) && <SymptomBodyMap symptom="pain" selected={painAreas} onChange={setPainAreas} />}
            {label === "Swelling" && symptoms.includes(label) && <SymptomBodyMap symptom="swelling" selected={swellingAreas} onChange={setSwellingAreas} />}
          </div>)}
        </fieldset>
        <div className="pt-questionnaire-actions">
          <button className="pt-btn" type="button" disabled={symptoms.length === 0} onClick={() => setStep("complete")}>Done</button>
          <button className="pt-btn pt-btn--ghost" type="button" onClick={() => setStep("symptoms")}>Back</button>
        </div>
      </>}
      {step === "complete" && <>
        {symptoms.length ? <CheckinActionSummary symptoms={symptoms} chestPain={painAreas.includes("front:upper")} /> : <div className="pt-card" role="status"><Check size={36} aria-hidden="true" /><p className="lead">Your check-in is complete.</p></div>}
        <button className="pt-btn" type="button" onClick={onClose}>Close</button>
      </>}
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
          Back to sign in
        </button>
      </p>
    </section>
  );
}

// Expired state is reached from the DEMO expire button or the /p/[token]?expired path.
