export type ToneLocale = "en" | "sw";

export type ToneProfile = {
  locale: ToneLocale;
  label: string;
  sampleGreeting: string;
  summary: string;
};
