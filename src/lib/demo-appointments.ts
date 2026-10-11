import type { PlanContent } from "@/types/plan";
import type { PlanLanguage } from "@/lib/plan-adapter";

/**
 * Demo scheduling for the patient app: follow-up visits and blood work are shown as already booked at
 * real RWJBarnabas Health locations (addresses and phone numbers from rwjbh.org). The appointment
 * times are examples, set relative to the discharge date.
 */
const maps = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
const CLINICS = {
  labs: {
    pattern: /blood (test|work)|\blabs?\b|metabolic panel/i,
    title: { en: "Blood test appointment", es: "Cita para análisis de sangre", zh: "验血预约", ar: "موعد فحص الدم" },
    clinic: "Labcorp at RWJBarnabas Health at George Street",
    location: "317 George Street, Suite 101, New Brunswick, NJ 08901",
    phone: "(866) 476-2522",
    website: "https://www.rwjbh.org/our-locations/laboratory-services/labcorp-at-rwjbarnabas-health-at-george-street/",
    daysAfterDischarge: 5, hour: 9, minute: 0,
  },
  primary: {
    pattern: /primary care|family (doctor|medicine)/i,
    title: { en: "Primary care doctor appointment", es: "Cita con su médico de cabecera", zh: "家庭医生预约", ar: "موعد مع طبيب الرعاية الأولية" },
    withHeart: { en: "Primary care doctor and heart doctor appointment", es: "Cita con su médico de cabecera y su cardiólogo", zh: "家庭医生和心脏科医生预约", ar: "موعد مع طبيب الرعاية الأولية وطبيب القلب" },
    clinic: "RWJBarnabas Health Primary & Specialty Care at Old Bridge",
    location: "1980 Route 9, Old Bridge, NJ 08857",
    phone: "(848) 289-4400",
    website: "https://www.rwjbh.org/our-locations/specialty-centers/rwjbarnabas-health-primary-specialty-care-at-old/",
    daysAfterDischarge: 7, hour: 10, minute: 30,
  },
};
const LOCALES: Partial<Record<PlanLanguage, string>> = { en: "en-US", es: "es-US", zh: "zh-CN", ar: "ar-u-nu-latn" };
const DAY_MS = 24 * 60 * 60 * 1000;

function appointmentDate(dischargeAt: Date, days: number, hour: number, minute: number) {
  const date = new Date(dischargeAt.getTime() + days * DAY_MS);
  date.setHours(hour, minute, 0, 0);
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1); // weekdays only
  return date;
}
function appointmentTime(date: Date, lang: PlanLanguage) {
  const locale = LOCALES[lang] ?? "en-US";
  const text = `${date.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" })} · ${date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`;
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1); // "lunes" -> "Lunes"
}

/**
 * Gives the matching appointments of `plan` a short title, clinic, contact details and a booked time. Matching uses the
 * English plan (`english`, same order as `plan`), so it works for translated plans too.
 */
export function withScheduledAppointments(plan: PlanContent, english: PlanContent, expiresAt: string, lang: PlanLanguage): PlanContent {
  const dischargeAt = new Date(new Date(expiresAt).getTime() - 30 * DAY_MS);
  const used = new Set<string>();
  const appointments = plan.appointments.map((appointment, i) => {
    const text = english.appointments[i]?.type ?? "";
    const match = (Object.entries(CLINICS) as [keyof typeof CLINICS, (typeof CLINICS)[keyof typeof CLINICS]][]).find(([key, c]) => !used.has(key) && c.pattern.test(text));
    if (!match) return { ...appointment, scheduleNeeded: false };
    const [key, c] = match;
    used.add(key);
    // A short card title replaces the instruction wording; the booked time already says when.
    const titles = "withHeart" in c && /heart|cardio/i.test(text) ? c.withHeart : c.title;
    const type = (titles as Partial<Record<PlanLanguage, string>>)[lang] ?? titles.en;
    const date = appointmentDate(dischargeAt, c.daysAfterDischarge, c.hour, c.minute);
    return { ...appointment, type, scheduleNeeded: false, clinic: c.clinic, location: c.location, mapsUrl: maps(c.location), phone: c.phone, website: c.website, when: appointmentTime(date, lang), startsAt: date.toISOString() };
  });
  return { ...plan, appointments };
}
