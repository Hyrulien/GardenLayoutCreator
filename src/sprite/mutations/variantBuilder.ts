import type { SpriteConfig, MutationName } from '../settings';
import { MUT_META } from '../settings';
import type { SpriteState, SpriteTexture, VariantSignature, SpriteItem, SpriteJob } from '../types';

// Heuristics ported from game logic for positioning/scaling mutation icons
const TILE_SIZE_WORLD = 256;
const BASE_ICON_SCALE = 0.5; // equivalent to FLORA_SCALABLE_RENDER_SCALE
const TALL_PLANT_MUTATION_ICON_SCALE_BOOST = 2;
const FLOATING_MUTATION_ICONS = new Set<MutationName>([
  'Dawnlit',
  'Ambershine',
  'Dawncharged',
  'Ambercharged',
]);
const MUT_ICON_Y_EXCEPT: Record<string, number> = {
  Banana: 0.6,
  Carrot: 0.6,
  Sunflower: 0.5,
  Starweaver: 0.5,
  FavaBean: 0.25,
  BurrosTail: 0.2,
};
const MUT_ICON_X_EXCEPT: Record<string, number> = {
  Pepper: 0.5,
  Banana: 0.6,
};

// Ordering matches in-game stacking: Gold/Rainbow override everything,
// then base wet/chilled/frozen, then warm/charged hues render on top of them.
const MUTATION_ORDER: MutationName[] = ['Gold', 'Rainbow', 'Wet', 'Chilled', 'Frozen', 'Ambershine', 'Dawnlit', 'Dawncharged', 'Ambercharged'];
const MUTATION_INDEX = new Map(MUTATION_ORDER.map((m, idx) => [m, idx]));
const sortMutations = (list: MutationName[]): MutationName[] => {
  const uniq = [...new Set(list.filter(Boolean))];
  return uniq.sort((a, b) => (MUTATION_INDEX.get(a) ?? Infinity) - (MUTATION_INDEX.get(b) ?? Infinity));
};

const SUPPORTED_BLEND_OPS = (() => {
  try {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    if (!g) return new Set<string>();
    const ops = ['color', 'hue', 'saturation', 'luminosity', 'overlay', 'screen', 'lighter', 'source-atop'];
    const ok = new Set<string>();
    for (const op of ops) {
      g.globalCompositeOperation = op as GlobalCompositeOperation;
      if (g.globalCompositeOperation === op) ok.add(op);
    }
    return ok;
  } catch {
    return new Set<string>();
  }
})();

const pickBlendOp = (desired: string): GlobalCompositeOperation => {
  if (SUPPORTED_BLEND_OPS.has(desired)) return desired as GlobalCompositeOperation;
  if (SUPPORTED_BLEND_OPS.has('overlay')) return 'overlay';
  if (SUPPORTED_BLEND_OPS.has('screen')) return 'screen';
  if (SUPPORTED_BLEND_OPS.has('lighter')) return 'lighter';
  return 'source-atop';
};

const FILTERS: Record<string, any> = {
  Gold: { op: 'source-atop', colors: ['rgb(235,200,0)'], a: 0.7 },
  Rainbow: { op: 'color', colors: ['#FF1744', '#FF9100', '#FFEA00', '#00E676', '#2979FF', '#D500F9'], ang: 130, angTall: 0, masked: true },
  Wet: { op: 'source-atop', colors: ['rgb(50,180,200)'], a: 0.25 },
  Chilled: { op: 'source-atop', colors: ['rgb(100,160,210)'], a: 0.45 },
  Frozen: { op: 'source-atop', colors: ['rgb(100,130,220)'], a: 0.5 },
  Dawnlit: { op: 'source-atop', colors: ['rgb(209,70,231)'], a: 0.5 },
  Ambershine: { op: 'source-atop', colors: ['rgb(190,100,40)'], a: 0.5 },
  Dawncharged: { op: 'source-atop', colors: ['rgb(140,80,200)'], a: 0.5 },
  Ambercharged: { op: 'source-atop', colors: ['rgb(170,60,25)'], a: 0.5 },
};

const hasMutationFilter = (value: MutationName | '' | null): value is MutationName =>
  Boolean(value && FILTERS[value]);

const isTallKey = (k: string) => /tallplant/i.test(k);

export const computeVariantSignature = (state: SpriteState): VariantSignature => {
  if (!state.mutOn) {
    const f = hasMutationFilter(state.f) ? state.f : null;
    const baseMuts = f ? [f] : [];
    return { mode: 'F', muts: baseMuts, overlayMuts: baseMuts, selectedMuts: baseMuts, sig: `F:${f ?? ''}` };
  }
  const raw = state.mutations.filter((value): value is MutationName => hasMutationFilter(value));
  const selected = sortMutations(raw);
  const muts = normalizeMutListColor(raw);
  const overlayMuts = normalizeMutListOverlay(raw);
  return {
    mode: 'M',
    muts,
    overlayMuts,
    selectedMuts: selected,
    sig: `M:${selected.join(',')}|${muts.join(',')}|${overlayMuts.join(',')}`,
  };
};

// Backward compatibility
export const curVariant = computeVariantSignature;

export function buildVariantFromMutations(list: MutationName[]): VariantSignature {
  const raw = list.filter((value): value is MutationName => hasMutationFilter(value));
  const selected = sortMutations(raw);
  const muts = normalizeMutListColor(raw);
  const overlayMuts = normalizeMutListOverlay(raw);
  return {
    mode: 'M',
    muts,
    overlayMuts,
    selectedMuts: selected,
    sig: `M:${selected.join(',')}|${muts.join(',')}|${overlayMuts.join(',')}`,
  };
}

export function resolveTexByKey(key: string, state: SpriteState): SpriteTexture | null {
  const direct = state.tex.get(key);
  if (direct) return direct;
  const anim = state.items.find(it => it.isAnim && it.key === key);
  if (anim && anim.isAnim && anim.frames?.length) return anim.frames[0];
  const suffixed = state.tex.get(`${key}-0`);
  if (suffixed) return suffixed;
  return null;
}

const normalizeMutListColor = (list: MutationName[]): MutationName[] => {
  const names = list.filter((m, idx, arr) => FILTERS[m] && arr.indexOf(m) === idx);
  if (!names.length) return [];
  if (names.includes('Gold')) return ['Gold'];
  if (names.includes('Rainbow')) return ['Rainbow'];
  const warm = ['Ambershine', 'Dawnlit', 'Dawncharged', 'Ambercharged'] as const;
  const hasWarm = names.some(n => warm.includes(n as any));
  if (hasWarm) {
    // When warm hues are present, suppress wet/chilled/frozen filters (matches game).
    return sortMutations(names.filter(n => !['Wet', 'Chilled', 'Frozen'].includes(n)));
  }
  return sortMutations(names);
};

const normalizeMutListOverlay = (list: MutationName[]): MutationName[] => {
  const names = list.filter((m, idx, arr) => MUT_META[m]?.overlayTall && arr.indexOf(m) === idx);
  return sortMutations(names);
};

const buildMutationPipeline = (mutNames: MutationName[], isTall: boolean) =>
  mutNames.map(m => ({ name: m, meta: MUT_META[m], overlayTall: MUT_META[m]?.overlayTall, isTall }));

const angleGrad = (ctx: CanvasRenderingContext2D, w: number, h: number, ang: number, fullSpan = false) => {
  const rad = (ang - 90) * Math.PI / 180;
  const cx = w / 2;
  const cy = h / 2;
  if (!fullSpan) {
    const R = Math.min(w, h) / 2;
    return ctx.createLinearGradient(cx - Math.cos(rad) * R, cy - Math.sin(rad) * R, cx + Math.cos(rad) * R, cy + Math.sin(rad) * R);
  }
  // Projected half-extent so the gradient spans the full sprite (used for tall-plant rainbow).
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const R = Math.abs(dx) * w / 2 + Math.abs(dy) * h / 2;
  return ctx.createLinearGradient(cx - dx * R, cy - dy * R, cx + dx * R, cy + dy * R);
};

const fillGrad = (ctx: CanvasRenderingContext2D, w: number, h: number, f: any, fullSpan = false) => {
  const cols = f.colors?.length ? f.colors : ['#fff'];
  const g = f.ang != null ? angleGrad(ctx, w, h, f.ang, fullSpan) : ctx.createLinearGradient(0, 0, 0, h);
  if (cols.length === 1) {
    g.addColorStop(0, cols[0]);
    g.addColorStop(1, cols[0]);
  } else cols.forEach((c: string, i: number) => g.addColorStop(i / (cols.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

function mutationAliases(mut: MutationName): string[] {
  // Some assets use legacy names (Amberlit, Dawnbound, Amberbound)
  switch (mut) {
    case 'Ambershine':
      return ['Ambershine', 'Amberlit'];
    case 'Dawncharged':
      return ['Dawncharged', 'Dawnbound'];
    case 'Ambercharged':
      return ['Ambercharged', 'Amberbound'];
    default:
      return [mut];
  }
}

function applyFilterOnto(ctx: CanvasRenderingContext2D, sourceCanvas: HTMLCanvasElement, name: string, isTall: boolean) {
  const base = FILTERS[name];
  if (!base) return;
  const f = { ...base };
  if (name === 'Rainbow' && isTall && f.angTall != null) f.ang = f.angTall;
  const fullSpan = name === 'Rainbow' && isTall;
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  ctx.save();
  // Non-masked overlays should replace RGB while preserving alpha (ColorOverlayFilter semantics).
  // Use source-in so the solid color/gradient is clipped to the sprite alpha, then scaled by f.a.
  const blendOp = f.masked ? pickBlendOp(f.op) : 'source-in';
  ctx.globalCompositeOperation = blendOp;
  fillGrad(ctx, w, h, f, fullSpan);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.globalAlpha = f.a ?? 1;
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.restore();
}

function ensureSpriteCanvas(tex: SpriteTexture, state: SpriteState, cfg: SpriteConfig): HTMLCanvasElement | null {
  const key = tex?.label ?? '';
  if (!key) return null;
  const cacheKey = `src:${key}`;
  if (cfg.cacheOn && state.srcCan.has(cacheKey)) return state.srcCan.get(cacheKey)!;
  const sprite = state.ctors?.Sprite ? new state.ctors.Sprite(tex) : null;
  if (!sprite || !state.renderer?.extract?.canvas) return null;
  const canvas = state.renderer.extract.canvas(sprite, { resolution: 1 }) as HTMLCanvasElement;
  if (cfg.cacheOn && canvas) state.srcCan.set(cacheKey, canvas);
  return canvas;
}

function getMutationOverlayTexture(mut: MutationName, state: SpriteState): SpriteTexture | null {
  const meta = MUT_META[mut];
  if (!meta?.overlayTall) return null;
  const overlayKeys = mutationAliases(mut).map(alias => meta.overlayTall!.replace(/\/[^/]+$/, `/${alias}TallPlant`));
  for (const key of overlayKeys) {
    const tex = resolveTexByKey(key, state);
    if (tex) return tex;
  }
  return null;
}

function applyOverlayMutations(
  baseCanvas: HTMLCanvasElement,
  baseKey: string,
  muts: MutationName[],
  state: SpriteState,
  cfg: SpriteConfig
) {
  if (!muts.length) return baseCanvas;
  const isTall = isTallKey(baseKey);
  const pipeline = buildMutationPipeline(muts, isTall);
  const target = document.createElement('canvas');
  target.width = baseCanvas.width;
  target.height = baseCanvas.height;
  const ctx2 = target.getContext('2d');
  if (!ctx2) return baseCanvas;
  ctx2.imageSmoothingEnabled = false;
  ctx2.drawImage(baseCanvas, 0, 0);
  for (const entry of pipeline) {
    if (!entry.overlayTall) continue;
    const tex = getMutationOverlayTexture(entry.name, state);
    if (!tex) continue;
    const src = ensureSpriteCanvas(tex as any, state, cfg);
    if (!src) continue;
    // Resize overlay to match base canvas
    const canvas = document.createElement('canvas');
    canvas.width = baseCanvas.width;
    canvas.height = baseCanvas.height;
    const ctx3 = canvas.getContext('2d');
    if (!ctx3) continue;
    ctx3.imageSmoothingEnabled = false;
    ctx3.drawImage(src, 0, 0, baseCanvas.width, baseCanvas.height);
    ctx2.globalAlpha = 1;
    ctx2.drawImage(canvas, 0, 0);
  }
  return target;
}

function composeMutationIcons(
  baseCanvas: HTMLCanvasElement,
  baseKey: string,
  muts: MutationName[],
  state: SpriteState,
  cfg: SpriteConfig
): HTMLCanvasElement {
  if (!muts.length) return baseCanvas;
  const out = document.createElement('canvas');
  out.width = baseCanvas.width;
  out.height = baseCanvas.height;
  const ctx2 = out.getContext('2d');
  if (!ctx2) return baseCanvas;
  ctx2.imageSmoothingEnabled = false;
  ctx2.drawImage(baseCanvas, 0, 0);

  const isTall = isTallKey(baseKey);
  const baseScale = BASE_ICON_SCALE * (isTall ? TALL_PLANT_MUTATION_ICON_SCALE_BOOST : 1);
  const tileSize = baseCanvas.width || TILE_SIZE_WORLD;
  const iconSize = tileSize * baseScale;
  const yFactor = MUT_ICON_Y_EXCEPT[baseKey.split('/').pop() || ''] ?? (FLOATING_MUTATION_ICONS.has(muts[0]) ? 0.55 : 0.68);
  const xFactor = MUT_ICON_X_EXCEPT[baseKey.split('/').pop() || ''] ?? 0.5;
  const centerX = tileSize * xFactor;
  const centerY = tileSize * yFactor;

  muts.forEach((mut, idx) => {
    const meta = MUT_META[mut];
    const key = meta?.tallIconOverride || `sprite/mutation/${mut}`;
    const tex = resolveTexByKey(key, state);
    if (!tex) return;
    const src = ensureSpriteCanvas(tex as any, state, cfg);
    if (!src) return;
    const size = iconSize;
    const x = centerX - size / 2 + idx * (size * 0.15);
    const y = centerY - size / 2;
    ctx2.drawImage(src, x, y, size, size);
  });
  return out;
}

function applyFilters(
  baseCanvas: HTMLCanvasElement,
  baseKey: string,
  muts: MutationName[]
): HTMLCanvasElement {
  if (!muts.length) return baseCanvas;
  const isTall = isTallKey(baseKey);
  const out = document.createElement('canvas');
  out.width = baseCanvas.width;
  out.height = baseCanvas.height;
  const ctx2 = out.getContext('2d');
  if (!ctx2) return baseCanvas;
  ctx2.imageSmoothingEnabled = false;
  ctx2.drawImage(baseCanvas, 0, 0);
  for (const m of muts) {
    applyFilterOnto(ctx2, out, m, isTall);
  }
  return out;
}

function processJob(job: SpriteJob, state: SpriteState, cfg: SpriteConfig): SpriteTexture | null {
  const baseTex = job.src?.[job.i];
  if (!baseTex) return null;
  const baseKey = job.itKey || baseTex.label || '';
  const baseCanvas = ensureSpriteCanvas(baseTex, state, cfg);
  if (!baseCanvas) return null;

  const filtered = applyFilters(baseCanvas, baseKey, job.V.muts);
  const overlaid = applyOverlayMutations(filtered, baseKey, job.V.overlayMuts, state, cfg);
  const withIcons = composeMutationIcons(overlaid, baseKey, job.V.selectedMuts, state, cfg);

  const tex = state.ctors?.Texture?.from?.(withIcons);
  if (!tex) return null;
  return tex as SpriteTexture;
}

export function renderMutatedTexture(
  tex: SpriteTexture,
  baseKey: string,
  V: VariantSignature,
  state: SpriteState,
  cfg: SpriteConfig
): SpriteTexture {
  const cacheKey = `${baseKey}|${V.sig}`;
  const cached = state.lru.get(cacheKey);
  if (cached?.tex) return cached.tex;

  const job: SpriteJob = {
    k: cacheKey,
    sig: V.sig,
    itKey: baseKey,
    isAnim: false,
    src: [tex],
    i: 0,
    out: [],
    V,
  };
  const out = processJob(job, state, cfg);
  if (out) {
    if (cfg.cacheOn) {
      state.lru.set(cacheKey, { tex: out });
    }
    return out;
  }
  return tex;
}

export function clearVariantCache(state: SpriteState) {
  state.lru.clear();
  state.cost = 0;
}

export function processJobs(state: SpriteState, cfg: SpriteConfig) {
  if (!cfg.jobOn) return;
  const budget = cfg.jobBudgetMs ?? 5;
  const t0 = performance.now();
  while (state.jobs.length && performance.now() - t0 < budget) {
    const job = state.jobs.shift()!;
    const out = processJob(job, state, cfg);
    if (out) {
      state.lru.set(job.k, { tex: out });
    }
  }
}
