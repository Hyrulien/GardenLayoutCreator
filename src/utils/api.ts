export type Surface = "discord" | "web";

export interface EnvironmentInfo {
  surface: Surface;
  host: string;
  origin: string;
  isInIframe: boolean;
}

export function detectEnvironment(): EnvironmentInfo {
  const isInIframe = (() => {
    try {
      return window.top !== window.self;
    } catch {
      return true;
    }
  })();
  const refHost = (() => {
    try {
      const ref = document.referrer;
      if (!ref) return "";
      return new URL(ref).hostname;
    } catch {
      return "";
    }
  })();
  const parentLooksDiscord =
    isInIframe && !!refHost && /(^|\.)discord(app)?\.com$/i.test(refHost);
  return {
    surface: parentLooksDiscord ? "discord" : "web",
    host: location.hostname,
    origin: location.origin,
    isInIframe,
  };
}

export function isDiscordSurface(): boolean {
  return detectEnvironment().surface === "discord";
}
