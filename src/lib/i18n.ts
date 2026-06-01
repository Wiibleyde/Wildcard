import type frDict from "@/dictionaries/fr.json";

export type Locale = "fr" | "en";
export type Dictionary = typeof frDict;

export const locales: Locale[] = ["fr", "en"];
export const defaultLocale: Locale = "fr";

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  fr: () => import("@/dictionaries/fr.json").then((m) => m.default),
  en: () => import("@/dictionaries/en.json").then((m) => m.default),
};

export async function getDictionary(locale: string): Promise<Dictionary> {
  const load = dictionaries[locale as Locale] ?? dictionaries[defaultLocale];
  return load();
}
