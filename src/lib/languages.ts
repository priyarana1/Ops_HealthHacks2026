/**
 * Languages a discharge plan can be translated into (client-safe; shared by the wizard and the API).
 * `prompt` is the name given to the translation model. The patient app has a fully translated
 * interface for the languages in PATIENT_APP_LANGUAGES (see src/types/plan.ts).
 */
export const TRANSLATION_LANGUAGES = {
  es: { name: "Spanish", prompt: "Spanish", dir: "ltr" },
  zh: { name: "Chinese (Mandarin)", prompt: "Simplified Chinese (Mandarin)", dir: "ltr" },
  ar: { name: "Arabic", prompt: "Arabic (Modern Standard Arabic)", dir: "rtl" },
  pt: { name: "Portuguese", prompt: "Portuguese (Brazilian)", dir: "ltr" },
  ko: { name: "Korean", prompt: "Korean", dir: "ltr" },
  gu: { name: "Gujarati", prompt: "Gujarati", dir: "ltr" },
  hi: { name: "Hindi", prompt: "Hindi", dir: "ltr" },
  tl: { name: "Tagalog", prompt: "Tagalog (Filipino)", dir: "ltr" },
  vi: { name: "Vietnamese", prompt: "Vietnamese", dir: "ltr" },
  ht: { name: "Haitian Creole", prompt: "Haitian Creole", dir: "ltr" },
  pl: { name: "Polish", prompt: "Polish", dir: "ltr" },
  ru: { name: "Russian", prompt: "Russian", dir: "ltr" },
  fr: { name: "French", prompt: "French", dir: "ltr" },
  it: { name: "Italian", prompt: "Italian", dir: "ltr" },
  ur: { name: "Urdu", prompt: "Urdu", dir: "rtl" },
  bn: { name: "Bengali", prompt: "Bengali", dir: "ltr" },
} as const;
export type TranslationLanguage = keyof typeof TRANSLATION_LANGUAGES;
export const TRANSLATION_CODES = Object.keys(TRANSLATION_LANGUAGES) as [TranslationLanguage, ...TranslationLanguage[]];
export const PATIENT_APP_LANGUAGES: readonly TranslationLanguage[] = ["es", "zh", "ar"];
