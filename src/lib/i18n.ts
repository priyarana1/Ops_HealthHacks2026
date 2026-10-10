import type { Language } from "@/types/plan";

/**
 * Patient-portal UI strings (chrome: labels, headings, verbs). These localize the
 * interface itself. Clinical content lives in src/mocks/plan.ts and is translated
 * separately. Ported from the T{} table in PatientApp.html.
 */
export interface UIStrings {
  hello: string;
  sub: string;
  play: string;
  playSub: string;
  daysLeft: (n: number) => string;
  stays: (date: string) => string;
  todoNav: string;
  todoNavSub: string;
  helpNav: string;
  helpNavSub: string;
  more: string;
  checkin: string;
  share: string;
  teach: string;
  medsTitle: string;
  medsIntro: string;
  verbNew: string;
  verbKeep: string;
  verbStop: string;
  groupNew: string;
  groupKeep: string;
  groupStop: string;
  listen: string;
  tabHome: string;
  tabMeds: string;
  tabTodo: string;
  tabHelp: string;
  tabChat: string;
  localeDate: string;
}

export const UI: Record<Language, UIStrings> = {
  en: {
    hello: "Hello, Eleanor.",
    sub: "Here is your plan from RWJ New Brunswick.",
    play: "Play my plan",
    playSub: "Listen to your whole plan out loud.",
    daysLeft: (n) => `${n} days left`,
    stays: (d) => `Your plan stays here for 30 days. It will be removed on ${d}.`,
    todoNav: "What to do today",
    todoNavSub: "Weigh yourself, take your medicines, and do your check-in.",
    helpNav: "Need help now?",
    helpNavSub: "See when to call your care team or 911.",
    more: "More for you",
    checkin: "Daily check-in",
    share: "Share with family",
    teach: "Quick check",
    medsTitle: "Your medicines",
    medsIntro: "Three groups. Follow them every day.",
    verbNew: "START",
    verbKeep: "KEEP",
    verbStop: "STOP",
    groupNew: "NEW — start these",
    groupKeep: "KEEP TAKING",
    groupStop: "STOP or HOLD",
    listen: "Listen",
    tabHome: "Home",
    tabMeds: "Medicines",
    tabTodo: "To-do",
    tabHelp: "Help",
    tabChat: "Chat",
    localeDate: "en-US",
  },
  es: {
    hello: "Hola, Eleanor.",
    sub: "Este es su plan de RWJ New Brunswick.",
    play: "Escuchar mi plan",
    playSub: "Escuche todo su plan en voz alta.",
    daysLeft: (n) => `Faltan ${n} días`,
    stays: (d) => `Su plan se queda aquí por 30 días. Se eliminará el ${d}.`,
    todoNav: "Qué hacer hoy",
    todoNavSub: "Pésese, tome sus medicinas y haga su chequeo diario.",
    helpNav: "¿Necesita ayuda ahora?",
    helpNavSub: "Vea cuándo llamar a su equipo de cuidado o al 911.",
    more: "Más para usted",
    checkin: "Chequeo diario",
    share: "Compartir con la familia",
    teach: "Repaso rápido",
    medsTitle: "Sus medicinas",
    medsIntro: "Tres grupos. Sígalos todos los días.",
    verbNew: "EMPIECE",
    verbKeep: "SIGA",
    verbStop: "DEJE",
    groupNew: "NUEVAS — empiece a tomarlas",
    groupKeep: "SIGA TOMANDO",
    groupStop: "DEJE o ESPERE",
    listen: "Escuchar",
    tabHome: "Inicio",
    tabMeds: "Medicinas",
    tabTodo: "Tareas",
    tabHelp: "Ayuda",
    tabChat: "Chat",
    localeDate: "es-US",
  },
  zh: {
    hello: "您好，Eleanor。",
    sub: "这是您来自 RWJ New Brunswick 的出院计划。",
    play: "播放我的计划",
    playSub: "大声朗读您的整个计划。",
    daysLeft: (n) => `还剩 ${n} 天`,
    stays: (d) => `您的计划会在这里保留 30 天，并将于 ${d} 删除。`,
    todoNav: "今天要做的事",
    todoNavSub: "称体重、吃药，并完成每日检查。",
    helpNav: "现在需要帮助吗？",
    helpNavSub: "了解何时联系护理团队或拨打 911。",
    more: "更多功能",
    checkin: "每日检查",
    share: "与家人分享",
    teach: "快速自测",
    medsTitle: "您的药物",
    medsIntro: "分为三组。请每天照做。",
    verbNew: "开始",
    verbKeep: "继续",
    verbStop: "停药",
    groupNew: "新药——请开始服用",
    groupKeep: "继续服用",
    groupStop: "停药或暂停",
    listen: "收听",
    tabHome: "主页",
    tabMeds: "药物",
    tabTodo: "待办",
    tabHelp: "帮助",
    tabChat: "聊天",
    localeDate: "zh-CN",
  },
  ar: {
    hello: "مرحبًا يا Eleanor.",
    sub: "هذه خطتك من RWJ New Brunswick.",
    play: "استمع إلى خطتي",
    playSub: "استمع إلى خطتك كاملة بصوت عالٍ.",
    daysLeft: (n) => `تبقّى ${n} يومًا`,
    stays: (d) => `تبقى خطتك هنا لمدة 30 يومًا. ستُحذف في ${d}.`,
    todoNav: "ما يجب فعله اليوم",
    todoNavSub: "زِن نفسك، وتناول أدويتك، وأكمل الفحص اليومي.",
    helpNav: "هل تحتاج إلى مساعدة الآن؟",
    helpNavSub: "اعرف متى تتصل بفريق الرعاية أو بالرقم 911.",
    more: "المزيد",
    checkin: "الفحص اليومي",
    share: "المشاركة مع العائلة",
    teach: "اختبار سريع",
    medsTitle: "أدويتك",
    medsIntro: "ثلاث مجموعات. اتبعها كل يوم.",
    verbNew: "ابدأ",
    verbKeep: "استمر",
    verbStop: "أوقف",
    groupNew: "جديد — ابدأ بتناولها",
    groupKeep: "استمر في تناولها",
    groupStop: "أوقف أو انتظر",
    listen: "استمع",
    tabHome: "الرئيسية",
    tabMeds: "الأدوية",
    tabTodo: "المهام",
    tabHelp: "المساعدة",
    tabChat: "الدردشة",
    localeDate: "ar-EG-u-nu-latn",
  },
};
