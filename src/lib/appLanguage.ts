export type AppLanguage = "en" | "ta";

export const getAppLocale = (language: AppLanguage) =>
  language === "ta" ? "ta-IN" : "en-US";
