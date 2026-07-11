"use client";
// M16 — bilingual UI. Lang state persisted client-side (localStorage "cs-lang",
// default "th"), no server round-trip. useT() is the only thing most components
// need; useLang() is for the toggle itself.
import { createContext, useContext, useEffect, useState } from "react";
import { STRINGS, type Lang, type StringKey } from "../lib/i18n";

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
}
const Ctx = createContext<LangCtx>({ lang: "th", setLang: () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("th");
  useEffect(() => {
    const saved = localStorage.getItem("cs-lang");
    if (saved === "en" || saved === "th") setLangState(saved);
  }, []);
  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem("cs-lang", l);
  }
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  return useContext(Ctx);
}

/** t("studio.title") -> current-language string. Falls back to the key itself if
 * missing (visible-in-UI failure mode, easier to spot than a silent blank). */
export function useT(): (key: StringKey) => string {
  const { lang } = useLang();
  return (key: StringKey) => STRINGS[key]?.[lang] ?? key;
}
