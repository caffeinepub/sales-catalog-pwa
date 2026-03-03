import { create } from "zustand";
import type { Language } from "../translations";

interface LanguageState {
  lang: Language;
  toggle: () => void;
  setLang: (lang: Language) => void;
}

const LANG_KEY = "sales_catalog_lang";

function loadLang(): Language {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === "traditional" || stored === "english") return stored;
  } catch {
    // ignore
  }
  return "traditional";
}

export const useLanguageStore = create<LanguageState>((set) => ({
  lang: loadLang(),

  toggle: () =>
    set((state) => {
      const newLang: Language =
        state.lang === "traditional" ? "english" : "traditional";
      localStorage.setItem(LANG_KEY, newLang);
      return { lang: newLang };
    }),

  setLang: (lang) => {
    localStorage.setItem(LANG_KEY, lang);
    set({ lang });
  },
}));
