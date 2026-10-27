import { en } from "@sparkl/i18n";

// i18n access for apps/frontend. English now; Spanish later per
// project.md (strings stay behind this module so no screen imports
// @sparkl/i18n directly).

export const DEFAULT_LOCALE = "en" as const;

export type AppLocale = typeof DEFAULT_LOCALE;

export function getStrings(_locale: AppLocale = DEFAULT_LOCALE): typeof en {
  return en;
}
