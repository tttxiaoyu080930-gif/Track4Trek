"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Track4TrekLanguage = "en" | "zh";

type LanguageContextValue = {
  language: Track4TrekLanguage;
  setLanguage: (language: Track4TrekLanguage) => void;
  text: (english: string, chinese: string) => string;
};

export const LANGUAGE_CHANGE_EVENT = "track4trek:language-change";
const LANGUAGE_STORAGE_KEY = "track4trek:language";

const LanguageContext = createContext<LanguageContextValue | null>(null);

function normalizeLanguage(value: string | null | undefined): Track4TrekLanguage {
  return value === "zh" ? "zh" : "en";
}

function synchronizeLanguage(language: Track4TrekLanguage, persist = true) {
  const root = document.documentElement;
  root.dataset.track4trekLanguage = language;
  root.lang = language === "zh" ? "zh-CN" : "en";
  document.title =
    language === "zh"
      ? "Track4Trek | 路线准备度分析"
      : "Track4Trek | Route readiness, explained";

  if (persist) {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // The interface still changes when browser storage is unavailable.
    }
  }

  window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGE_EVENT, { detail: { language } }));
}

export function LanguageProvider({ children }: Readonly<{ children: ReactNode }>) {
  // Matching the server-rendered default prevents translated copy from causing
  // a hydration mismatch. The saved preference is applied immediately after.
  const [language, setLanguageState] = useState<Track4TrekLanguage>("en");

  useEffect(() => {
    let savedLanguage: Track4TrekLanguage;

    try {
      savedLanguage = normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
    } catch {
      savedLanguage = normalizeLanguage(document.documentElement.dataset.track4trekLanguage);
    }

    const timer = window.setTimeout(() => {
      setLanguageState(savedLanguage);
      synchronizeLanguage(savedLanguage, false);
    }, 0);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LANGUAGE_STORAGE_KEY) return;

      const nextLanguage = normalizeLanguage(event.newValue);
      setLanguageState(nextLanguage);
      synchronizeLanguage(nextLanguage, false);
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setLanguage = useCallback((nextLanguage: Track4TrekLanguage) => {
    setLanguageState(nextLanguage);
    synchronizeLanguage(nextLanguage);
  }, []);

  const text = useCallback(
    (english: string, chinese: string) => (language === "zh" ? chinese : english),
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, text }),
    [language, setLanguage, text],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }

  return context;
}

export function LanguageToggle() {
  const { language, setLanguage, text } = useLanguage();

  return (
    <div className="language-toggle" role="group" aria-label={text("Language", "语言")}>
      <button
        className={`language-toggle-option${language === "zh" ? " is-active" : ""}`}
        type="button"
        lang="zh-CN"
        aria-pressed={language === "zh"}
        aria-label={text("Use Chinese", "切换为中文")}
        title={text("Use Chinese", "切换为中文")}
        onClick={() => setLanguage("zh")}
      >
        中
      </button>
      <span className="language-toggle-divider" aria-hidden="true">/</span>
      <button
        className={`language-toggle-option${language === "en" ? " is-active" : ""}`}
        type="button"
        lang="en"
        aria-pressed={language === "en"}
        aria-label={text("Use English", "切换为英文")}
        title={text("Use English", "切换为英文")}
        onClick={() => setLanguage("en")}
      >
        Eng
      </button>
    </div>
  );
}
