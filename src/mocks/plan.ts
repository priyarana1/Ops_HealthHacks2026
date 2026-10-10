import type { DischargePlan, PlanContent, Language } from "@/types/plan";
import { ELEANOR } from "./patient";

/**
 * SYNTHETIC DEMO DATA. Eleanor Okafor's approved, simplified, multilingual plan.
 *
 * Drug names and numbers are byte-identical across all four languages (a hard rule
 * from docs/ProjectPlan.md). Only the surrounding plain-language text is translated.
 * Content ported from PatientApp.html (English preview + T{} translation tables).
 */

const en: PlanContent = {
  whyTitle: "Why you were in the hospital",
  why: "Your heart was not pumping well. Extra fluid made it hard to breathe. You also had a lung infection. Treatment helped you feel better.",
  medications: {
    new: [
      { name: "Furosemide", purpose: "Removes extra fluid", route: "By mouth", dose: "40 mg", tabletCount: 1, frequency: "Once a day", note: "Effects of medication: Increases urine output to remove extra fluid." },
      { name: "Losartan", purpose: "For your heart and blood pressure", route: "By mouth", dose: "25 mg", tabletCount: 1, frequency: "Once a day", note: "For your heart and blood pressure.", warning: "Do not take both. Losartan replaces lisinopril." },
      { name: "Empagliflozin", purpose: "For your heart and blood sugar", route: "By mouth", dose: "10 mg", tabletCount: 1, frequency: "Once a day", note: "For your heart and sugar." },
      { name: "Amoxicillin-clavulanate", purpose: "Treats your lung infection", route: "By mouth", dose: "875/125 mg", tabletCount: 1, frequency: "Twice a day for 3 more days", note: "Finish ALL of it, even if you feel fine." },
    ],
    keep: [
      { name: "Metoprolol succinate", purpose: "For your heart", dose: "50 mg", tabletCount: 1, frequency: "Once a day" },
      { name: "Apixaban", purpose: "Helps prevent blood clots", dose: "5 mg", tabletCount: 1, frequency: "Twice a day", note: "Blood thinner. Watch for bleeding." },
      { name: "Atorvastatin", purpose: "Lowers cholesterol", dose: "40 mg", tabletCount: 1, frequency: "At night" },
      { name: "Metformin", purpose: "For your blood sugar", dose: "500 mg", tabletCount: 1, frequency: "Twice a day", note: "Keep taking it while your kidney tests stay steady." },
    ],
    stop: [
      { name: "Lisinopril", note: "STOP. Losartan takes its place.", warning: "Do not take both. Losartan replaces lisinopril." },
      { name: "Spironolactone", note: "HOLD until your next blood test." },
    ],
  },
  todos: [
    { id: "weigh", label: "Weigh yourself at the same time each morning and write it down" },
    { id: "salt", label: "Eat low salt (about 2 grams of sodium)" },
    { id: "meds", label: "Take all your medicines" },
    { id: "fluids", label: "Follow the fluid instructions from your heart care team" },
    { id: "checkin", label: "Do your daily check-in" },
  ],
  appointments: [
    { type: "Primary care", when: "October 16, 2026 · 10:00 AM", location: "123 Example Avenue, New Brunswick, NJ 08901", phone: "(732) 555-0101", website: "https://www.rwjbh.org/our-locations/med-school-outpatient-centers/rutgers-robert-wood-johnson-medical-group/", scheduleNeeded: false },
    { type: "Cardiology (heart doctor)", when: "October 19, 2026 · 2:00 PM", location: "456 Example Street, New Brunswick, NJ 08901", phone: "(732) 555-0102", website: "https://www.rwjbh.org/rwj-university-hospital-new-brunswick/treatment-care/heart-and-vascular-care/cardiac-services/", scheduleNeeded: false },
    { type: "Blood test (kidney function and potassium)", when: "October 15, 2026 · 9:00 AM", scheduleNeeded: false },
  ],
  warnings: [
    {
      severity: "yellow",
      items: [
        "Fast weight gain, or more swelling in your legs or belly",
        "More shortness of breath (but you can rest)",
      ],
    },
    {
      severity: "red",
      items: [
        "New or worse shortness of breath, especially at rest",
        "Chest pain or pressure",
        "Fainting or severe dizziness",
        "Rapidly worsening swelling",
        "Much less urine",
        "New confusion or severe weakness",
        "Fever or worse cough despite the antibiotic",
      ],
    },
  ],
};

// Translations keep medication name/dose/frequency identical; only notes/why/warnings localize.
const es: PlanContent = {
  whyTitle: "Por qué estuvo en el hospital",
  why: "Su corazón estaba débil y tenía agua de más. También tuvo una infección en el pulmón. Ahora está mejor.",
  medications: {
    new: [
      { name: "Furosemide", purpose: "Elimina el exceso de líquido", route: "Por boca", dose: "40 mg", tabletCount: 1, frequency: "Una vez al día", note: "Efectos del medicamento: Aumenta la orina para eliminar el exceso de líquido." },
      { name: "Losartan", purpose: "Para el corazón y la presión", route: "Por boca", dose: "25 mg", tabletCount: 1, frequency: "Una vez al día", note: "Para el corazón y la presión.", warning: "No tome los dos. Losartan reemplaza a lisinopril." },
      { name: "Empagliflozin", purpose: "Para el corazón y el azúcar en sangre", route: "Por boca", dose: "10 mg", tabletCount: 1, frequency: "Una vez al día", note: "Para el corazón y el azúcar." },
      { name: "Amoxicillin-clavulanate", purpose: "Trata la infección pulmonar", route: "Por boca", dose: "875/125 mg", tabletCount: 1, frequency: "Dos veces al día por 3 días más", note: "Tómelo TODO, aunque se sienta bien." },
    ],
    keep: [
      { name: "Metoprolol succinate", purpose: "Para el corazón", dose: "50 mg", tabletCount: 1, frequency: "Una vez al día" },
      { name: "Apixaban", purpose: "Ayuda a prevenir coágulos", dose: "5 mg", tabletCount: 1, frequency: "Dos veces al día", note: "Anticoagulante. Esté atento a cualquier sangrado." },
      { name: "Atorvastatin", purpose: "Reduce el colesterol", dose: "40 mg", tabletCount: 1, frequency: "Por la noche" },
      { name: "Metformin", purpose: "Para el azúcar en sangre", dose: "500 mg", tabletCount: 1, frequency: "Dos veces al día", note: "Siga tomándolo mientras sus análisis de riñón sigan estables." },
    ],
    stop: [
      { name: "Lisinopril", note: "DEJE de tomarlo. Losartan toma su lugar.", warning: "No tome los dos. Losartan reemplaza a lisinopril." },
      { name: "Spironolactone", note: "ESPERE hasta su próximo análisis de sangre." },
    ],
  },
  todos: [
    { id: "weigh", label: "Pésese esta mañana y anótelo" },
    { id: "salt", label: "Coma bajo en sal (unos 2 gramos de sodio)" },
    { id: "meds", label: "Tome todas sus medicinas" },
    { id: "fluids", label: "Siga las instrucciones sobre líquidos de su equipo de atención cardíaca" },
    { id: "checkin", label: "Haga su chequeo diario" },
  ],
  appointments: [
    { type: "Atención primaria", when: "16 de octubre de 2026 · 10:00 a. m.", location: "123 Example Avenue, New Brunswick, NJ 08901", phone: "(732) 555-0101", website: "https://www.rwjbh.org/our-locations/med-school-outpatient-centers/rutgers-robert-wood-johnson-medical-group/", scheduleNeeded: false },
    { type: "Cardiología (médico del corazón)", when: "19 de octubre de 2026 · 2:00 p. m.", location: "456 Example Street, New Brunswick, NJ 08901", phone: "(732) 555-0102", website: "https://www.rwjbh.org/rwj-university-hospital-new-brunswick/treatment-care/heart-and-vascular-care/cardiac-services/", scheduleNeeded: false },
    { type: "Análisis de sangre (BMP)", when: "15 de octubre de 2026 · 9:00 a. m.", scheduleNeeded: false },
  ],
  warnings: [
    {
      severity: "yellow",
      items: [
        "Aumento rápido de peso, o más hinchazón en las piernas o el abdomen",
        "Más falta de aire (pero puede descansar)",
      ],
    },
    {
      severity: "red",
      items: [
        "Falta de aire nueva o peor, sobre todo en reposo",
        "Dolor o presión en el pecho",
        "Desmayo o mareo fuerte",
        "La hinchazón empeora rápido",
        "Orina mucho menos",
        "Confusión nueva o debilidad fuerte",
        "Fiebre o tos peor a pesar del antibiótico",
      ],
    },
  ],
};

const zh: PlanContent = {
  whyTitle: "您为什么住院",
  why: "您的心脏变弱了，体内有多余的水分。您还有肺部感染。现在您好多了。",
  medications: {
    new: [
      { name: "Furosemide", purpose: "排出多余水分", route: "口服", dose: "40 mg", tabletCount: 1, frequency: "每天一次", note: "药物作用：增加尿量，排出多余水分。" },
      { name: "Losartan", purpose: "用于心脏和血压", route: "口服", dose: "25 mg", tabletCount: 1, frequency: "每天一次", note: "保护心脏、控制血压。", warning: "不要两种都吃。losartan 代替 lisinopril。" },
      { name: "Empagliflozin", purpose: "用于心脏和血糖", route: "口服", dose: "10 mg", tabletCount: 1, frequency: "每天一次", note: "保护心脏、控制血糖。" },
      { name: "Amoxicillin-clavulanate", purpose: "治疗肺部感染", route: "口服", dose: "875/125 mg", tabletCount: 1, frequency: "每天两次，再服 3 天", note: "请全部吃完，即使感觉好了也要吃完。" },
    ],
    keep: [
      { name: "Metoprolol succinate", purpose: "用于心脏", dose: "50 mg", tabletCount: 1, frequency: "每天一次" },
      { name: "Apixaban", purpose: "帮助预防血栓", dose: "5 mg", tabletCount: 1, frequency: "每天两次", note: "抗凝血药（血液稀释剂）。注意是否出血。" },
      { name: "Atorvastatin", purpose: "降低胆固醇", dose: "40 mg", tabletCount: 1, frequency: "晚上服用" },
      { name: "Metformin", purpose: "控制血糖", dose: "500 mg", tabletCount: 1, frequency: "每天两次", note: "肾功能检查保持稳定时，请继续服用。" },
    ],
    stop: [
      { name: "Lisinopril", note: "停药。losartan 代替它。", warning: "不要两种都吃。losartan 代替 lisinopril。" },
      { name: "Spironolactone", note: "暂停，等下次验血后再说。" },
    ],
  },
  todos: [
    { id: "weigh", label: "今天早上称体重并记录下来" },
    { id: "salt", label: "吃低盐饮食（约 2 克钠）" },
    { id: "meds", label: "服用您所有的药物" },
    { id: "fluids", label: "遵循心脏护理团队的饮水指导" },
    { id: "checkin", label: "完成每日检查" },
  ],
  appointments: [
    { type: "初级保健", when: "2026年10月16日 · 上午10:00", location: "123 Example Avenue, New Brunswick, NJ 08901", phone: "(732) 555-0101", website: "https://www.rwjbh.org/our-locations/med-school-outpatient-centers/rutgers-robert-wood-johnson-medical-group/", scheduleNeeded: false },
    { type: "心脏科（心脏医生）", when: "2026年10月19日 · 下午2:00", location: "456 Example Street, New Brunswick, NJ 08901", phone: "(732) 555-0102", website: "https://www.rwjbh.org/rwj-university-hospital-new-brunswick/treatment-care/heart-and-vascular-care/cardiac-services/", scheduleNeeded: false },
    { type: "血液检查 (BMP)", when: "2026年10月15日 · 上午9:00", scheduleNeeded: false },
  ],
  warnings: [
    {
      severity: "yellow",
      items: ["体重快速增加，或腿部或腹部肿胀加重", "更加气短（但休息时可以缓解）"],
    },
    {
      severity: "red",
      items: [
        "新出现或加重的呼吸困难，尤其是在休息时",
        "胸痛或胸闷",
        "昏厥或严重头晕",
        "肿胀迅速加重",
        "尿量明显减少",
        "新出现意识混乱或严重虚弱",
        "吃了抗生素仍发烧或咳嗽加重",
      ],
    },
  ],
};

const ar: PlanContent = {
  whyTitle: "لماذا كنت في المستشفى",
  why: "كان قلبك ضعيفًا وبه ماء زائد. وكانت لديك أيضًا عدوى في الرئة. أنت الآن أفضل.",
  medications: {
    new: [
      { name: "Furosemide", purpose: "يزيل السوائل الزائدة", route: "عن طريق الفم", dose: "40 mg", tabletCount: 1, frequency: "مرة واحدة يوميًا", note: "حبة مدرّة للبول. ستتبوّل أكثر." },
      { name: "Losartan", purpose: "للقلب وضغط الدم", route: "عن طريق الفم", dose: "25 mg", tabletCount: 1, frequency: "مرة واحدة يوميًا", note: "للقلب وضغط الدم.", warning: "لا تتناول الاثنين معًا. يحل Losartan محل lisinopril." },
      { name: "Empagliflozin", purpose: "للقلب وسكر الدم", route: "عن طريق الفم", dose: "10 mg", tabletCount: 1, frequency: "مرة واحدة يوميًا", note: "للقلب والسكر." },
      { name: "Amoxicillin-clavulanate", purpose: "يعالج عدوى الرئة", route: "عن طريق الفم", dose: "875/125 mg", tabletCount: 1, frequency: "مرتان يوميًا لمدة 3 أيام أخرى", note: "أكملها كلها حتى لو شعرت أنك بخير." },
    ],
    keep: [
      { name: "Metoprolol succinate", purpose: "للقلب", dose: "50 mg", tabletCount: 1, frequency: "مرة واحدة يوميًا" },
      { name: "Apixaban", purpose: "يساعد في منع جلطات الدم", dose: "5 mg", tabletCount: 1, frequency: "مرتان يوميًا", note: "مميّع للدم. انتبه لأي نزيف." },
      { name: "Atorvastatin", purpose: "يخفض الكوليسترول", dose: "40 mg", tabletCount: 1, frequency: "في المساء" },
      { name: "Metformin", purpose: "لسكر الدم", dose: "500 mg", tabletCount: 1, frequency: "مرتان يوميًا", note: "استمر في تناوله ما دامت فحوص الكلى مستقرة." },
    ],
    stop: [
      { name: "Lisinopril", note: "أوقفه. يحل losartan محله.", warning: "لا تتناول الاثنين معًا. يحل Losartan محل lisinopril." },
      { name: "Spironolactone", note: "انتظر حتى فحص الدم القادم." },
    ],
  },
  todos: [
    { id: "weigh", label: "زِن نفسك هذا الصباح ودوّن الوزن" },
    { id: "salt", label: "تناول طعامًا قليل الملح (حوالي 2 غرام صوديوم)" },
    { id: "meds", label: "تناول كل أدويتك" },
    { id: "fluids", label: "اتبع تعليمات السوائل من فريق رعاية القلب" },
    { id: "checkin", label: "أكمل الفحص اليومي" },
  ],
  appointments: [
    { type: "الرعاية الأولية", when: "16 أكتوبر 2026 · 10:00 صباحًا", location: "123 Example Avenue, New Brunswick, NJ 08901", phone: "(732) 555-0101", website: "https://www.rwjbh.org/our-locations/med-school-outpatient-centers/rutgers-robert-wood-johnson-medical-group/", scheduleNeeded: false },
    { type: "طب القلب (طبيب القلب)", when: "19 أكتوبر 2026 · 2:00 مساءً", location: "456 Example Street, New Brunswick, NJ 08901", phone: "(732) 555-0102", website: "https://www.rwjbh.org/rwj-university-hospital-new-brunswick/treatment-care/heart-and-vascular-care/cardiac-services/", scheduleNeeded: false },
    { type: "فحص الدم (BMP)", when: "15 أكتوبر 2026 · 9:00 صباحًا", scheduleNeeded: false },
  ],
  warnings: [
    {
      severity: "yellow",
      items: ["زيادة سريعة في الوزن، أو مزيد من التورم في ساقيك أو بطنك", "مزيد من ضيق النفس (لكن يمكنك الراحة)"],
    },
    {
      severity: "red",
      items: [
        "ضيق نفس جديد أو أسوأ، خاصة أثناء الراحة",
        "ألم أو ضغط في الصدر",
        "إغماء أو دوخة شديدة",
        "تورم يزداد بسرعة",
        "بول أقل بكثير",
        "ارتباك جديد أو ضعف شديد",
        "حمى أو سعال أسوأ رغم المضاد الحيوي",
      ],
    },
  ],
};

export const ELEANOR_PLAN_CONTENT: Record<Language, PlanContent> = { en, es, zh, ar };

/** 30 days in seconds — the fixed retention window (2,592,000 s). */
export const RETENTION_SECONDS = 2_592_000;

/**
 * Build Eleanor's full plan object. createdAt/expiresAt are computed here to mimic the
 * server rule (expiresAt = createdAt + 30 days). The demo shows 27 days remaining, so
 * createdAt is dated 3 days ago.
 */
export function buildEleanorPlan(): DischargePlan {
  const now = Date.now();
  const createdAt = new Date(now - 3 * 864e5);
  const expiresAt = new Date(createdAt.getTime() + RETENTION_SECONDS * 1000);
  return {
    id: "ELN-7Q2K",
    patientId: ELEANOR.id,
    status: "approved",
    primaryDiagnosis: ELEANOR.primaryDiagnosis,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    languages: ["en", "es"],
    langStatus: { en: "published", es: "published", zh: "none", ar: "none" },
    content: ELEANOR_PLAN_CONTENT,
  };
}
