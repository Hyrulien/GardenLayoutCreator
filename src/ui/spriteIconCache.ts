import { pageWindow } from "../utils/page-context";

type SpriteServiceHandle = {
  ready?: Promise<unknown>;
  renderToCanvas?: (params: { category: string; id: string; mutations?: string[] }) => HTMLCanvasElement | null;
  list?: (category?: string) => Array<{ key?: string }>;
};

const SPRITE_PRELOAD_CATEGORIES = [
  "plant",
  "tallplant",
  "crop",
  "decor",
  "item",
  "pet",
  "seed",
  "ui",
  "mutation",
  "mutation-overlay",
] as const;

const spriteDataUrlCache = new Map<string, Promise<string | null>>();
let spriteWarmupQueued = false;
let spriteWarmupStarted = false;
type SpriteWarmupState = { total: number; done: number; completed: boolean };
let warmupState: SpriteWarmupState = { total: 0, done: 0, completed: false };
let prefetchedWarmupKeys: string[] = [];
const warmupCompletedKeys = new Set<string>();
const WARMUP_RETRY_MS = 100;
const WARMUP_DELAY_MS = 8;
const WARMUP_BATCH = 3;
const warmupListeners = new Set<(state: SpriteWarmupState) => void>();

function notifyWarmup(state: SpriteWarmupState): void {
  warmupState = state;
  warmupListeners.forEach(listener => {
    try {
      listener(warmupState);
    } catch {
      /* ignore listener errors */
    }
  });
}

export function getSpriteWarmupState(): SpriteWarmupState {
  return warmupState;
}

export function onSpriteWarmupProgress(
  listener: (state: SpriteWarmupState) => void,
): () => void {
  warmupListeners.add(listener);
  // Immediately emit current state to the new subscriber
  try {
    listener(warmupState);
  } catch {
    /* ignore */
  }
  return () => {
    warmupListeners.delete(listener);
  };
}

export function primeWarmupKeys(keys: string[]): void {
  prefetchedWarmupKeys.push(...keys);
}

function bumpWarmupTotal(total: number): void {
  if (total > warmupState.total) {
    notifyWarmup({ ...warmupState, total, completed: warmupState.completed && warmupState.done >= total });
  }
}

export function primeSpriteData(category: string, spriteId: string, dataUrl: string): void {
  const cacheKey = cacheKeyFor(category, spriteId);
  if (!spriteDataUrlCache.has(cacheKey)) {
    spriteDataUrlCache.set(cacheKey, Promise.resolve(dataUrl));
  }
  if (!warmupCompletedKeys.has(cacheKey)) {
    warmupCompletedKeys.add(cacheKey);
    const nextDone = warmupState.done + 1;
    const completed = warmupState.total > 0 ? nextDone >= warmupState.total : false;
    notifyWarmup({ total: Math.max(warmupState.total, nextDone), done: nextDone, completed });
  }
}

const normalizeSpriteId = (value: string): string =>
  String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const CUSTOM_MUTATION_ICONS: Record<string, string> = {
  gold:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC4AAAAgCAYAAABts0pHAAAKAElEQVR4AcyWS4wk2VWG///ciMjMenW9q9yeGcYwHo3YgLxgx8IbFmyQQLIQQiy8RQg2Hh4yUlkGD5YRWFgg2LBgCyxYsrBkybYsWfJDstXya6Yrq7Ky8lVZVfmozIyIe45PVHdbPVPVPV22JftWnroR93HOd/57IjMEv0Tt/z6+vWoHSF4E6RcC/vBg/98OD/b+vvnJnT8/+tu9j7/917u/33rzgx/97dfrr04W+xu/FODNf9z67uFnt7/d/Iftr7/z1s5Xmp/Z+X8muutwuzuv1O5vv5Tc23u5dm/n19J79Zqupb8S188PXl33+ed+7qz45Tc/ZM/z2DzY+/ejf95sVdb8/OYxgq1IYisWbG1nn6tb+7Kx+wFZ370fts3KbUTbE8ZVXcR1c3DNw0Z9D+tmzy+ZO4PzKerR/4brJJr/tHV09PnN9vG/bHZlM/8Dh21Utrxija1dLm3uYnl7jysUW4Xoqoqua6LrILcs6I6Be5pgmftr9/jy0mr8QH0VX3zj3lOhblzeGXztIw9ZeXkCXfUevG7B6iZaa6wgu7fFZH2LadZgarDMqNdzJlYHrWG0ZUBXfc8qiDXcr23gfrbOwCUt0uUMcWk+RvWgZlWs2+xO4Id/t/s/R5/d+dKR1+xlc+OHlcPL1lpfgqXrmwyVpXUE0oIDinjv1wlIv0cKxDrEavREEFDnXrps+/UVV2KVtDU/kQYTW4oiyzItl/Daa/Uqxm32vuCHn9z504cHO28dfmr3vwS2bGZLlljNlaxjut53ddONDYZQQQJBqIHUpDL1XqHB1Q2uclBh8Psa9moZd7O613HD55Yg6vBcK8u4TFpd59oo11BHli3dBl2NPRP8nb/a/Z13PrH/JyBrBJYhaKBSKaC2uSXZxg5TVygxQuhmFSBV4NcA5CcmlfZeFIRwOxHspj6iqZlmoGYVqCdQ94QaAVwiNEPDfc9Rm58Mq+SIW5q8d+ydv/nQ3sNP7PymkVlSt6Q0NgjxAJpu7ydpBQxaAvFygIkHFgPEgQl472M+x8pcZV7PbabklkPTV5mnq/Dy8cdXvDBQPQea+WjNRBsKqbFkFvuzOpfSgE9VJYYbTd47Mh7naR40FQlBIySIpdv3WdveTzNTTX29C+Pam4ch6fcE1Q1u5uY9Hhk3kwqYVQIw0JX1+WqNj5gGofupBAgMPp0oJEN3Iuhf+TcohAvW8OsvBdzSboAXNElDStUy7L+UyO5emhhcD4Dl+uC3bHX4Oh0FgPhmn3AIgOrmSDAAtp7ANipRAadltY4w780fEx/y/UZKVC8tF4DRExgWQbrz4GuhM1YCIRdw8HCe4JYmT49Vikg0vrSTcP/VJY2C6s//weN6wChltd5AVv0tRjgwnjX7eINzX1/JYzfanxO5p65e6az0uJ4Gc0/s0eWN/+8Cdz/2xisSSyntemX0YoGoibhXs3Sy+S2ZbP7AszDYoyVw+au13HSRNtPHg9XIe6xaJ3TJH2VVxcKVx+nnLr4fmB8NxJ9u82OQKi6QJhJjP3js9/jyW3F716fBvEySLCL3dA0eSAtHzynXakfnVTOqR4s+bfGN9WVuZka/cSQfpnmPyqoszA/q2gxwQU3hH8DYL9QmqjSoQ0QavXLMB2lIqNMx7LA51b1mt3gX4OMb3/P46klXZoX7KhC0ANM8GnMPVXgdlgQLN+/NTZRbmeNUG+mqeEB12Qw+5tcOjCdmVAp9DcwnjYOiEiACcMndlIXP5O67sBiK4YmWlxeW34sh9zW3fm6AD8IiR1UrudeLaunxZjAunMF75FApbLteYCvzemfJ/vQSoEN5aqSji4vKRwaJvvca2pNXDkrlWVmtLT01T54FXRg/gLlFzvyBumq386IwK5ho3tKk5H97TNxsN8C3Z4OFfxleSZrMkISFlJXiMjHl3ETmtpMuAHF13KGx8Kr00jGHgRIOD/i1g3syJNXgJRB9rIL2Xx2fKaEsAC4ILHx+TpM5g8w6rXKqC1lYxGx5ofPNlZrHwq3tBjgPkNfHmNssX5gtrkzCFakX3G+MbDsbB8rU8eaInIvJgg4A+OkA/ihT1RgdpjRztRXRZ6KcFdGLKJKSwxzMOHf4ubrKNIxVMem0i7FvndYzmRX06OP57Fc/87B7K7UP3gD3MQxsMk2ybKoW5rbntrsyo/LCA1/COIbIhJ6QETMHWNBhCIeClw7dnIBAiX4RcV46tCtsYeHJLsSh3dfMlFMxTL0fd1vFpX8NnxVXwaHjNCS4evk/RtcvcXhGuxV8+83BREfFtHZ/dWSaTJ1jYrShqZx7oJGjXZpxzChTgFeAXLm2c09sxsgF6Kr2ypzwErAwh3qvmMN45fumldGq8gsX/baNQkjOypLjWj1cZcbJa58+/Qbep90KTsIm6dpQYz6ieZkwjLSQcRK1Y1F67vOcynODXDjAyItiQg9IlYlIMpFuea2mRgdVTixyApURIsd+PZYoQwHP+m09g6IbF/EsEONYFBevvHX6Zff/vh951oqdv/z+uLaeDZXpyI90JMTIJB1L4CkRujAOaDKEhqExXFDlksqxdfJrOGgYicrYE/LkZVSdFEwuxHhGxbDTigN1aCvhfRhH8DJacoYXbM8Ev94fvnfp77N9SXDGzMuk0EsiXECt7eXRpbJn/lPCyDNQztDNz6HJOSw8Nhkiyjl83lUewKSPiEGvHTso9FSidmPkpQQ7t5BfvP65k2/jBdtzwflRf8AePBjGMg4lx4DMhxaLCyJcIg+nDtUSC6eudgcnRY+ldBDVe+uzdIsOquzB3MTnCp722mj5947vkx5KXki086JYXHz408Ov4Q7tueCVHx4gb3wn65UFBmVqHizp+W9qn4IzjeyahSbai7ehfGgqR2JJkyWPLIZjmjSl4FEoecjIw067PIy5taxI+8bQV0Pf3/g7b3zu/KtVrLvY+4JXznjwIF/6w+93MM97gqLPtOwzYS8JoZ+0Z31aGCDq9QlYySOQTTE+RIkjgycAnnSbZSdE9Py5P1OWg5iXA6r1R+N0UMW4q70QeOWUhK5+rNOv5V4aV/OuzGNHWxc9/40546K4LgcG6Xnd95GHHgr2K6vuT9tFT3P/VoedJZr0lkt07HLRiQs5/ci/njYr/3e1FwZ/4ph//KNR/Y9Oj+YP5p3GvH7ERI5KhBMs9DRZxBaK8oS00yd20p0cm0lbynjCxdVJttDWyIFfu//B4w9/odN/4veu/Z3BqwCuvt07aA355mGntmHtOMIJaulJtLLLenbCGluVXbbz45VxdjoehXYZw8mD8/rx/kmnXQFX5Vf5+mlNftqNT/bxY61ZlcTynx2363/Rada7h+3ay8etyvbe7rX21zut3/jCSauC/b3/HIz5jLe9J/5etP+ZwZ8OVJ0ED5Dzd7G4Nof0e3/9fXrVz+f6xwAAAP//QmZsFwAAAAZJREFUAwDDq9OMSazB0AAAAABJRU5ErkJggg==",
  rainbow:
    "data:image/png;base64,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",
};

const CUSTOM_SEED_ICONS: Record<string, string> = {
  starweaver:
    "data:image/png;base64,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",
  dawncelestial:
    "data:image/png;base64,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",
  mooncelestial:
    "data:image/png;base64,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",
};

const getCustomMutationDataUrl = (categories: string[], id: string): string | null => {
  if (!categories.map(category => category.toLowerCase()).includes("mutation")) return null;
  const normalized = normalizeSpriteId(id);
  return CUSTOM_MUTATION_ICONS[normalized] || null;
};

const getCustomSeedDataUrl = (categories: string[], id: string): string | null => {
  if (!categories.map(category => category.toLowerCase()).includes("seed")) return null;
  const normalized = normalizeSpriteId(id);
  return CUSTOM_SEED_ICONS[normalized] || null;
};

const baseNameFromKey = (key: string): string => {
  const parts = key.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? key;
};

type SpriteCacheOptions = {
  mutations?: string[];
};

const normalizeMutationList = (mutations?: string[]): { list: string[]; key: string } => {
  const list = Array.from(
    new Set((mutations ?? []).map(value => String(value ?? "").trim()).filter(Boolean)),
  );
  if (!list.length) {
    return { list, key: "" };
  }
  const key = list
    .map(val => normalizeSpriteId(val))
    .filter(Boolean)
    .sort()
    .join(",");
  return { list, key: key ? `|m=${key}` : "" };
};

const cacheKeyFor = (category: string, spriteId: string, mutationKey?: string): string =>
  `${category}:${normalizeSpriteId(spriteId)}${mutationKey ?? ""}`;

const scheduleNonBlocking = <T>(cb: () => T | Promise<T>): Promise<T> => {
  return new Promise(resolve => {
    const runner = () => {
      Promise.resolve()
        .then(cb)
        .then(resolve)
        .catch(() => resolve(cb() as any));
    };
    if (typeof (window as any).requestIdleCallback === "function") {
      (window as any).requestIdleCallback(runner, { timeout: 50 });
    } else if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(runner);
    } else {
      setTimeout(runner, 0);
    }
  });
};

function getSpriteService(): SpriteServiceHandle | null {
  const win: any = pageWindow ?? (globalThis as any);
  return win?.__MG_SPRITE_SERVICE__ ?? win?.unsafeWindow?.__MG_SPRITE_SERVICE__ ?? null;
}

const parseKeyToCategoryId = (key: string): { category: string; id: string } | null => {
  const parts = key.split("/").filter(Boolean);
  if (!parts.length) return null;
  // Accept keys like "sprite/plant/Carrot" or "plant/Carrot"
  const start = parts[0] === "sprite" || parts[0] === "sprites" ? 1 : 0;
  const category = parts[start] ?? "";
  const id = parts.slice(start + 1).join("/") || parts[parts.length - 1] || "";
  if (!category || !id) return null;
  return { category, id };
};

function whenServiceReady(handle: SpriteServiceHandle | null): Promise<void> {
  if (!handle || !handle.ready || typeof handle.ready.then !== "function") {
    return Promise.resolve();
  }
  return handle.ready.then(
    () => {},
    () => {},
  );
}

async function ensureSpriteDataCached(
  service: SpriteServiceHandle,
  category: string,
  spriteId: string,
  logTag: string,
  options?: SpriteCacheOptions,
): Promise<string | null> {
  if (!service?.renderToCanvas) {
    return null;
  }
  const { list: mutationList, key: mutationKey } = normalizeMutationList(options?.mutations);
  const cacheKey = cacheKeyFor(category, spriteId, mutationKey);
  let promise = spriteDataUrlCache.get(cacheKey);
  if (!promise) {
    promise = scheduleNonBlocking(async () => {
      try {
        const canvas = service.renderToCanvas?.({
          category,
          id: spriteId,
          mutations: mutationList,
        });
        if (!canvas) return null;
        return canvas.toDataURL("image/png");
      } catch (error) {
        console.error("[GLC SpriteIconCache] failed to cache sprite", { category, spriteId, logTag, error });
        return null;
      }
    });
    spriteDataUrlCache.set(cacheKey, promise);
  }
  return promise;
}

const spriteMatchCache = new Map<string, { category: string; spriteId: string } | null>();

function getMatchCacheKey(categories: string[], id: string): string {
  const normalizedCategories = categories.map(category => category.toLowerCase()).join("|");
  return `${normalizedCategories}|${normalizeSpriteId(id)}`;
}

function findSpriteMatch(
  service: SpriteServiceHandle,
  categories: string[],
  id: string,
): { category: string; spriteId: string } | null {
  if (!service.list) return null;
  const cacheKey = getMatchCacheKey(categories, id);
  if (spriteMatchCache.has(cacheKey)) {
    return spriteMatchCache.get(cacheKey) ?? null;
  }

  const normalizedTarget = normalizeSpriteId(id);
  const categoryLists = categories.map(category => ({
    category,
    items: service.list?.(category) ?? [],
  }));

  let matched: { category: string; spriteId: string } | null = null;
  const tryMatch = (category: string, base: string): boolean => {
    if (normalizeSpriteId(base) === normalizedTarget) {
      matched = { category, spriteId: base };
      return true;
    }
    return false;
  };

  for (const { category, items } of categoryLists) {
    for (const it of items) {
      const key = typeof it?.key === "string" ? it.key : "";
      if (!key) continue;
      const base = baseNameFromKey(key);
      if (tryMatch(category, base)) {
        spriteMatchCache.set(cacheKey, matched);
        return matched;
      }
    }
  }

  for (const { category, items } of categoryLists) {
    for (const it of items) {
      const key = typeof it?.key === "string" ? it.key : "";
      if (!key) continue;
      const base = baseNameFromKey(key);
      const normBase = normalizeSpriteId(base);
      if (!normBase) continue;
      if (
        normalizedTarget.includes(normBase) ||
        normBase.includes(normalizedTarget) ||
        normBase.startsWith(normalizedTarget) ||
        normalizedTarget.startsWith(normBase)
      ) {
        matched = { category, spriteId: base };
        spriteMatchCache.set(cacheKey, matched);
        return matched;
      }
    }
  }

  spriteMatchCache.set(cacheKey, null);
  return null;
}

type AttachSpriteIconOptions = {
  mutations?: string[];
  onSpriteApplied?: (
    img: HTMLImageElement,
    meta: { category: string; spriteId: string; candidate: string },
  ) => void;
  onNoSpriteFound?: (meta: { categories: string[]; candidates: string[] }) => void;
};

export function attachSpriteIcon(
  target: HTMLElement,
  categories: string[],
  id: string | string[],
  size: number,
  logTag: string,
  options?: AttachSpriteIconOptions,
): void {
  const candidateIds = Array.isArray(id)
    ? id.map(value => String(value ?? "").trim()).filter(Boolean)
    : [String(id ?? "").trim()].filter(Boolean);
  if (!candidateIds.length) return;
  for (const candidate of candidateIds) {
    const seedDataUrl = getCustomSeedDataUrl(categories, candidate);
    if (seedDataUrl) {
      const spriteKey = `seed:${normalizeSpriteId(candidate)}|custom`;
      const existingImg = target.querySelector<HTMLImageElement>("img[data-sprite-key]");
      if (existingImg && existingImg.dataset.spriteKey === spriteKey) {
        return;
      }
      const img = document.createElement("img");
      img.src = seedDataUrl;
      img.width = size;
      img.height = size;
      img.alt = "";
      img.decoding = "async";
      (img as any).loading = "lazy";
      img.draggable = false;
      img.style.width = `${size}px`;
      img.style.height = `${size}px`;
      img.style.objectFit = "contain";
      img.style.imageRendering = "auto";
      img.style.display = "block";
      img.dataset.spriteKey = spriteKey;
      img.dataset.spriteCategory = "seed";
      img.dataset.spriteId = candidate;
      requestAnimationFrame(() => {
        target.replaceChildren(img);
        options?.onSpriteApplied?.(img, {
          category: "seed",
          spriteId: candidate,
          candidate,
        });
      });
      return;
    }
    const dataUrl = getCustomMutationDataUrl(categories, candidate);
    if (!dataUrl) continue;
    const spriteKey = `mutation:${normalizeSpriteId(candidate)}|custom`;
    const existingImg = target.querySelector<HTMLImageElement>("img[data-sprite-key]");
    if (existingImg && existingImg.dataset.spriteKey === spriteKey) {
      return;
    }
    const img = document.createElement("img");
    img.src = dataUrl;
    img.width = size;
    img.height = size;
    img.alt = "";
    img.decoding = "async";
    (img as any).loading = "lazy";
    img.draggable = false;
    img.style.width = `${size}px`;
    img.style.height = `${size}px`;
    img.style.objectFit = "contain";
    img.style.imageRendering = "auto";
    img.style.display = "block";
    img.dataset.spriteKey = spriteKey;
    img.dataset.spriteCategory = "mutation";
    img.dataset.spriteId = candidate;
    requestAnimationFrame(() => {
      target.replaceChildren(img);
      options?.onSpriteApplied?.(img, {
        category: "mutation",
        spriteId: candidate,
        candidate,
      });
    });
    return;
  }
  const service = getSpriteService();
  if (!service?.renderToCanvas) return;
  void whenServiceReady(service).then(() =>
    scheduleNonBlocking(async () => {
      let selected:
        | {
            match: { category: string; spriteId: string };
            candidate: string;
          }
        | null = null;
      for (const candidate of candidateIds) {
        const match = findSpriteMatch(service, categories, candidate);
        if (match) {
          selected = { match, candidate };
          break;
        }
      }
      if (!selected) {
        options?.onNoSpriteFound?.({ categories, candidates: candidateIds });
        return;
      }
      const resolved = selected;
      const { key: mutationKey } = normalizeMutationList(options?.mutations);
      const spriteKey = `${resolved.match.category}:${resolved.match.spriteId}${mutationKey}`;

      const existingImg = target.querySelector<HTMLImageElement>("img[data-sprite-key]");
      if (existingImg && existingImg.dataset.spriteKey === spriteKey) {
        // Already showing the right sprite; avoid flicker/replacement.
        return;
      }

      const dataUrl = await ensureSpriteDataCached(
        service,
        resolved.match.category,
        resolved.match.spriteId,
        logTag,
        {
          mutations: options?.mutations,
        },
      );
      if (!dataUrl) return;
      const img = document.createElement("img");
      img.src = dataUrl;
      img.width = size;
      img.height = size;
      img.alt = "";
      img.decoding = "async";
      (img as any).loading = "lazy";
      img.draggable = false;
      img.style.width = `${size}px`;
      img.style.height = `${size}px`;
      img.style.objectFit = "contain";
      img.style.imageRendering = "auto";
      img.style.display = "block";
      img.dataset.spriteKey = spriteKey;
      img.dataset.spriteCategory = resolved.match.category;
      img.dataset.spriteId = resolved.match.spriteId;
      requestAnimationFrame(() => {
        target.replaceChildren(img);
        options?.onSpriteApplied?.(img, {
          category: resolved.match.category,
          spriteId: resolved.match.spriteId,
          candidate: resolved.candidate,
        });
      });
    }),
  );
}

export function attachWeatherSpriteIcon(target: HTMLElement, tag: string, size: number): void {
  if (tag === "NoWeatherEffect") return;
  attachSpriteIcon(target, ["mutation"], tag, size, "weather");
}

export function warmupSpriteCache(): void {
  if (spriteWarmupQueued || spriteWarmupStarted || typeof window === "undefined") return;
  spriteWarmupQueued = true;
  notifyWarmup({ total: warmupState.total, done: warmupState.done, completed: false });

  const scheduleRetry = () => {
    window.setTimeout(() => {
      spriteWarmupQueued = false;
      warmupSpriteCache();
    }, WARMUP_RETRY_MS);
  };

  let service = getSpriteService();
  if (!service && prefetchedWarmupKeys.length === 0) {
    scheduleRetry();
    return;
  }

  const tasks: Array<{ category: string; id: string }> = [];
  const seen = new Set<string>(warmupCompletedKeys);
  const listFn = service?.list;
  if (listFn) {
    SPRITE_PRELOAD_CATEGORIES.forEach(category => {
      const items = listFn(category) ?? [];
      items.forEach(item => {
        const key = typeof item?.key === "string" ? item.key : "";
        if (!key) return;
        const base = baseNameFromKey(key);
        if (!base) return;
        const k = `${category}:${base.toLowerCase()}`;
        if (seen.has(k)) return;
        seen.add(k);
        tasks.push({ category, id: base });
      });
    });
  }
  if (prefetchedWarmupKeys.length) {
    prefetchedWarmupKeys.forEach(key => {
      const parsed = parseKeyToCategoryId(key);
      if (!parsed) return;
      const k = `${parsed.category}:${parsed.id.toLowerCase()}`;
      if (seen.has(k)) return;
      seen.add(k);
      tasks.push(parsed);
    });
    prefetchedWarmupKeys = [];
  }
  if (!tasks.length) {
    if (warmupState.completed) {
      spriteWarmupQueued = false;
      return;
    }
    scheduleRetry();
    return;
  }

  spriteWarmupStarted = true;
  const total = Math.max(warmupState.total, tasks.length);
  const startingDone = Math.min(warmupState.done, total);
  notifyWarmup({ total, done: startingDone, completed: total === 0 || startingDone >= total });

  const processNext = () => {
    service = service || getSpriteService();
    if (!service?.renderToCanvas || !service?.list) {
      setTimeout(processNext, WARMUP_RETRY_MS);
      return;
    }

    if (!tasks.length) {
      spriteWarmupQueued = false;
      console.log("[GLC SpriteIconCache] warmup complete", {
        categories: SPRITE_PRELOAD_CATEGORIES,
        totalCached: spriteDataUrlCache.size,
      });
      notifyWarmup({ total, done: warmupState.done, completed: true });
      return;
    }

    let processed = 0;
    const batch = tasks.splice(0, WARMUP_BATCH);
    batch.forEach(entry => {
      ensureSpriteDataCached(service!, entry.category, entry.id, "warmup")
        .then(result => {
          if (result == null && !service?.renderToCanvas) {
            tasks.unshift(entry);
            return;
          }
          const completionKey = cacheKeyFor(entry.category, entry.id);
          if (!warmupCompletedKeys.has(completionKey)) {
            warmupCompletedKeys.add(completionKey);
            const nextDone = Math.min(warmupState.done + 1, total);
            notifyWarmup({ total, done: nextDone, completed: nextDone >= total });
          }
        })
        .finally(() => {
          processed += 1;
          if (processed >= batch.length) {
            setTimeout(processNext, WARMUP_DELAY_MS);
          }
        });
    });
  };

  processNext();
}
