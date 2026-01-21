export type LanguageCode = "en";
type Listener = (lang: LanguageCode) => void;

const listeners = new Set<Listener>();

export const i18n = {
  translateString(text: string) {
    return text;
  },
  applyTo(_target?: ParentNode | null) {
    // no-op
  },
  onChange(cb: Listener) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  setLanguage(_lang: LanguageCode) {
    listeners.forEach((cb) => cb("en"));
  },
};
