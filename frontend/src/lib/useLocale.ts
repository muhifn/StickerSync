"use client";

import { useSyncExternalStore } from "react";
import {
  dict,
  detectLocale,
  subscribeLocale,
  type Dict,
  type Locale,
} from "@/lib/i18n";

/**
 * Reactive locale via useSyncExternalStore.
 * SSR renders the "en" snapshot; the client re-renders once on hydration
 * if the saved/browser locale differs — no effect, no cascading renders.
 */
export function useLocale(): { locale: Locale; t: Dict } {
  const locale = useSyncExternalStore(subscribeLocale, detectLocale, () => "en" as Locale);
  return { locale, t: dict[locale] };
}
