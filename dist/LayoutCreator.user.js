// ==UserScript==
// @name         GLC - Garden Layout Creator
// @namespace    GLC
// @version      v1.0.1
// @match        https://1227719606223765687.discordsays.com/*
// @match        https://magiccircle.gg/r/*
// @match        https://magicgarden.gg/r/*
// @match        https://starweaver.org/r/*
// @run-at       document-start
// @inject-into  page
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @grant        GM_openInTab
// @connect      raw.githubusercontent.com
// @connect      api.github.com
// @downloadURL  https://raw.githubusercontent.com/Hyrulien/GardenLayoutCreator/main/dist/LayoutCreator.user.js
// @updateURL    https://raw.githubusercontent.com/Hyrulien/GardenLayoutCreator/main/dist/LayoutCreator.user.js
// ==/UserScript==
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/sprite/settings.ts
  var DEFAULT_CFG, MUT_META, MUT_NAMES, MUT_G1, MUT_G2, MUT_G3;
  var init_settings = __esm({
    "src/sprite/settings.ts"() {
      DEFAULT_CFG = {
        origin: "https://magicgarden.gg",
        catLevels: 1,
        labelMax: 28,
        jobOn: true,
        jobBudgetMs: 5,
        jobBurstMs: 12,
        jobBurstWindowMs: 400,
        jobCapPerTick: 20,
        cacheOn: true,
        cacheMaxEntries: 1200,
        cacheMaxCost: 5e3,
        keepCacheOnClose: true,
        srcCanvasMax: 450,
        debugLog: true,
        debugLimitDefault: 25
      };
      MUT_META = {
        Gold: { overlayTall: null, tallIconOverride: null },
        Rainbow: { overlayTall: null, tallIconOverride: null, angle: 130, angleTall: 0 },
        Wet: { overlayTall: "sprite/mutation-overlay/WetTallPlant", tallIconOverride: "sprite/mutation/Puddle" },
        Chilled: { overlayTall: "sprite/mutation-overlay/ChilledTallPlant", tallIconOverride: null },
        Frozen: { overlayTall: "sprite/mutation-overlay/FrozenTallPlant", tallIconOverride: null },
        Dawnlit: { overlayTall: null, tallIconOverride: null },
        Ambershine: { overlayTall: null, tallIconOverride: null },
        Dawncharged: { overlayTall: null, tallIconOverride: null },
        Ambercharged: { overlayTall: null, tallIconOverride: null }
      };
      MUT_NAMES = Object.keys(MUT_META);
      MUT_G1 = ["", "Gold", "Rainbow"].filter(Boolean);
      MUT_G2 = ["", "Wet", "Chilled", "Frozen"].filter(Boolean);
      MUT_G3 = ["", "Dawnlit", "Ambershine", "Dawncharged", "Ambercharged"].filter(Boolean);
    }
  });

  // src/sprite/mutations/variantBuilder.ts
  function buildVariantFromMutations(list) {
    const raw = list.filter((value) => hasMutationFilter(value));
    const selected = sortMutations(raw);
    const muts = normalizeMutListColor(raw);
    const overlayMuts = normalizeMutListOverlay(raw);
    return {
      mode: "M",
      muts,
      overlayMuts,
      selectedMuts: selected,
      sig: `M:${selected.join(",")}|${muts.join(",")}|${overlayMuts.join(",")}`
    };
  }
  function resolveTexByKey(key, state2) {
    const direct = state2.tex.get(key);
    if (direct) return direct;
    const anim = state2.items.find((it) => it.isAnim && it.key === key);
    if (anim && anim.isAnim && anim.frames?.length) return anim.frames[0];
    const suffixed = state2.tex.get(`${key}-0`);
    if (suffixed) return suffixed;
    return null;
  }
  function mutationAliases(mut) {
    switch (mut) {
      case "Ambershine":
        return ["Ambershine", "Amberlit"];
      case "Dawncharged":
        return ["Dawncharged", "Dawnbound"];
      case "Ambercharged":
        return ["Ambercharged", "Amberbound"];
      default:
        return [mut];
    }
  }
  function applyFilterOnto(ctx2, sourceCanvas, name, isTall) {
    const base = FILTERS[name];
    if (!base) return;
    const f = { ...base };
    if (name === "Rainbow" && isTall && f.angTall != null) f.ang = f.angTall;
    const fullSpan = name === "Rainbow" && isTall;
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    ctx2.save();
    const blendOp = f.masked ? pickBlendOp(f.op) : "source-in";
    ctx2.globalCompositeOperation = blendOp;
    fillGrad(ctx2, w, h, f, fullSpan);
    ctx2.globalCompositeOperation = "destination-in";
    ctx2.globalAlpha = f.a ?? 1;
    ctx2.drawImage(sourceCanvas, 0, 0);
    ctx2.restore();
  }
  function ensureSpriteCanvas(tex, state2, cfg) {
    const key = tex?.label ?? "";
    if (!key) return null;
    const cacheKey = `src:${key}`;
    if (cfg.cacheOn && state2.srcCan.has(cacheKey)) return state2.srcCan.get(cacheKey);
    const sprite = state2.ctors?.Sprite ? new state2.ctors.Sprite(tex) : null;
    if (!sprite || !state2.renderer?.extract?.canvas) return null;
    const canvas = state2.renderer.extract.canvas(sprite, { resolution: 1 });
    if (cfg.cacheOn && canvas) state2.srcCan.set(cacheKey, canvas);
    return canvas;
  }
  function getMutationOverlayTexture(mut, state2) {
    const meta = MUT_META[mut];
    if (!meta?.overlayTall) return null;
    const overlayKeys = mutationAliases(mut).map((alias) => meta.overlayTall.replace(/\/[^/]+$/, `/${alias}TallPlant`));
    for (const key of overlayKeys) {
      const tex = resolveTexByKey(key, state2);
      if (tex) return tex;
    }
    return null;
  }
  function applyOverlayMutations(baseCanvas, baseKey, muts, state2, cfg) {
    if (!muts.length) return baseCanvas;
    const isTall = isTallKey(baseKey);
    const pipeline = buildMutationPipeline(muts, isTall);
    const target = document.createElement("canvas");
    target.width = baseCanvas.width;
    target.height = baseCanvas.height;
    const ctx2 = target.getContext("2d");
    if (!ctx2) return baseCanvas;
    ctx2.imageSmoothingEnabled = false;
    ctx2.drawImage(baseCanvas, 0, 0);
    for (const entry of pipeline) {
      if (!entry.overlayTall) continue;
      const tex = getMutationOverlayTexture(entry.name, state2);
      if (!tex) continue;
      const src = ensureSpriteCanvas(tex, state2, cfg);
      if (!src) continue;
      const canvas = document.createElement("canvas");
      canvas.width = baseCanvas.width;
      canvas.height = baseCanvas.height;
      const ctx3 = canvas.getContext("2d");
      if (!ctx3) continue;
      ctx3.imageSmoothingEnabled = false;
      ctx3.drawImage(src, 0, 0, baseCanvas.width, baseCanvas.height);
      ctx2.globalAlpha = 1;
      ctx2.drawImage(canvas, 0, 0);
    }
    return target;
  }
  function composeMutationIcons(baseCanvas, baseKey, muts, state2, cfg) {
    if (!muts.length) return baseCanvas;
    const out = document.createElement("canvas");
    out.width = baseCanvas.width;
    out.height = baseCanvas.height;
    const ctx2 = out.getContext("2d");
    if (!ctx2) return baseCanvas;
    ctx2.imageSmoothingEnabled = false;
    ctx2.drawImage(baseCanvas, 0, 0);
    const isTall = isTallKey(baseKey);
    const baseScale = BASE_ICON_SCALE * (isTall ? TALL_PLANT_MUTATION_ICON_SCALE_BOOST : 1);
    const tileSize = baseCanvas.width || TILE_SIZE_WORLD;
    const iconSize = tileSize * baseScale;
    const yFactor = MUT_ICON_Y_EXCEPT[baseKey.split("/").pop() || ""] ?? (FLOATING_MUTATION_ICONS.has(muts[0]) ? 0.55 : 0.68);
    const xFactor = MUT_ICON_X_EXCEPT[baseKey.split("/").pop() || ""] ?? 0.5;
    const centerX = tileSize * xFactor;
    const centerY = tileSize * yFactor;
    muts.forEach((mut, idx) => {
      const meta = MUT_META[mut];
      const key = meta?.tallIconOverride || `sprite/mutation/${mut}`;
      const tex = resolveTexByKey(key, state2);
      if (!tex) return;
      const src = ensureSpriteCanvas(tex, state2, cfg);
      if (!src) return;
      const size = iconSize;
      const x = centerX - size / 2 + idx * (size * 0.15);
      const y = centerY - size / 2;
      ctx2.drawImage(src, x, y, size, size);
    });
    return out;
  }
  function applyFilters(baseCanvas, baseKey, muts) {
    if (!muts.length) return baseCanvas;
    const isTall = isTallKey(baseKey);
    const out = document.createElement("canvas");
    out.width = baseCanvas.width;
    out.height = baseCanvas.height;
    const ctx2 = out.getContext("2d");
    if (!ctx2) return baseCanvas;
    ctx2.imageSmoothingEnabled = false;
    ctx2.drawImage(baseCanvas, 0, 0);
    for (const m of muts) {
      applyFilterOnto(ctx2, out, m, isTall);
    }
    return out;
  }
  function processJob(job, state2, cfg) {
    const baseTex = job.src?.[job.i];
    if (!baseTex) return null;
    const baseKey = job.itKey || baseTex.label || "";
    const baseCanvas = ensureSpriteCanvas(baseTex, state2, cfg);
    if (!baseCanvas) return null;
    const filtered = applyFilters(baseCanvas, baseKey, job.V.muts);
    const overlaid = applyOverlayMutations(filtered, baseKey, job.V.overlayMuts, state2, cfg);
    const withIcons = composeMutationIcons(overlaid, baseKey, job.V.selectedMuts, state2, cfg);
    const tex = state2.ctors?.Texture?.from?.(withIcons);
    if (!tex) return null;
    return tex;
  }
  function renderMutatedTexture(tex, baseKey, V, state2, cfg) {
    const cacheKey = `${baseKey}|${V.sig}`;
    const cached = state2.lru.get(cacheKey);
    if (cached?.tex) return cached.tex;
    const job = {
      k: cacheKey,
      sig: V.sig,
      itKey: baseKey,
      isAnim: false,
      src: [tex],
      i: 0,
      out: [],
      V
    };
    const out = processJob(job, state2, cfg);
    if (out) {
      if (cfg.cacheOn) {
        state2.lru.set(cacheKey, { tex: out });
      }
      return out;
    }
    return tex;
  }
  function clearVariantCache(state2) {
    state2.lru.clear();
    state2.cost = 0;
  }
  function processJobs(state2, cfg) {
    if (!cfg.jobOn) return;
    const budget = cfg.jobBudgetMs ?? 5;
    const t0 = performance.now();
    while (state2.jobs.length && performance.now() - t0 < budget) {
      const job = state2.jobs.shift();
      const out = processJob(job, state2, cfg);
      if (out) {
        state2.lru.set(job.k, { tex: out });
      }
    }
  }
  var TILE_SIZE_WORLD, BASE_ICON_SCALE, TALL_PLANT_MUTATION_ICON_SCALE_BOOST, FLOATING_MUTATION_ICONS, MUT_ICON_Y_EXCEPT, MUT_ICON_X_EXCEPT, MUTATION_ORDER, MUTATION_INDEX, sortMutations, SUPPORTED_BLEND_OPS, pickBlendOp, FILTERS, hasMutationFilter, isTallKey, computeVariantSignature, curVariant, normalizeMutListColor, normalizeMutListOverlay, buildMutationPipeline, angleGrad, fillGrad;
  var init_variantBuilder = __esm({
    "src/sprite/mutations/variantBuilder.ts"() {
      init_settings();
      TILE_SIZE_WORLD = 256;
      BASE_ICON_SCALE = 0.5;
      TALL_PLANT_MUTATION_ICON_SCALE_BOOST = 2;
      FLOATING_MUTATION_ICONS = /* @__PURE__ */ new Set([
        "Dawnlit",
        "Ambershine",
        "Dawncharged",
        "Ambercharged"
      ]);
      MUT_ICON_Y_EXCEPT = {
        Banana: 0.6,
        Carrot: 0.6,
        Sunflower: 0.5,
        Starweaver: 0.5,
        FavaBean: 0.25,
        BurrosTail: 0.2
      };
      MUT_ICON_X_EXCEPT = {
        Pepper: 0.5,
        Banana: 0.6
      };
      MUTATION_ORDER = ["Gold", "Rainbow", "Wet", "Chilled", "Frozen", "Ambershine", "Dawnlit", "Dawncharged", "Ambercharged"];
      MUTATION_INDEX = new Map(MUTATION_ORDER.map((m, idx) => [m, idx]));
      sortMutations = (list) => {
        const uniq = [...new Set(list.filter(Boolean))];
        return uniq.sort((a, b) => (MUTATION_INDEX.get(a) ?? Infinity) - (MUTATION_INDEX.get(b) ?? Infinity));
      };
      SUPPORTED_BLEND_OPS = (() => {
        try {
          const c = document.createElement("canvas");
          const g = c.getContext("2d");
          if (!g) return /* @__PURE__ */ new Set();
          const ops = ["color", "hue", "saturation", "luminosity", "overlay", "screen", "lighter", "source-atop"];
          const ok = /* @__PURE__ */ new Set();
          for (const op of ops) {
            g.globalCompositeOperation = op;
            if (g.globalCompositeOperation === op) ok.add(op);
          }
          return ok;
        } catch {
          return /* @__PURE__ */ new Set();
        }
      })();
      pickBlendOp = (desired) => {
        if (SUPPORTED_BLEND_OPS.has(desired)) return desired;
        if (SUPPORTED_BLEND_OPS.has("overlay")) return "overlay";
        if (SUPPORTED_BLEND_OPS.has("screen")) return "screen";
        if (SUPPORTED_BLEND_OPS.has("lighter")) return "lighter";
        return "source-atop";
      };
      FILTERS = {
        Gold: { op: "source-atop", colors: ["rgb(235,200,0)"], a: 0.7 },
        Rainbow: { op: "color", colors: ["#FF1744", "#FF9100", "#FFEA00", "#00E676", "#2979FF", "#D500F9"], ang: 130, angTall: 0, masked: true },
        Wet: { op: "source-atop", colors: ["rgb(50,180,200)"], a: 0.25 },
        Chilled: { op: "source-atop", colors: ["rgb(100,160,210)"], a: 0.45 },
        Frozen: { op: "source-atop", colors: ["rgb(100,130,220)"], a: 0.5 },
        Dawnlit: { op: "source-atop", colors: ["rgb(209,70,231)"], a: 0.5 },
        Ambershine: { op: "source-atop", colors: ["rgb(190,100,40)"], a: 0.5 },
        Dawncharged: { op: "source-atop", colors: ["rgb(140,80,200)"], a: 0.5 },
        Ambercharged: { op: "source-atop", colors: ["rgb(170,60,25)"], a: 0.5 }
      };
      hasMutationFilter = (value) => Boolean(value && FILTERS[value]);
      isTallKey = (k) => /tallplant/i.test(k);
      computeVariantSignature = (state2) => {
        if (!state2.mutOn) {
          const f = hasMutationFilter(state2.f) ? state2.f : null;
          const baseMuts = f ? [f] : [];
          return { mode: "F", muts: baseMuts, overlayMuts: baseMuts, selectedMuts: baseMuts, sig: `F:${f ?? ""}` };
        }
        const raw = state2.mutations.filter((value) => hasMutationFilter(value));
        const selected = sortMutations(raw);
        const muts = normalizeMutListColor(raw);
        const overlayMuts = normalizeMutListOverlay(raw);
        return {
          mode: "M",
          muts,
          overlayMuts,
          selectedMuts: selected,
          sig: `M:${selected.join(",")}|${muts.join(",")}|${overlayMuts.join(",")}`
        };
      };
      curVariant = computeVariantSignature;
      normalizeMutListColor = (list) => {
        const names = list.filter((m, idx, arr) => FILTERS[m] && arr.indexOf(m) === idx);
        if (!names.length) return [];
        if (names.includes("Gold")) return ["Gold"];
        if (names.includes("Rainbow")) return ["Rainbow"];
        const warm = ["Ambershine", "Dawnlit", "Dawncharged", "Ambercharged"];
        const hasWarm = names.some((n) => warm.includes(n));
        if (hasWarm) {
          return sortMutations(names.filter((n) => !["Wet", "Chilled", "Frozen"].includes(n)));
        }
        return sortMutations(names);
      };
      normalizeMutListOverlay = (list) => {
        const names = list.filter((m, idx, arr) => MUT_META[m]?.overlayTall && arr.indexOf(m) === idx);
        return sortMutations(names);
      };
      buildMutationPipeline = (mutNames, isTall) => mutNames.map((m) => ({ name: m, meta: MUT_META[m], overlayTall: MUT_META[m]?.overlayTall, isTall }));
      angleGrad = (ctx2, w, h, ang, fullSpan = false) => {
        const rad = (ang - 90) * Math.PI / 180;
        const cx = w / 2;
        const cy = h / 2;
        if (!fullSpan) {
          const R2 = Math.min(w, h) / 2;
          return ctx2.createLinearGradient(cx - Math.cos(rad) * R2, cy - Math.sin(rad) * R2, cx + Math.cos(rad) * R2, cy + Math.sin(rad) * R2);
        }
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);
        const R = Math.abs(dx) * w / 2 + Math.abs(dy) * h / 2;
        return ctx2.createLinearGradient(cx - dx * R, cy - dy * R, cx + dx * R, cy + dy * R);
      };
      fillGrad = (ctx2, w, h, f, fullSpan = false) => {
        const cols = f.colors?.length ? f.colors : ["#fff"];
        const g = f.ang != null ? angleGrad(ctx2, w, h, f.ang, fullSpan) : ctx2.createLinearGradient(0, 0, 0, h);
        if (cols.length === 1) {
          g.addColorStop(0, cols[0]);
          g.addColorStop(1, cols[0]);
        } else cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
        ctx2.fillStyle = g;
        ctx2.fillRect(0, 0, w, h);
      };
    }
  });

  // src/sprite/api/spriteApi.ts
  var spriteApi_exports = {};
  __export(spriteApi_exports, {
    buildVariant: () => buildVariant,
    getBaseSprite: () => getBaseSprite,
    getSpriteWithMutations: () => getSpriteWithMutations,
    listItemsByCategory: () => listItemsByCategory
  });
  function findItem(state2, category, id) {
    const normId = normalizeKey(id);
    for (const it of state2.items) {
      const keyCat = keyCategoryOf(it.key);
      if (!matchesCategory(keyCat, category)) continue;
      const base = normalizeKey(baseNameOf(it.key));
      if (base === normId) return it;
    }
    return null;
  }
  function listItemsByCategory(state2, category = "any") {
    return state2.items.filter((it) => matchesCategory(keyCategoryOf(it.key), category));
  }
  function buildVariant(mutations) {
    return buildVariantFromMutations(mutations);
  }
  function getSpriteWithMutations(params, state2, cfg) {
    const it = findItem(state2, params.category, params.id);
    if (!it) return null;
    const tex = it.isAnim ? it.frames?.[0] : it.first;
    if (!tex) return null;
    const V = buildVariantFromMutations(params.mutations);
    return renderMutatedTexture(tex, it.key, V, state2, cfg);
  }
  function getBaseSprite(params, state2) {
    const it = findItem(state2, params.category, params.id);
    if (!it) return null;
    return it.isAnim ? it.frames?.[0] ?? null : it.first;
  }
  var normalizeKey, categoryAlias, keyCategoryOf, matchesCategory, baseNameOf;
  var init_spriteApi = __esm({
    "src/sprite/api/spriteApi.ts"() {
      init_variantBuilder();
      normalizeKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      categoryAlias = {
        plant: ["plant"],
        tallplant: ["tallplant"],
        crop: ["crop"],
        decor: ["decor"],
        item: ["item"],
        pet: ["pet", "pets", "pet-egg", "petegg"],
        seed: ["seed"],
        mutation: ["mutation"],
        "mutation-overlay": ["mutation-overlay"],
        ui: ["ui"],
        any: []
      };
      keyCategoryOf = (key) => {
        const parts = key.split("/").filter(Boolean);
        if (parts[0] === "sprite" || parts[0] === "sprites") return parts[1] ?? "";
        return parts[0] ?? "";
      };
      matchesCategory = (keyCat, requested) => {
        if (requested === "any") return true;
        const normalized = normalizeKey(keyCat);
        if (requested === "pet" && normalized.startsWith("pet")) return true;
        const aliases = categoryAlias[requested] || [];
        return aliases.some((a) => normalizeKey(a) === normalized);
      };
      baseNameOf = (key) => {
        const parts = key.split("/").filter(Boolean);
        return parts[parts.length - 1] || "";
      };
    }
  });

  // src/utils/page-context.ts
  var sandboxWin = window;
  var pageWin = typeof unsafeWindow !== "undefined" && unsafeWindow ? unsafeWindow : sandboxWin;
  var pageWindow = pageWin;
  var isIsolatedContext = pageWin !== sandboxWin;
  function shareGlobal(name, value) {
    try {
      pageWin[name] = value;
    } catch {
    }
    if (isIsolatedContext) {
      try {
        sandboxWin[name] = value;
      } catch {
      }
    }
  }
  function readSharedGlobal(name) {
    if (isIsolatedContext) {
      const sandboxValue = sandboxWin[name];
      if (sandboxValue !== void 0) return sandboxValue;
    }
    return pageWin[name];
  }

  // src/core/state.ts
  var NativeWS = pageWindow.WebSocket;
  var NativeWorker = pageWindow.Worker;
  var sockets = [];
  var quinoaWS = null;
  function setQWS(ws, why) {
    if (!quinoaWS) {
      quinoaWS = ws;
      shareGlobal("quinoaWS", ws);
      try {
        console.log("[GLC QuinoaWS] selected ->", why);
      } catch {
      }
    }
  }
  var Workers = typeof Set !== "undefined" ? /* @__PURE__ */ new Set() : {
    _a: [],
    add(w) {
      this._a.push(w);
    },
    delete(w) {
      const i = this._a.indexOf(w);
      if (i >= 0) this._a.splice(i, 1);
    },
    forEach(fn) {
      for (let i = 0; i < this._a.length; i++) fn(this._a[i]);
    }
  };

  // src/core/parse.ts
  async function parseWSData(d) {
    try {
      if (typeof d === "string") return JSON.parse(d);
      if (d instanceof Blob) return JSON.parse(await d.text());
      if (d instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(d));
    } catch {
    }
    return null;
  }

  // src/hooks/ws-hook.ts
  var installed = false;
  function installPageWebSocketHook() {
    if (installed) return;
    installed = true;
    try {
      const OriginalWS = NativeWS;
      if (!OriginalWS) return;
      const WSProxy = function(...args) {
        const ws = new OriginalWS(...args);
        sockets.push(ws);
        try {
          setQWS(ws, "hook");
        } catch {
        }
        try {
          ws.addEventListener("open", () => {
            setTimeout(() => {
              if (ws.readyState === NativeWS.OPEN) setQWS(ws, "open-fallback");
            }, 800);
          });
          ws.addEventListener("message", async (ev) => {
            const parsed = await parseWSData(ev.data);
            if (!parsed) return;
            if (!hasSharedQuinoaWS() && (parsed.type === "Welcome" || parsed.type === "Config" || parsed.fullState || parsed.config)) {
              setQWS(ws, "message:" + (parsed.type || "state"));
            }
          });
        } catch {
        }
        return ws;
      };
      WSProxy.prototype = OriginalWS.prototype;
      try {
        WSProxy.OPEN = OriginalWS.OPEN;
      } catch {
      }
      try {
        WSProxy.CLOSED = OriginalWS.CLOSED;
      } catch {
      }
      try {
        WSProxy.CLOSING = OriginalWS.CLOSING;
      } catch {
      }
      try {
        WSProxy.CONNECTING = OriginalWS.CONNECTING;
      } catch {
      }
      pageWindow.WebSocket = WSProxy;
      if (pageWindow !== window) {
        try {
          window.WebSocket = WSProxy;
        } catch {
        }
      }
    } catch {
    }
    try {
      const OriginalWorker = NativeWorker;
      const WorkerProxy = function(...args) {
        const worker = new OriginalWorker(...args);
        try {
          Workers.add?.(worker);
        } catch {
        }
        return worker;
      };
      WorkerProxy.prototype = OriginalWorker.prototype;
      pageWindow.Worker = WorkerProxy;
    } catch {
    }
    function hasSharedQuinoaWS() {
      const existing = readSharedGlobal("quinoaWS");
      return !!existing;
    }
    const scheduleRoomConnectionFallback = () => {
      const FALLBACK_DELAY_MS = 5e3;
      const win = pageWindow || window;
      win.setTimeout(() => {
        try {
          if (hasSharedQuinoaWS()) return;
          const conn = win.MagicCircle_RoomConnection || readSharedGlobal("MagicCircle_RoomConnection");
          const ws = conn?.currentWebSocket || conn?.ws || conn?.socket || conn?.currentWS;
          if (ws && ws.readyState === NativeWS.OPEN) {
            setQWS(ws, "room-connection-fallback");
          }
        } catch {
        }
      }, FALLBACK_DELAY_MS);
    };
    scheduleRoomConnectionFallback();
  }

  // src/utils/i18n.ts
  var listeners = /* @__PURE__ */ new Set();
  var i18n = {
    translateString(text) {
      return text;
    },
    applyTo(_target) {
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    setLanguage(_lang) {
      listeners.forEach((cb) => cb("en"));
    }
  };

  // src/utils/localStorage.ts
  var ARIES_STORAGE_KEY = "aries_mod";
  var GLC_STORAGE_KEY = "glc_settings";
  function getStorage() {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }
  function readRoot() {
    const storage = getStorage();
    if (!storage) return {};
    const raw = storage.getItem(ARIES_STORAGE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  function readGlcRoot() {
    const storage = getStorage();
    if (!storage) return {};
    const raw = storage.getItem(GLC_STORAGE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  function writeRoot(next) {
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.setItem(ARIES_STORAGE_KEY, JSON.stringify(next));
    } catch {
    }
  }
  function writeGlcRoot(next) {
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.setItem(GLC_STORAGE_KEY, JSON.stringify(next));
    } catch {
    }
  }
  function toPath(path) {
    if (!path) return [];
    return Array.isArray(path) ? path.slice() : path.split(".").map((k) => k.match(/^\d+$/) ? Number(k) : k);
  }
  function getAtPath(root, path) {
    let cur = root;
    for (const seg of path) {
      if (cur == null) return void 0;
      cur = cur[seg];
    }
    return cur;
  }
  function setAtPath(root, path, value) {
    if (!path.length) return value;
    const clone = Array.isArray(root) ? root.slice() : { ...root ?? {} };
    let cur = clone;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      const src = cur[key];
      const next = typeof src === "object" && src !== null ? Array.isArray(src) ? src.slice() : { ...src } : {};
      cur[key] = next;
      cur = next;
    }
    cur[path[path.length - 1]] = value;
    return clone;
  }
  function readAriesPath(path) {
    const root = readRoot();
    return getAtPath(root, toPath(path));
  }
  function readGlcPath(path) {
    const root = readGlcRoot();
    return getAtPath(root, toPath(path));
  }
  function writeAriesPath(path, value) {
    const root = readRoot();
    const next = setAtPath(root, toPath(path), value);
    writeRoot(next);
  }
  function writeGlcPath(path, value) {
    const root = readGlcRoot();
    const next = setAtPath(root, toPath(path), value);
    writeGlcRoot(next);
  }
  function updateAriesPath(path, value) {
    writeAriesPath(path, value);
  }

  // src/ui/hud.ts
  function mountHUD(opts) {
    const MARGIN = 8;
    const Z_BASE = 2e6;
    const HUD_WIN_PATH = (id) => `glc.hud.windows.${id}`;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => mountHUD(opts), { once: true });
      return;
    }
    const css = `
  :root{
    --glc-panel:     #111823cc;
    --glc-border:    #ffffff22;
    --glc-text:      #e7eef7;
    --glc-shadow:    0 10px 36px rgba(0,0,0,.45);
    --glc-blur:      8px;
  }
  .glc-launch{
    position:fixed; right:16px; bottom:16px; z-index:${Z_BASE};
    font:12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    color:var(--glc-text);
    background:var(--glc-panel);
    border:1px solid var(--glc-border);
    border-radius:12px;
    padding:8px 10px;
    box-shadow:var(--glc-shadow);
    backdrop-filter:blur(var(--glc-blur));
    display:flex; flex-direction:column; gap:6px;
    min-width:180px;
  }
  .glc-launch .glc-launch-item{ display:flex; align-items:center; gap:8px }
  .glc-launch .glc-launch-item .name{ flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
  .glc-launch .btn{
    cursor:pointer; border-radius:10px; border:1px solid var(--glc-border);
    padding:6px 10px;
    background:linear-gradient(180deg, #ffffff12, #ffffff06);
    color:#fff;
  }
  .glc-launch .btn.active{
    background:linear-gradient(180deg, rgba(122,162,255,.28), rgba(122,162,255,.12));
    border-color:#9db7ff66;
  }
  .glc-win{
    position:fixed; z-index:${Z_BASE + 1}; min-width:260px; max-width:900px; max-height:90vh; overflow:auto;
    background:var(--glc-panel); color:var(--glc-text);
    border:1px solid var(--glc-border); border-radius:12px;
    box-shadow:var(--glc-shadow); backdrop-filter:blur(var(--glc-blur));
  }
  .glc-win .w-head{
    display:flex; align-items:center; gap:8px; padding:10px 12px;
    border-bottom:1px solid var(--glc-border); cursor:move;
    background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
    border-top-left-radius:12px; border-top-right-radius:12px;
  }
  .glc-win .w-title{ font-weight:700 }
  .glc-win .sp{ flex:1 }
  .glc-win .w-btn{
    cursor:pointer; border-radius:10px; border:1px solid var(--glc-border);
    padding:4px 8px; background:linear-gradient(180deg, #ffffff12, #ffffff06); color:#fff;
  }
  .glc-win .w-btn:hover{ background:linear-gradient(180deg, #ffffff18, #ffffff0a); border-color:#ffffff44 }
  .glc-win .w-body{ padding:12px }
  `;
    const st = document.createElement("style");
    st.textContent = css;
    (document.documentElement || document.body).appendChild(st);
    const launcher = document.createElement("div");
    launcher.className = "glc-launch";
    (document.documentElement || document.body).appendChild(launcher);
    const HIDE_MENU_PATH = "glc.settings.hideMenu";
    const HIDE_MENU_KEY = "glc.settings.hideMenu";
    const readHideMenuSetting = () => {
      const stored = readGlcPath(HIDE_MENU_PATH);
      if (typeof stored === "boolean") return stored;
      const legacyAries = readAriesPath(HIDE_MENU_PATH);
      if (typeof legacyAries === "boolean") {
        writeGlcPath(HIDE_MENU_PATH, legacyAries);
        return legacyAries;
      }
      try {
        const raw = window.localStorage?.getItem(HIDE_MENU_KEY);
        if (raw != null) {
          const parsed = raw === "1" || raw === "true";
          writeGlcPath(HIDE_MENU_PATH, parsed);
          return parsed;
        }
      } catch {
      }
      return false;
    };
    const getLaunchItemEl = () => launcher.querySelector('.glc-launch-item[data-id="editor"]');
    const setLauncherHidden = (hidden) => {
      const item = getLaunchItemEl();
      if (item) item.style.display = hidden ? "none" : "";
      const anyVisible = Array.from(launcher.querySelectorAll(".glc-launch-item")).some(
        (el2) => el2.style.display !== "none"
      );
      launcher.style.display = anyVisible ? "" : "none";
    };
    const applyHideMenuSetting = () => {
      const hidden = readHideMenuSetting();
      setLauncherHidden(hidden);
    };
    applyHideMenuSetting();
    const windows = /* @__PURE__ */ new Map();
    const launchButtons = /* @__PURE__ */ new Map();
    const translate = (s) => {
      try {
        return i18n.translateString?.(s) ?? s;
      } catch {
        return s;
      }
    };
    function setLaunchState(id, open) {
      const btn = launchButtons.get(id);
      if (!btn) return;
      btn.textContent = translate(open ? "Close" : "Open");
      btn.dataset.open = open ? "1" : "0";
      if (open) btn.classList.add("active");
      else btn.classList.remove("active");
    }
    function restoreWinPos(id, el2) {
      const pos = readAriesPath(HUD_WIN_PATH(id));
      if (!pos) return;
      if (Number.isFinite(pos.x)) el2.style.left = `${pos.x}px`;
      if (Number.isFinite(pos.y)) el2.style.top = `${pos.y}px`;
    }
    function saveWinPos(id, el2) {
      const rect = el2.getBoundingClientRect();
      writeAriesPath(HUD_WIN_PATH(id), { x: rect.left, y: rect.top });
    }
    function attachDrag(el2, onMove, onUp) {
      let startX = 0;
      let startY = 0;
      let baseX = 0;
      let baseY = 0;
      let dragging = false;
      const onDown = (e) => {
        if (e.target?.closest?.(".w-btn")) return;
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = el2.getBoundingClientRect();
        baseX = rect.left;
        baseY = rect.top;
        document.addEventListener("mousemove", onMoveEv);
        document.addEventListener("mouseup", onUpEv, { once: true });
      };
      const onMoveEv = (e) => {
        if (!dragging) return;
        onMove(baseX + (e.clientX - startX), baseY + (e.clientY - startY));
      };
      const onUpEv = () => {
        dragging = false;
        document.removeEventListener("mousemove", onMoveEv);
        onUp?.();
      };
      el2.addEventListener("mousedown", onDown);
    }
    function openWindow(id, title, render) {
      const existing = windows.get(id);
      if (existing) {
        existing.el.style.display = "";
        return;
      }
      const win = document.createElement("div");
      win.className = "glc-win";
      win.style.left = `${MARGIN}px`;
      win.style.top = `${MARGIN}px`;
      win.innerHTML = `
      <div class="w-head">
        <div class="w-title">${title}</div>
        <div class="sp"></div>
        <button class="w-btn" data-act="min">\u2013</button>
        <button class="w-btn" data-act="close">\u2715</button>
      </div>
      <div class="w-body"></div>
    `;
      const head = win.querySelector(".w-head");
      const bodyEl = win.querySelector(".w-body");
      const btnMin = win.querySelector('[data-act="min"]');
      const btnClose = win.querySelector('[data-act="close"]');
      btnMin.addEventListener("click", () => {
        bodyEl.style.display = bodyEl.style.display === "none" ? "" : "none";
      });
      btnClose.addEventListener("click", () => {
        win.style.display = "none";
        setLaunchState(id, false);
      });
      attachDrag(head, (x, y) => {
        const maxX = window.innerWidth - win.offsetWidth - MARGIN;
        const maxY = window.innerHeight - win.offsetHeight - MARGIN;
        win.style.left = `${Math.max(MARGIN, Math.min(maxX, x))}px`;
        win.style.top = `${Math.max(MARGIN, Math.min(maxY, y))}px`;
        win.style.right = "auto";
        win.style.bottom = "auto";
      }, () => saveWinPos(id, win));
      (document.documentElement || document.body).appendChild(win);
      restoreWinPos(id, win);
      render(bodyEl);
      windows.set(id, { el: win, body: bodyEl, title });
    }
    function register(id, title, render) {
      const item = document.createElement("div");
      item.className = "glc-launch-item";
      item.dataset.id = id;
      item.innerHTML = `<div class="name">${translate(title)}</div>`;
      const openBtn = document.createElement("button");
      openBtn.className = "btn";
      openBtn.textContent = translate("Open");
      openBtn.dataset.open = "0";
      launchButtons.set(id, openBtn);
      openBtn.onclick = () => {
        const w = windows.get(id);
        if (w && w.el.style.display !== "none") {
          w.el.style.display = "none";
          setLaunchState(id, false);
        } else {
          openWindow(id, title, render);
          setLaunchState(id, true);
        }
      };
      item.appendChild(openBtn);
      launcher.appendChild(item);
      applyHideMenuSetting();
    }
    try {
      opts?.onRegister?.(register);
    } catch {
    }
    i18n.onChange?.(() => {
      launchButtons.forEach((btn) => {
        const open = btn.dataset.open === "1";
        btn.textContent = translate(open ? "Close" : "Open");
      });
    });
  }

  // src/ui/menu.ts
  var Menu = class {
    constructor(opts = {}) {
      this.opts = opts;
      // NOTE: root is public to allow ui.root.appendChild(...) from menus
      __publicField(this, "root");
      __publicField(this, "tabBar");
      __publicField(this, "views");
      __publicField(this, "tabs", /* @__PURE__ */ new Map());
      __publicField(this, "i18nUnsub");
      __publicField(this, "events", /* @__PURE__ */ new Map());
      __publicField(this, "currentId", null);
      __publicField(this, "lsKeyActive");
      __publicField(this, "menuId");
      // expose as arrow to avoid TS “missing property” complaints in consumers
      __publicField(this, "applyTranslations", (target) => {
        if (!target) return;
        try {
          i18n.applyTo?.(target);
        } catch {
        }
      });
      __publicField(this, "translateTitle", (t) => {
        try {
          return i18n.translateString?.(t) ?? t;
        } catch {
          return t;
        }
      });
      __publicField(this, "_altDown", false);
      __publicField(this, "_insertDown", false);
      __publicField(this, "_hovering", false);
      __publicField(this, "_onKey", (e) => {
        if (e.code === "Insert" || e.key === "Insert") {
          this._insertDown = e.type === "keydown";
        }
        const alt = e.altKey || this._insertDown;
        if (alt !== this._altDown) {
          this._altDown = alt;
          this._updateAltCursor();
        }
      });
      __publicField(this, "_onBlur", () => {
        this._altDown = false;
        this._insertDown = false;
        this._updateAltCursor();
      });
      __publicField(this, "_onEnter", () => {
        this._hovering = true;
        this._updateAltCursor();
      });
      __publicField(this, "_onLeave", () => {
        this._hovering = false;
        this._updateAltCursor();
      });
      this.menuId = this.opts.id || "default";
      this.lsKeyActive = `menu:${this.menuId}:activeTab`;
    }
    refreshTabLabels() {
      for (const def of this.tabs.values()) {
        if (def.btn) {
          const label = def.btn.querySelector(".label");
          if (label) label.textContent = this.translateTitle(def.title);
        }
      }
    }
    /** Monte le menu dans un conteneur */
    mount(container) {
      this.ensureStyles();
      container.innerHTML = "";
      this.root = el("div", `qmm ${this.opts.classes || ""} ${this.opts.compact ? "qmm-compact" : ""}`);
      if (this.opts.startHidden) this.root.style.display = "none";
      this.tabBar = el("div", "qmm-tabs");
      this.views = el("div", "qmm-views");
      this.root.appendChild(this.tabBar);
      this.root.appendChild(this.views);
      container.appendChild(this.root);
      if (this.tabs.size) {
        for (const [id, def] of this.tabs) this.createTabView(id, def);
        this.restoreActive();
      }
      this.updateTabsBarVisibility();
      this.root.addEventListener("pointerenter", this._onEnter);
      this.root.addEventListener("pointerleave", this._onLeave);
      window.addEventListener("keydown", this._onKey, true);
      window.addEventListener("keyup", this._onKey, true);
      window.addEventListener("blur", this._onBlur);
      document.addEventListener("visibilitychange", this._onBlur);
      if (this.opts.startWindowHidden) this.setWindowVisible(false);
      this.i18nUnsub = i18n.onChange?.(() => {
        this.refreshTabLabels();
        this.applyTranslations(this.root);
      });
      this.applyTranslations(this.root);
      this.emit("mounted");
      this.applyTranslations(this.root);
    }
    /** Unmounts the menu (optional) */
    unmount() {
      this.root?.removeEventListener("pointerenter", this._onEnter);
      this.root?.removeEventListener("pointerleave", this._onLeave);
      window.removeEventListener("keydown", this._onKey, true);
      window.removeEventListener("keyup", this._onKey, true);
      window.removeEventListener("blur", this._onBlur);
      document.removeEventListener("visibilitychange", this._onBlur);
      try {
        this.i18nUnsub?.();
      } catch {
      }
      if (this.root?.parentElement) this.root.parentElement.removeChild(this.root);
      this.emit("unmounted");
    }
    /** Returns the wrapping window element (bar - / x) */
    getWindowEl() {
      if (!this.root) return null;
      const sel = this.opts.windowSelector || ".glc-win";
      return this.root.closest(sel);
    }
    /** Show/hide the WINDOW (bar included) */
    setWindowVisible(visible) {
      const win = this.getWindowEl();
      if (!win) return;
      win.classList.toggle("is-hidden", !visible);
      this.emit(visible ? "window:show" : "window:hide");
    }
    /** Toggle window state. Returns true if now visible. */
    toggleWindow() {
      const win = this.getWindowEl();
      if (!win) return false;
      const willShow = win.classList.contains("is-hidden");
      this.setWindowVisible(willShow);
      return willShow;
    }
    /** Get current window state (true = visible) */
    isWindowVisible() {
      const win = this.getWindowEl();
      if (!win) return true;
      return !win.classList.contains("is-hidden") && getComputedStyle(win).display !== "none";
    }
    /** Affiche/masque le root */
    setVisible(visible) {
      if (!this.root) return;
      this.root.style.display = visible ? "" : "none";
      this.emit(visible ? "show" : "hide");
    }
    toggle() {
      if (!this.root) return false;
      const v = this.root.style.display === "none";
      this.setVisible(v);
      return v;
    }
    /** Add a tab (can be called before or after mount) */
    addTab(id, title, render) {
      this.tabs.set(id, { title, render, badge: null });
      if (this.root) {
        this.createTabView(id, this.tabs.get(id));
        this.updateTabsBarVisibility();
      }
      return this;
    }
    /** Add multiple tabs at once */
    addTabs(defs) {
      defs.forEach((d) => this.addTab(d.id, d.title, d.render));
      return this;
    }
    /** Update tab title (e.g. counter, label) */
    setTabTitle(id, title) {
      const def = this.tabs.get(id);
      if (!def) return;
      def.title = title;
      if (def.btn) {
        const label = def.btn.querySelector(".label");
        if (label) label.textContent = this.translateTitle(title);
      }
    }
    /** Add/remove a badge to the right of the title (e.g. "3", "NEW", "!") */
    setTabBadge(id, text) {
      const def = this.tabs.get(id);
      if (!def || !def.btn) return;
      if (!def.badge) {
        def.badge = document.createElement("span");
        def.badge.className = "badge";
        def.btn.appendChild(def.badge);
      }
      if (text == null || text === "") {
        def.badge.style.display = "none";
      } else {
        def.badge.textContent = text;
        def.badge.style.display = "";
      }
    }
    /** Force a tab re-render (re-runs its render) */
    refreshTab(id) {
      const def = this.tabs.get(id);
      if (!def?.view) return;
      const scroller = this.findScrollableAncestor(def.view);
      const st = scroller ? scroller.scrollTop : null;
      const sl = scroller ? scroller.scrollLeft : null;
      const activeId = document.activeElement?.id || null;
      def.view.innerHTML = "";
      try {
        def.render(def.view, this);
      } catch (e) {
        def.view.textContent = String(e);
      }
      this.applyTranslations(def.view);
      if (this.currentId === id) this.switchTo(id);
      this.emit("tab:render", id);
      if (scroller && st != null) {
        requestAnimationFrame(() => {
          try {
            scroller.scrollTop = st;
            scroller.scrollLeft = sl ?? 0;
          } catch {
          }
          if (activeId) {
            const n = document.getElementById(activeId);
            if (n && n.focus) try {
              n.focus();
            } catch {
            }
          }
        });
      }
    }
    findScrollableAncestor(start2) {
      function isScrollable(el3) {
        const s = getComputedStyle(el3);
        const oy = s.overflowY || s.overflow;
        return /(auto|scroll)/.test(oy) && el3.scrollHeight > el3.clientHeight;
      }
      let el2 = start2;
      while (el2) {
        if (isScrollable(el2)) return el2;
        el2 = el2.parentElement;
      }
      return document.querySelector(".glc-win");
    }
    firstTabId() {
      const it = this.tabs.keys().next();
      return it.done ? null : it.value ?? null;
    }
    _updateAltCursor() {
      if (!this.root) return;
      this.root.classList.toggle("qmm-alt-drag", this._altDown && this._hovering);
    }
    /** Get a tab DOM view (handy for targeted updates) */
    getTabView(id) {
      return this.tabs.get(id)?.view ?? null;
    }
    /** Remove a tab */
    removeTab(id) {
      const def = this.tabs.get(id);
      if (!def) return;
      this.tabs.delete(id);
      const btn = this.tabBar?.querySelector(`button[data-id="${cssq(id)}"]`);
      if (btn && btn.parentElement) btn.parentElement.removeChild(btn);
      if (def.view && def.view.parentElement) def.view.parentElement.removeChild(def.view);
      if (this.currentId === id) {
        const first = this.tabs.keys().next().value || null;
        this.switchTo(first);
      }
      this.updateTabsBarVisibility();
    }
    /** Activate a tab (id=null => show all views) */
    switchTo(id) {
      this.currentId = id;
      [...this.tabBar.children].forEach((ch) => ch.classList.toggle("active", ch.dataset.id === id || id === null));
      [...this.views.children].forEach((ch) => ch.classList.toggle("active", ch.dataset.id === id || id === null));
      this.persistActive();
      this.emit("tab:change", id);
    }
    /** Events */
    on(event, handler) {
      if (!this.events.has(event)) this.events.set(event, /* @__PURE__ */ new Set());
      this.events.get(event).add(handler);
      return () => this.off(event, handler);
    }
    off(event, handler) {
      this.events.get(event)?.delete(handler);
    }
    emit(event, ...args) {
      this.events.get(event)?.forEach((h) => {
        try {
          h(...args);
        } catch {
        }
      });
    }
    // ---------- Public UI helpers (reusable in your tabs) ----------
    btn(label, onClickOrOpts) {
      const opts = typeof onClickOrOpts === "function" ? { onClick: onClickOrOpts } : { ...onClickOrOpts || {} };
      const b = el("button", "qmm-btn");
      b.type = "button";
      let iconEl = null;
      if (opts.icon) {
        iconEl = typeof opts.icon === "string" ? document.createElement("span") : opts.icon;
        if (typeof opts.icon === "string" && iconEl) {
          iconEl.textContent = opts.icon;
        }
        if (iconEl) {
          iconEl.classList.add("qmm-btn__icon");
        }
      }
      const trimmedLabel = (label ?? "").trim();
      const shouldRenderLabel = !iconEl || trimmedLabel.length > 0;
      const labelSpan = shouldRenderLabel ? document.createElement("span") : null;
      if (labelSpan) {
        labelSpan.className = "label";
        labelSpan.textContent = label;
      }
      if (iconEl) {
        if (trimmedLabel.length === 0) {
          b.classList.add("qmm-btn--icon");
        }
        if (opts.iconPosition === "right") {
          iconEl.classList.add("is-right");
          if (labelSpan) b.append(labelSpan);
          b.append(iconEl);
        } else {
          iconEl.classList.add("is-left");
          b.append(iconEl);
          if (labelSpan) b.append(labelSpan);
        }
      } else {
        if (labelSpan) b.append(labelSpan);
      }
      const variant = opts.variant && opts.variant !== "default" ? opts.variant : null;
      if (variant) b.classList.add(`qmm-btn--${variant}`);
      if (opts.fullWidth) b.classList.add("qmm-btn--full");
      if (opts.size === "sm") b.classList.add("qmm-btn--sm");
      if (opts.active) b.classList.add("active");
      if (opts.tooltip || opts.title) b.title = opts.tooltip || opts.title || "";
      if (opts.ariaLabel) b.setAttribute("aria-label", opts.ariaLabel);
      if (opts.onClick) b.addEventListener("click", opts.onClick);
      if (opts.disabled) this.setButtonEnabled(b, false);
      b.setEnabled = (enabled) => this.setButtonEnabled(b, enabled);
      b.setActive = (active) => b.classList.toggle("active", !!active);
      return b;
    }
    setButtonEnabled(button, enabled) {
      button.disabled = !enabled;
      button.classList.toggle("is-disabled", !enabled);
      button.setAttribute("aria-disabled", (!enabled).toString());
    }
    flexRow(opts = {}) {
      const row = document.createElement("div");
      row.className = ["qmm-flex", opts.className || ""].filter(Boolean).join(" ").trim();
      row.style.display = "flex";
      row.style.alignItems = this.mapAlign(opts.align ?? "center");
      row.style.justifyContent = this.mapJustify(opts.justify ?? "start");
      row.style.gap = `${opts.gap ?? 8}px`;
      row.style.flexWrap = opts.wrap === false ? "nowrap" : "wrap";
      if (opts.fullWidth) row.style.width = "100%";
      return row;
    }
    formGrid(opts = {}) {
      const grid = document.createElement("div");
      grid.className = "qmm-form-grid";
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = opts.columns || "max-content 1fr";
      grid.style.columnGap = `${opts.columnGap ?? 8}px`;
      grid.style.rowGap = `${opts.rowGap ?? 8}px`;
      grid.style.alignItems = opts.align ? opts.align : "center";
      return grid;
    }
    formRow(labelText, control, opts = {}) {
      const wrap = document.createElement("div");
      wrap.className = "qmm-form-row";
      wrap.style.display = "grid";
      wrap.style.gridTemplateColumns = `${opts.labelWidth || "160px"} 1fr`;
      wrap.style.columnGap = `${opts.gap ?? 10}px`;
      wrap.style.alignItems = opts.alignTop ? "start" : "center";
      if (opts.wrap) wrap.classList.add("is-wrap");
      const lab = this.label(labelText);
      lab.classList.add("qmm-form-row__label");
      lab.style.margin = "0";
      lab.style.justifySelf = "start";
      if (opts.alignTop) lab.style.alignSelf = "start";
      wrap.append(lab, control);
      return { root: wrap, label: lab };
    }
    card(title, opts = {}) {
      const root = document.createElement("div");
      root.className = "qmm-card";
      root.dataset.tone = opts.tone || "default";
      if (opts.align === "center") root.classList.add("is-center");
      if (opts.align === "stretch") root.classList.add("is-stretch");
      if (opts.padding) root.style.padding = opts.padding;
      if (opts.gap != null) root.style.gap = `${opts.gap}px`;
      if (opts.maxWidth) {
        const max = typeof opts.maxWidth === "number" ? `${opts.maxWidth}px` : opts.maxWidth;
        root.style.width = `min(${max}, 100%)`;
      }
      const header = document.createElement("div");
      header.className = "qmm-card__header";
      if (opts.compactHeader) header.classList.add("is-compact");
      const titleWrap = document.createElement("div");
      titleWrap.className = "qmm-card__title";
      titleWrap.textContent = title;
      if (opts.icon) {
        const icon = typeof opts.icon === "string" ? document.createElement("span") : opts.icon;
        if (typeof opts.icon === "string" && icon) icon.textContent = opts.icon;
        if (icon) {
          icon.classList.add("qmm-card__icon");
          header.appendChild(icon);
        }
      }
      header.appendChild(titleWrap);
      if (opts.subtitle || opts.description) {
        const sub = document.createElement("div");
        sub.className = "qmm-card__subtitle";
        sub.textContent = opts.subtitle || opts.description || "";
        header.appendChild(sub);
      }
      if (opts.actions?.length) {
        const actions = document.createElement("div");
        actions.className = "qmm-card__actions";
        opts.actions.forEach((a) => actions.appendChild(a));
        header.appendChild(actions);
      }
      const body = document.createElement("div");
      body.className = "qmm-card__body";
      root.append(header, body);
      return {
        root,
        header,
        body,
        setTitle(next) {
          titleWrap.textContent = next;
        }
      };
    }
    toggleChip(labelText, opts = {}) {
      const wrap = document.createElement("label");
      wrap.className = "qmm-chip-toggle";
      if (opts.tooltip) wrap.title = opts.tooltip;
      const input = document.createElement("input");
      input.type = opts.type || "checkbox";
      if (opts.name) input.name = opts.name;
      if (opts.value) input.value = opts.value;
      input.checked = !!opts.checked;
      const face = document.createElement("div");
      face.className = "qmm-chip-toggle__face";
      if (opts.icon) {
        const icon = typeof opts.icon === "string" ? document.createElement("span") : opts.icon;
        if (typeof opts.icon === "string" && icon) icon.textContent = opts.icon;
        if (icon) {
          icon.classList.add("qmm-chip-toggle__icon");
          face.appendChild(icon);
        }
      }
      const labelEl = document.createElement("span");
      labelEl.className = "qmm-chip-toggle__label";
      labelEl.textContent = labelText;
      face.appendChild(labelEl);
      if (opts.description) {
        const desc = document.createElement("span");
        desc.className = "qmm-chip-toggle__desc";
        desc.textContent = opts.description;
        face.appendChild(desc);
      }
      if (opts.badge) {
        const badge = document.createElement("span");
        badge.className = "qmm-chip-toggle__badge";
        badge.textContent = opts.badge;
        face.appendChild(badge);
      }
      wrap.append(input, face);
      return { root: wrap, input, label: labelEl };
    }
    select(opts = {}) {
      const sel = document.createElement("select");
      sel.className = "qmm-input qmm-select";
      if (opts.id) sel.id = opts.id;
      if (opts.width) sel.style.minWidth = opts.width;
      if (opts.placeholder) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = opts.placeholder;
        opt.disabled = true;
        opt.selected = true;
        sel.appendChild(opt);
      }
      return sel;
    }
    errorBar() {
      const el2 = document.createElement("div");
      el2.className = "qmm-error";
      el2.style.display = "none";
      return {
        el: el2,
        show(message) {
          el2.textContent = message;
          el2.style.display = "block";
        },
        clear() {
          el2.textContent = "";
          el2.style.display = "none";
        }
      };
    }
    mapAlign(al) {
      if (al === "start") return "flex-start";
      if (al === "end") return "flex-end";
      if (al === "stretch") return "stretch";
      return "center";
    }
    mapJustify(j) {
      if (j === "center") return "center";
      if (j === "end") return "flex-end";
      if (j === "between") return "space-between";
      if (j === "around") return "space-around";
      return "flex-start";
    }
    label(text) {
      const l = el("label", "qmm-label");
      l.textContent = text;
      return l;
    }
    row(...children) {
      const r = el("div", "qmm-row");
      children.forEach((c) => r.appendChild(c));
      return r;
    }
    section(title) {
      const s = el("div", "qmm-section");
      s.appendChild(el("div", "qmm-section-title", escapeHtml(title)));
      return s;
    }
    inputNumber(min = 0, max = 9999, step = 1, value = 0) {
      const wrap = el("div", "qmm-input-number");
      const i = el("input", "qmm-input qmm-input-number-input");
      i.type = "number";
      i.min = String(min);
      i.max = String(max);
      i.step = String(step);
      i.value = String(value);
      i.inputMode = "numeric";
      const spin = el("div", "qmm-spin");
      const up = el("button", "qmm-step qmm-step--up", "\u25B2");
      const down = el("button", "qmm-step qmm-step--down", "\u25BC");
      up.type = down.type = "button";
      const clamp = () => {
        const n = Number(i.value);
        if (Number.isFinite(n)) {
          const lo = Number(i.min), hi = Number(i.max);
          const clamped = Math.max(lo, Math.min(hi, n));
          if (clamped !== n) i.value = String(clamped);
        }
      };
      const bump = (dir) => {
        if (dir < 0) i.stepDown();
        else i.stepUp();
        clamp();
        i.dispatchEvent(new Event("input", { bubbles: true }));
        i.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const addSpin = (btn, dir) => {
        let pressTimer = null;
        let repeatTimer = null;
        let suppressNextClick = false;
        const start2 = (ev) => {
          suppressNextClick = false;
          pressTimer = window.setTimeout(() => {
            suppressNextClick = true;
            bump(dir);
            repeatTimer = window.setInterval(() => bump(dir), 60);
          }, 300);
          btn.setPointerCapture?.(ev.pointerId);
        };
        const stop = () => {
          if (pressTimer != null) {
            clearTimeout(pressTimer);
            pressTimer = null;
          }
          if (repeatTimer != null) {
            clearInterval(repeatTimer);
            repeatTimer = null;
          }
        };
        btn.addEventListener("pointerdown", start2);
        ["pointerup", "pointercancel", "pointerleave", "blur"].forEach(
          (ev) => btn.addEventListener(ev, stop)
        );
        btn.addEventListener("click", (e) => {
          if (suppressNextClick) {
            e.preventDefault();
            e.stopPropagation();
            suppressNextClick = false;
            return;
          }
          bump(dir);
        });
      };
      addSpin(up, 1);
      addSpin(down, -1);
      i.addEventListener("change", clamp);
      spin.append(up, down);
      wrap.append(i, spin);
      i.wrap = wrap;
      return i;
    }
    inputText(placeholder = "", value = "") {
      const i = el("input", "qmm-input");
      i.type = "text";
      i.placeholder = placeholder;
      i.value = value;
      return i;
    }
    checkbox(checked = false) {
      const i = el("input", "qmm-check");
      i.type = "checkbox";
      i.checked = checked;
      return i;
    }
    radio(name, value, checked = false) {
      const i = el("input", "qmm-radio");
      i.type = "radio";
      i.name = name;
      i.value = value;
      i.checked = checked;
      return i;
    }
    slider(min = 0, max = 100, step = 1, value = 0) {
      const i = el("input", "qmm-range");
      i.type = "range";
      i.min = String(min);
      i.max = String(max);
      i.step = String(step);
      i.value = String(value);
      return i;
    }
    rangeDual(min = 0, max = 100, step = 1, valueMin = min, valueMax = max) {
      const wrap = el("div", "qmm-range-dual");
      const track = el("div", "qmm-range-dual-track");
      const fill = el("div", "qmm-range-dual-fill");
      track.appendChild(fill);
      wrap.appendChild(track);
      const createHandle = (value, extraClass) => {
        const input = this.slider(min, max, step, value);
        input.classList.add("qmm-range-dual-input", extraClass);
        wrap.appendChild(input);
        return input;
      };
      const minInput = createHandle(valueMin, "qmm-range-dual-input--min");
      const maxInput = createHandle(valueMax, "qmm-range-dual-input--max");
      const updateFill = () => {
        const minValue = Number(minInput.value);
        const maxValue = Number(maxInput.value);
        const total = max - min;
        if (!Number.isFinite(total) || total <= 0) {
          fill.style.left = "0%";
          fill.style.right = "100%";
          return;
        }
        const clampPercent = (value) => Math.max(0, Math.min(100, value));
        const start2 = (Math.min(minValue, maxValue) - min) / total * 100;
        const end = (Math.max(minValue, maxValue) - min) / total * 100;
        fill.style.left = `${clampPercent(start2)}%`;
        fill.style.right = `${clampPercent(100 - end)}%`;
      };
      minInput.addEventListener("input", updateFill);
      maxInput.addEventListener("input", updateFill);
      const handle = {
        root: wrap,
        min: minInput,
        max: maxInput,
        setValues(minValue, maxValue) {
          minInput.value = String(minValue);
          maxInput.value = String(maxValue);
          updateFill();
        },
        refresh: updateFill
      };
      handle.refresh();
      return handle;
    }
    switch(checked = false) {
      const i = this.checkbox(checked);
      i.classList.add("qmm-switch");
      return i;
    }
    // Helpers “tableau simple” pour lister les items
    table(headers, opts) {
      const wrap = document.createElement("div");
      wrap.className = "qmm-table-wrap";
      if (opts?.minimal) wrap.classList.add("qmm-table-wrap--minimal");
      const scroller = document.createElement("div");
      scroller.className = "qmm-table-scroll";
      if (opts?.maxHeight) scroller.style.maxHeight = opts.maxHeight;
      wrap.appendChild(scroller);
      const t = document.createElement("table");
      t.className = "qmm-table";
      if (opts?.minimal) t.classList.add("qmm-table--minimal");
      if (opts?.compact) t.classList.add("qmm-table--compact");
      if (opts?.fixed) t.style.tableLayout = "fixed";
      const thead = document.createElement("thead");
      const trh = document.createElement("tr");
      headers.forEach((h) => {
        const th = document.createElement("th");
        if (typeof h === "string") {
          th.textContent = h;
        } else {
          th.textContent = h.label ?? "";
          if (h.align) th.classList.add(`is-${h.align}`);
          if (h.width) th.style.width = h.width;
        }
        trh.appendChild(th);
      });
      thead.appendChild(trh);
      const tbody = document.createElement("tbody");
      t.append(thead, tbody);
      scroller.appendChild(t);
      return { root: wrap, tbody };
    }
    segmented(items, selected, onChange, opts) {
      const root = document.createElement("div");
      root.className = "qmm-seg";
      if (opts?.fullWidth) root.classList.add("qmm-seg--full");
      if (opts?.id) root.id = opts.id;
      root.setAttribute("role", "radiogroup");
      if (opts?.ariaLabel) root.setAttribute("aria-label", opts.ariaLabel);
      const rail = document.createElement("div");
      rail.className = "qmm-seg__indicator";
      root.appendChild(rail);
      const reduceMotionQuery = typeof window !== "undefined" && "matchMedia" in window ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
      const canAnimateIndicator = typeof rail.animate === "function";
      if (canAnimateIndicator) {
        rail.style.transition = "none";
      }
      let indicatorMetrics = null;
      let indicatorAnimation = null;
      const applyIndicatorStyles = (left, width) => {
        rail.style.transform = `translate3d(${left}px,0,0)`;
        rail.style.width = `${width}px`;
      };
      const cancelIndicatorAnimation = () => {
        if (!indicatorAnimation) return;
        indicatorAnimation.cancel();
        indicatorAnimation = null;
      };
      let value = selected;
      const btns = [];
      const setSelected = (v, focus = false) => {
        if (v === value) {
          if (focus) {
            const alreadyActive = btns.find((b) => b.dataset.value === v);
            alreadyActive?.focus();
          }
          onChange?.(value);
          return;
        }
        value = v;
        for (const b of btns) {
          const active = b.dataset.value === v;
          b.setAttribute("aria-checked", active ? "true" : "false");
          b.tabIndex = active ? 0 : -1;
          b.classList.toggle("active", active);
          if (active && focus) b.focus();
        }
        moveIndicator(true);
        onChange?.(value);
      };
      const moveIndicator = (animate = false) => {
        const active = btns.find((b) => b.dataset.value === value);
        if (!active) return;
        const i = btns.indexOf(active);
        const n = btns.length;
        const cs = getComputedStyle(root);
        const gap = parseFloat(cs.gap || cs.columnGap || "0") || 0;
        const bL = parseFloat(cs.borderLeftWidth || "0") || 0;
        const bR = parseFloat(cs.borderRightWidth || "0") || 0;
        const rRoot = root.getBoundingClientRect();
        const rBtn = active.getBoundingClientRect();
        let left = rBtn.left - rRoot.left - bL;
        let width = rBtn.width;
        const padW = rRoot.width - bL - bR;
        if (n === 1) {
          left = 0;
          width = padW;
        } else if (i === 0) {
          const rightEdge = left + width + gap / 2;
          left = 0;
          width = rightEdge - left;
        } else if (i === n - 1) {
          left = left - gap / 2;
          width = padW - left;
        } else {
          left = left - gap / 2;
          width = width + gap;
        }
        const dpr = window.devicePixelRatio || 1;
        const snap = (x) => Math.round(x * dpr) / dpr;
        const targetLeft = snap(left);
        const targetWidth = snap(width);
        const previous = indicatorMetrics;
        indicatorMetrics = { left: targetLeft, width: targetWidth };
        const applyFinal = () => applyIndicatorStyles(targetLeft, targetWidth);
        const shouldAnimate = animate && canAnimateIndicator && !reduceMotionQuery?.matches && previous != null && previous.width > 0 && Number.isFinite(previous.width) && targetWidth > 0 && Number.isFinite(targetWidth);
        if (!shouldAnimate) {
          cancelIndicatorAnimation();
          applyFinal();
          return;
        }
        cancelIndicatorAnimation();
        applyIndicatorStyles(previous.left, previous.width);
        indicatorAnimation = rail.animate(
          [
            {
              transform: `translate3d(${previous.left}px,0,0)`,
              width: `${previous.width}px`,
              opacity: 0.92,
              offset: 0
            },
            {
              transform: `translate3d(${targetLeft}px,0,0)`,
              width: `${targetWidth}px`,
              opacity: 1,
              offset: 1
            }
          ],
          {
            duration: 260,
            easing: "cubic-bezier(.22,.7,.28,1)",
            fill: "forwards"
          }
        );
        const finalize = () => {
          applyFinal();
          indicatorAnimation = null;
        };
        indicatorAnimation.addEventListener("finish", finalize, { once: true });
        indicatorAnimation.addEventListener("cancel", finalize, { once: true });
      };
      items.forEach(({ value: v, label, disabled }) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "qmm-seg__btn";
        b.dataset.value = String(v);
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", v === selected ? "true" : "false");
        b.tabIndex = v === selected ? 0 : -1;
        b.disabled = !!disabled;
        const labelSpan = document.createElement("span");
        labelSpan.className = "qmm-seg__btn-label";
        labelSpan.textContent = label;
        b.appendChild(labelSpan);
        b.addEventListener("click", () => {
          if (!b.disabled) setSelected(v, false);
        });
        b.addEventListener("keydown", (e) => {
          if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
          e.preventDefault();
          const idx = items.findIndex((it) => it.value === value);
          if (e.key === "Home") {
            setSelected(items[0].value, true);
            return;
          }
          if (e.key === "End") {
            setSelected(items[items.length - 1].value, true);
            return;
          }
          const dir = e.key === "ArrowRight" ? 1 : -1;
          let j = idx;
          for (let k = 0; k < items.length; k++) {
            j = (j + dir + items.length) % items.length;
            if (!items[j].disabled) {
              setSelected(items[j].value, true);
              break;
            }
          }
        });
        btns.push(b);
        root.appendChild(b);
      });
      const ro = window.ResizeObserver ? new ResizeObserver(() => moveIndicator(false)) : null;
      if (ro) ro.observe(root);
      window.addEventListener("resize", () => moveIndicator(false));
      queueMicrotask(() => moveIndicator(false));
      root.get = () => value;
      root.set = (v) => setSelected(v, false);
      return root;
    }
    radioGroup(name, options, selected, onChange) {
      const wrap = el("div", "qmm-radio-group");
      for (const { value, label } of options) {
        const r = this.radio(name, value, selected === value);
        const lab = document.createElement("label");
        lab.className = "qmm-radio-label";
        lab.appendChild(r);
        lab.appendChild(document.createTextNode(label));
        r.onchange = () => {
          if (r.checked) onChange(value);
        };
        wrap.appendChild(lab);
      }
      return wrap;
    }
    /** Bind LS: sauvegarde automatique via toStr/parse */
    bindLS(key, read, write, parse, toStr) {
      try {
        const raw = localStorage.getItem(key);
        if (raw != null) write(parse(raw));
      } catch {
      }
      return { save: () => {
        try {
          localStorage.setItem(key, toStr(read()));
        } catch {
        }
      } };
    }
    /* -------------------------- split2 helper -------------------------- */
    /** Create a 2-column layout (left/right) in CSS Grid.
     *  leftWidth: ex "200px" | "18rem" | "minmax(160px, 30%)" */
    split2(leftWidth = "260px") {
      const root = el("div", "qmm-split");
      root.style.gridTemplateColumns = "minmax(160px, max-content) 1fr";
      const left = el("div", "qmm-split-left");
      const right = el("div", "qmm-split-right");
      root.appendChild(left);
      root.appendChild(right);
      return { root, left, right };
    }
    /* -------------------------- VTabs factory -------------------------- */
    /** Create generic "vertical tabs" (selectable list + filter). */
    vtabs(options = {}) {
      return new VTabs(this, options);
    }
    hotkeyButton(initial, onChange, opts) {
      const emptyLabel = opts?.emptyLabel ?? "None";
      const listeningLabel = opts?.listeningLabel ?? "Press a key\u2026";
      const clearable = opts?.clearable ?? true;
      let hk = initial ?? null;
      let recording = false;
      if (opts?.storageKey) {
        try {
          hk = stringToHotkey(localStorage.getItem(opts.storageKey) || "") ?? initial ?? null;
        } catch {
        }
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "qmm-hotkey";
      btn.setAttribute("aria-live", "polite");
      const render = () => {
        btn.classList.toggle("is-recording", recording);
        btn.classList.toggle("is-empty", !hk);
        btn.classList.toggle("is-assigned", !recording && !!hk);
        if (recording) {
          btn.textContent = listeningLabel;
          btn.title = "Listening\u2026 press a key (Esc to cancel, Backspace to clear)";
        } else if (!hk) {
          btn.textContent = emptyLabel;
          btn.title = "No key assigned";
        } else {
          btn.textContent = hotkeyToPretty(hk);
          btn.title = "Click to rebind \u2022 Right-click to clear";
        }
      };
      const applyHotkey = (value, skipRender = false) => {
        hk = value ? { ...value } : null;
        if (!skipRender) render();
      };
      btn.refreshHotkey = (value) => {
        applyHotkey(value);
      };
      const stopRecording = (commit) => {
        recording = false;
        if (!commit) {
          render();
          return;
        }
        render();
      };
      const save = () => {
        if (opts?.storageKey) {
          const str = hotkeyToString(hk);
          try {
            if (str) localStorage.setItem(opts.storageKey, str);
            else localStorage.removeItem(opts.storageKey);
          } catch {
          }
        }
        onChange?.(hk, opts?.storageKey ? hotkeyToString(hk) : void 0);
      };
      const handleKeyDown = (e) => {
        if (!recording) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "Escape") {
          stopRecording(false);
          window.removeEventListener("keydown", handleKeyDown, true);
          return;
        }
        if ((e.key === "Backspace" || e.key === "Delete") && clearable) {
          applyHotkey(null, true);
          save();
          stopRecording(true);
          window.removeEventListener("keydown", handleKeyDown, true);
          return;
        }
        const next = eventToHotkey(e, opts?.allowModifierOnly ?? false);
        if (!next) {
          return;
        }
        applyHotkey(next, true);
        save();
        stopRecording(true);
        window.removeEventListener("keydown", handleKeyDown, true);
      };
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (!recording) {
          recording = true;
          render();
          window.addEventListener("keydown", handleKeyDown, true);
          btn.focus();
        }
      });
      if (clearable) {
        btn.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          if (hk) {
            applyHotkey(null, true);
            save();
            render();
          }
        });
      }
      render();
      return btn;
    }
    // ---------- internes ----------
    createTabView(id, def) {
      const b = document.createElement("button");
      b.className = "qmm-tab";
      b.dataset.id = id;
      b.innerHTML = `<span class="label">${escapeHtml(this.translateTitle(def.title))}</span><span class="badge" style="display:none"></span>`;
      const badgeEl = b.querySelector(".badge");
      def.btn = b;
      def.badge = badgeEl;
      b.onclick = () => this.switchTo(id);
      this.tabBar.appendChild(b);
      const view = el("div", "qmm-view");
      view.dataset.id = id;
      def.view = view;
      this.views.appendChild(view);
      try {
        def.render(view, this);
      } catch (e) {
        view.textContent = String(e);
      }
      this.applyTranslations(view);
      if (!this.currentId) this.switchTo(id);
    }
    persistActive() {
      if (!this.currentId) return;
      try {
        writeAriesPath(`menu.activeTabs.${this.menuId}`, this.currentId);
        try {
          localStorage.removeItem(this.lsKeyActive);
        } catch {
        }
      } catch {
      }
    }
    restoreActive() {
      let id = null;
      try {
        const stored = readAriesPath(`menu.activeTabs.${this.menuId}`);
        if (typeof stored === "string" && stored) id = stored;
      } catch {
      }
      try {
        id = localStorage.getItem(this.lsKeyActive);
      } catch {
      }
      if (id && this.tabs.has(id)) this.switchTo(id);
      else if (this.tabs.size) this.switchTo(this.firstTabId());
    }
    updateTabsBarVisibility() {
      if (!this.tabBar || !this.root) return;
      const hasTabs = this.tabs.size > 0;
      if (hasTabs) {
        if (!this.tabBar.parentElement) {
          this.root.insertBefore(this.tabBar, this.views);
        }
        this.tabBar.style.display = "flex";
        this.root.classList.remove("qmm-no-tabs");
      } else {
        if (this.tabBar.parentElement) {
          this.tabBar.parentElement.removeChild(this.tabBar);
        }
        this.root.classList.add("qmm-no-tabs");
      }
    }
    ensureStyles() {
      if (document.getElementById("__qmm_css__")) return;
      const css = `
    /* ================= Modern UI for qmm ================= */
.qmm{
  --qmm-bg:        #0f1318;
  --qmm-bg-soft:   #0b0f13;
  --qmm-panel:     #111823cc;
  --qmm-border:    #ffffff22;
  --qmm-border-2:  #ffffff14;
  --qmm-accent:    #7aa2ff;
  --qmm-accent-2:  #92b2ff;
  --qmm-text:      #e7eef7;
  --qmm-text-dim:  #b9c3cf;
  --qmm-shadow:    0 6px 20px rgba(0,0,0,.35);
  --qmm-blur:      8px;

  display:flex; flex-direction:column; gap:10px; color:var(--qmm-text);
}
.qmm-compact{ gap:6px }

/* ---------- Tabs (pill + underline) ---------- */
.qmm-tabs{
  display:flex; gap:6px; flex-wrap:wrap; align-items:flex-end;
  padding:0 6px 2px 6px; position:relative; isolation:isolate;
  border-bottom:1px solid var(--qmm-border);
  background:linear-gradient(180deg, rgba(255,255,255,.04), transparent);
  border-top-left-radius:10px; border-top-right-radius:10px;
}
.qmm-no-tabs .qmm-views{ margin-top:0 }

.qmm-tab{
  flex:1 1 0; min-width:0; cursor:pointer;
  display:inline-flex; justify-content:center; align-items:center; gap:8px;
  padding:8px 12px; color:var(--qmm-text);
  background:transparent; border:1px solid transparent; border-bottom:none;
  border-top-left-radius:10px; border-top-right-radius:10px;
  position:relative; margin:0; margin-bottom:-1px;
  transition:background .18s ease, color .18s ease, box-shadow .18s ease, transform .12s ease;
}
.qmm-compact .qmm-tab{ padding:6px 10px }
.qmm-tab:hover{ background:rgba(255,255,255,.06) }
.qmm-tab:active{ transform:translateY(1px) }
.qmm-tab:focus-visible{ outline:2px solid var(--qmm-accent); outline-offset:2px; border-radius:10px }

.qmm-tab .badge{
  font-size:11px; line-height:1; padding:2px 6px; border-radius:999px;
  background:#ffffff1a; border:1px solid #ffffff22;
}

.qmm-tab.active{
  background:linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.03));
  color:#fff; box-shadow:inset 0 -1px 0 #0007;
}
.qmm-tab.active::after{
  content:""; position:absolute; left:10%; right:10%; bottom:-1px; height:2px;
  background:linear-gradient(90deg, transparent, var(--qmm-accent), transparent);
  border-radius:2px; box-shadow:0 0 12px var(--qmm-accent-2);
}

/* ---------- Views panel ---------- */
.qmm-views{
  border:1px solid var(--qmm-border); border-radius:12px; padding:12px;
  background:var(--qmm-panel); backdrop-filter:blur(var(--qmm-blur));
  display:flex; flex-direction:column;
  min-width:0; min-height:0; overflow:auto; box-shadow:var(--qmm-shadow);
}
.qmm-compact .qmm-views{ padding:8px }
.qmm-tabs + .qmm-views{ margin-top:-1px }

.qmm-view{ display:none; min-width:0; min-height:0; }
.qmm-view.active{ display:block; }

/* ---------- Basic controls ---------- */
.qmm-row{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin:6px 0 }
.qmm-section{ margin-top:8px }
.qmm-section-title{ font-weight:650; margin:2px 0 8px 0; color:var(--qmm-text) }

.qmm-label{ opacity:.9 }
.qmm-val{ min-width:24px; text-align:center }

/* Buttons */
.qmm-btn{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  padding:8px 14px;
  border-radius:10px;
  border:1px solid var(--qmm-border);
  background:linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.02));
  color:var(--qmm-text);
  font-weight:600;
  font-size:13px;
  line-height:1.2;
  cursor:pointer;
  user-select:none;
  transition:background .18s ease, border-color .18s ease, transform .1s ease, box-shadow .18s ease, color .18s ease;
}
.qmm-compact .qmm-btn{ padding:6px 10px }
.qmm-btn:hover{ background:linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.04)); border-color:#ffffff3d }
.qmm-btn:active{ transform:translateY(1px) }
.qmm-btn:focus-visible{ outline:2px solid var(--qmm-accent); outline-offset:2px; }
.qmm-btn:disabled,
.qmm-btn.is-disabled{
  opacity:.55;
  cursor:not-allowed;
  filter:saturate(.6);
  box-shadow:none;
}
.qmm-btn--full{ width:100%; justify-content:center; }
.qmm-btn--sm{ padding:6px 10px; font-size:12px; border-radius:8px; }
.qmm-btn--icon{ padding:6px; width:34px; height:34px; border-radius:50%; gap:0; }
.qmm-btn__icon{ display:inline-flex; align-items:center; justify-content:center; font-size:1.1em; }
.qmm-btn__icon.is-right{ order:2; }
.qmm-btn__icon.is-left{ order:0; }

/* Button variants */
.qmm-btn--primary,
.qmm-btn.qmm-primary{
  background:linear-gradient(180deg, rgba(122,162,255,.38), rgba(122,162,255,.16));
  border-color:#9db7ff55;
  box-shadow:0 4px 14px rgba(122,162,255,.26);
}
.qmm-btn--primary:hover,
.qmm-btn.qmm-primary:hover{ border-color:#afc5ff77; }
.qmm-btn--secondary{
  background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.01));
}
.qmm-btn--danger,
.qmm-btn.qmm-danger{
  background:linear-gradient(180deg, rgba(255,86,86,.32), rgba(255,86,86,.14));
  border-color:#ff6a6a55;
  box-shadow:0 4px 14px rgba(255,86,86,.25);
}
.qmm-btn--ghost{ background:transparent; border-color:transparent; }
.qmm-btn--ghost:hover{ background:rgba(255,255,255,.06); border-color:#ffffff2a; }
.qmm-btn.active{
  background:#79a6ff22;
  border-color:#79a6ff66;
  box-shadow: inset 0 0 0 1px #79a6ff33;
}

.qmm-flex{ display:flex; flex-wrap:wrap; gap:8px; align-items:center; }

.qmm-form-grid{ width:100%; }

.qmm-form-row{ width:100%; }
.qmm-form-row.is-wrap{ grid-template-columns:1fr; }
.qmm-form-row__label{ font-weight:600; opacity:.9; }

.qmm-card{
  display:grid;
  gap:12px;
  border:1px solid var(--qmm-border);
  border-radius:12px;
  padding:14px;
  background:var(--qmm-panel);
  backdrop-filter:blur(var(--qmm-blur));
  box-shadow:var(--qmm-shadow);
  width:100%;
}
.qmm-card.is-center{ text-align:center; align-items:center; }
.qmm-card.is-stretch{ align-items:stretch; }
.qmm-card__header{
  display:flex;
  align-items:center;
  gap:10px;
  flex-wrap:wrap;
  justify-content:space-between;
}
.qmm-card__header.is-compact{ gap:6px; }
.qmm-card__icon{ font-size:18px; }
.qmm-card__title{ font-weight:700; font-size:14px; letter-spacing:.01em; }
.qmm-card__subtitle{ font-size:12px; opacity:.75; flex-basis:100%; }
.qmm-card__actions{ display:flex; gap:6px; margin-left:auto; }
.qmm-card__body{ display:grid; gap:10px; }
.qmm-card[data-tone="muted"]{
  background:rgba(15,17,22,.88);
  border-color:#ffffff1a;
  box-shadow:none;
}
.qmm-card[data-tone="accent"]{
  border-color:#7aa2ff99;
  box-shadow:0 10px 26px rgba(122,162,255,.25);
}

.qmm .stats-collapse-toggle{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  padding:6px 12px;
  min-height:32px;
  border-radius:999px;
  border:1px solid rgba(122,162,255,.45);
  background:linear-gradient(135deg, rgba(122,162,255,.18), rgba(33,59,121,.18));
  color:rgba(220,230,255,.92);
  font-size:12px;
  font-weight:600;
  letter-spacing:.01em;
  text-transform:uppercase;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.12), 0 10px 24px rgba(9,13,27,.28);
  transition:background .26s ease, border-color .26s ease, box-shadow .26s ease, color .26s ease, transform .16s ease;
}
.qmm .stats-collapse-toggle:hover{
  background:linear-gradient(135deg, rgba(122,162,255,.28), rgba(53,94,182,.24));
  border-color:rgba(122,162,255,.62);
  color:#fff;
  box-shadow:0 14px 30px rgba(66,106,201,.32), inset 0 1px 0 rgba(255,255,255,.18);
}
.qmm .stats-collapse-toggle:active{
  transform:translateY(1px) scale(.99);
}
.qmm-card--collapsible[data-collapsed="true"] .stats-collapse-toggle{
  background:linear-gradient(135deg, rgba(122,162,255,.12), rgba(23,36,78,.12));
  border-color:rgba(122,162,255,.32);
  color:rgba(208,219,255,.82);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.1), 0 6px 18px rgba(9,13,27,.22);
}
.qmm-card--collapsible[data-collapsed="false"] .stats-collapse-toggle{
  background:linear-gradient(135deg, rgba(122,162,255,.36), rgba(83,124,255,.28));
  border-color:rgba(122,162,255,.78);
  color:#fff;
  box-shadow:0 16px 32px rgba(72,112,214,.35), inset 0 1px 0 rgba(255,255,255,.22);
}
.qmm .stats-collapse-toggle__icon{
  width:16px;
  height:16px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  position:relative;
  color:inherit;
  transition:transform .24s ease;
}
.qmm .stats-collapse-toggle__icon::before{
  content:"";
  position:absolute;
  width:8px;
  height:8px;
  border-right:2px solid currentColor;
  border-bottom:2px solid currentColor;
  transform:rotate(45deg);
  transition:transform .24s ease;
}
.qmm .stats-collapse-toggle__label{
  color:inherit;
  font-size:11px;
  letter-spacing:.08em;
  font-weight:700;
}
.qmm-card--collapsible[data-collapsed="false"] .stats-collapse-toggle__icon::before{
  transform:rotate(-135deg);
}
.qmm-card--collapsible[data-collapsed="true"] .stats-collapse-toggle__icon::before{
  transform:rotate(45deg);
}

.qmm-chip-toggle{
  display:inline-flex;
  align-items:stretch;
  border-radius:999px;
  border:1px solid #ffffff1f;
  background:rgba(255,255,255,.05);
  cursor:pointer;
  transition:border-color .18s ease, background .18s ease, box-shadow .18s ease, transform .1s ease;
}
.qmm-chip-toggle input{ display:none; }
.qmm-chip-toggle__face{
  display:flex;
  align-items:center;
  gap:8px;
  padding:6px 12px;
  border-radius:999px;
}
.qmm-chip-toggle__icon{ font-size:14px; }
.qmm-chip-toggle__label{ font-weight:600; }
.qmm-chip-toggle__desc{ font-size:12px; opacity:.75; }
.qmm-chip-toggle__badge{ font-size:11px; padding:2px 6px; border-radius:999px; background:#ffffff1a; border:1px solid #ffffff22; }
.qmm-chip-toggle:hover{ border-color:#7aa2ff55; background:rgba(122,162,255,.12); }
.qmm-chip-toggle input:checked + .qmm-chip-toggle__face{
  background:linear-gradient(180deg, rgba(122,162,255,.25), rgba(122,162,255,.10));
  box-shadow:0 0 0 1px #7aa2ff55 inset, 0 6px 18px rgba(122,162,255,.22);
}

.qmm .stats-metric-grid{
  display:grid;
  gap:10px;
  grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));
}
.qmm .stats-metric{
  border-radius:12px;
  padding:12px 14px;
  background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
  border:1px solid rgba(255,255,255,.08);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08);
  display:flex;
  flex-direction:column;
  gap:6px;
  transition:border-color .18s ease, background .18s ease, transform .14s ease;
}
.qmm .stats-metric:hover{
  border-color:#7aa2ff55;
  background:linear-gradient(180deg, rgba(122,162,255,.22), rgba(122,162,255,.10));
  transform:translateY(-1px);
}
.qmm .stats-metric__label{
  font-size:12px;
  letter-spacing:.02em;
  text-transform:uppercase;
  color:var(--qmm-text-dim);
}
.qmm .stats-metric__value{
  font-size:20px;
  font-weight:700;
  color:#fff;
}

.qmm .stats-list{
  display:flex;
  flex-direction:column;
  gap:6px;
}
.qmm .stats-list__row{
  display:grid;
  align-items:center;
  gap:10px;
  padding:10px 12px;
  border-radius:10px;
  background:rgba(255,255,255,.035);
  border:1px solid rgba(255,255,255,.08);
  transition:border-color .18s ease, background .18s ease;
}
.qmm .stats-list__row:not(.stats-list__row--header):hover{
  background:rgba(122,162,255,.12);
  border-color:#7aa2ff55;
}
.qmm .stats-list__row--header{
  background:transparent;
  border:none;
  padding:0 6px 2px 6px;
  font-size:11px;
  letter-spacing:.05em;
  text-transform:uppercase;
  color:var(--qmm-text-dim);
}
.qmm .stats-list__row--header .stats-list__cell{
  font-weight:600;
}
.qmm .stats-list__header-label--gold,
.qmm .stats-list__header-label--rainbow{
  display:inline-block;
}
.qmm .stats-list__header-label--gold{
  color:#f7d774;
  background:linear-gradient(135deg,#fff5c0 0%,#f3c76a 55%,#f5b84f 100%);
  background-clip:text;
  -webkit-background-clip:text;
  -webkit-text-fill-color:transparent;
  text-shadow:0 1px 4px rgba(0,0,0,.35);
}
.qmm .stats-list__header-label--rainbow{
  color:#ffd6ff;
  background:linear-gradient(90deg,#ff6b6b 0%,#ffd86f 25%,#6bff8f 50%,#6bc7ff 75%,#b86bff 100%);
  background-clip:text;
  -webkit-background-clip:text;
  -webkit-text-fill-color:transparent;
  text-shadow:0 1px 4px rgba(0,0,0,.35);
}
.qmm .stats-list__cell{
  min-width:0;
  font-size:13px;
}
.qmm .stats-pet__species{
  display:inline-flex;
  align-items:center;
  gap:8px;
  min-width:0;
}
.qmm .stats-pet__label{
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.qmm .stats-pet__total-value{
  font-weight:700;
}
.qmm .stats-weather__name{
  display:inline-flex;
  align-items:center;
  gap:8px;
  min-width:0;
}
.qmm .stats-weather__icon{
  width:32px;
  height:32px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border-radius:6px;
  background:rgba(255,255,255,.08);
  overflow:hidden;
  flex-shrink:0;
}
.qmm .stats-weather__icon img{
  width:100%;
  height:100%;
  object-fit:contain;
  image-rendering:pixelated;
}
.qmm .stats-weather__label{
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.qmm .stats-list__cell--align-right{ text-align:right; }
.qmm .stats-list__cell--align-center{ text-align:center; }

.qmm .stats-pet-group{
  border:1px solid var(--stats-pet-group-border-color, rgba(255,255,255,.09));
  border-radius:12px;
  padding:10px 12px;
  background:rgba(255,255,255,.05);
  transition:border-color .18s ease, background .18s ease;
  display:flex;
  flex-direction:column;
  align-items:stretch;
  width:100%;
}
.qmm .stats-pet-group + .stats-pet-group{
  margin-top:8px;
}
.qmm .stats-pet-group__summary{
  display:flex;
  align-items:center;
  gap:6px;
  font-weight:650;
  font-size:13px;
  color:var(--qmm-text);
  margin:0;
  user-select:none;
  justify-content:center;
  text-align:center;
}
.qmm .stats-pet-group__content{
  margin-top:8px;
  display:flex;
  flex-direction:column;
  align-items:stretch;
  gap:8px;
}

.qmm-error{
  border:1px solid #ff6a6a55;
  background:rgba(120,20,20,.35);
  border-radius:10px;
  color:#ffdada;
  padding:10px;
  font-size:13px;
  line-height:1.4;
}

.qmm-select{
  background-image:linear-gradient(45deg, transparent 50%, #ffffff80 50%), linear-gradient(135deg, #ffffff80 50%, transparent 50%), linear-gradient(90deg, transparent 50%, rgba(255,255,255,.1) 50%);
  background-position:calc(100% - 18px) 50%, calc(100% - 13px) 50%, 100% 0;
  background-size:5px 5px, 5px 5px, 2.5rem 2.5rem;
  background-repeat:no-repeat;
  padding-right:34px;
}

.qmm-vlist-wrap{ display:flex; flex-direction:column; width:100%; }

/* Inputs */
.qmm-input{
  min-width:90px; background:rgba(0,0,0,.42); color:#fff;
  border:1px solid var(--qmm-border); border-radius:10px;
  padding:8px 10px; box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
  transition:border-color .18s ease, background .18s ease, box-shadow .18s ease;
}
.qmm-input::placeholder{ color:#cbd6e780 }
.qmm-input:focus{ outline:none; border-color:var(--qmm-accent); background:#0f1521; box-shadow:0 0 0 2px #7aa2ff33 }

/* Number input + spinner (unchanged API) */
.qmm-input-number{ display:inline-flex; align-items:center; gap:6px }
.qmm-input-number-input{ width:70px; text-align:center; padding-right:8px }
.qmm-spin{ display:inline-flex; flex-direction:column; gap:2px }
.qmm-step{
  width:22px; height:16px; font-size:11px; line-height:1;
  display:inline-flex; align-items:center; justify-content:center;
  border-radius:6px; border:1px solid var(--qmm-border);
  background:rgba(255,255,255,.08); color:#fff; cursor:pointer; user-select:none;
  transition:background .18s ease, border-color .18s ease, transform .08s ease;
}
.qmm-step:hover{ background:#ffffff18; border-color:#ffffff40 }
.qmm-step:active{ transform:translateY(1px) }

/* Switch (checkbox) */
.qmm-switch{
  appearance:none; width:42px; height:24px; background:#6c7488aa; border-radius:999px;
  position:relative; outline:none; cursor:pointer; transition:background .18s ease, box-shadow .18s ease;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.12);
}
.qmm-switch::before{
  content:""; position:absolute; top:2px; left:2px; width:20px; height:20px;
  background:#fff; border-radius:50%; transition:transform .2s ease;
  box-shadow:0 2px 8px rgba(0,0,0,.35);
}
.qmm-switch:checked{ background:linear-gradient(180deg, rgba(122,162,255,.9), rgba(122,162,255,.6)) }
.qmm-switch:checked::before{ transform:translateX(18px) }
.qmm-switch:focus-visible{ outline:2px solid var(--qmm-accent); outline-offset:2px }

/* Checkbox & radio (native inputs skinned lightly) */
.qmm-check, .qmm-radio{ transform:scale(1.1); accent-color: var(--qmm-accent) }

/* Slider */
.qmm-range{
  width:180px; appearance:none; background:transparent; height:22px;
}
.qmm-range:focus{ outline:none }
.qmm-range::-webkit-slider-runnable-track{
  height:6px; background:linear-gradient(90deg, var(--qmm-accent), #7aa2ff44);
  border-radius:999px; box-shadow:inset 0 1px 0 rgba(255,255,255,.14);
}
.qmm-range::-moz-range-track{
  height:6px; background:linear-gradient(90deg, var(--qmm-accent), #7aa2ff44);
  border-radius:999px; box-shadow:inset 0 1px 0 rgba(255,255,255,.14);
}
.qmm-range::-webkit-slider-thumb{
  appearance:none; width:16px; height:16px; border-radius:50%; margin-top:-5px;
  background:#fff; box-shadow:0 2px 10px rgba(0,0,0,.35), 0 0 0 2px #ffffff66 inset;
  transition:transform .1s ease;
}
.qmm-range:active::-webkit-slider-thumb{ transform:scale(1.04) }
.qmm-range::-moz-range-thumb{
  width:16px; height:16px; border-radius:50%; background:#fff; border:none;
  box-shadow:0 2px 10px rgba(0,0,0,.35), 0 0 0 2px #ffffff66 inset;
}

.qmm-range-dual{
  position:relative;
  width:100%;
  padding:18px 0 10px;
}
.qmm-range-dual-track{
  position:absolute;
  left:0;
  right:0;
  top:50%;
  transform:translateY(-50%);
  height:8px;
  border-radius:999px;
  background:linear-gradient(90deg, rgba(8,19,33,.8), rgba(27,43,68,.9));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08), inset 0 0 0 1px rgba(118,156,255,.08);
}
.qmm-range-dual-fill{
  position:absolute;
  top:50%;
  transform:translateY(-50%);
  height:8px;
  border-radius:999px;
  background:linear-gradient(90deg, var(--qmm-accent), #7aa2ff99);
  box-shadow:0 4px 14px rgba(37,92,255,.3);
  transition:left .12s ease, right .12s ease;
}
.qmm-range-dual-input{
  position:absolute;
  left:0;
  right:0;
  top:50%;
  transform:translateY(-50%);
  width:100%;
  height:28px;
  margin:0;
  background:transparent;
  pointer-events:none;
}
.qmm-range-dual-input::-webkit-slider-runnable-track{ background:none; }
.qmm-range-dual-input::-moz-range-track{ background:none; }
.qmm-range-dual-input::-webkit-slider-thumb{
  pointer-events:auto;
  width:18px;
  height:18px;
  border-radius:50%;
  background:linear-gradient(145deg, #fff, #dce6ff);
  border:2px solid rgba(122,162,255,.8);
  box-shadow:0 4px 12px rgba(0,0,0,.35);
  transition:transform .12s ease, box-shadow .12s ease;
}
.qmm-range-dual-input:active::-webkit-slider-thumb,
.qmm-range-dual-input:focus-visible::-webkit-slider-thumb{
  transform:scale(1.05);
  box-shadow:0 6px 16px rgba(0,0,0,.4);
}
.qmm-range-dual-input::-moz-range-thumb{
  pointer-events:auto;
  width:18px;
  height:18px;
  border-radius:50%;
  background:linear-gradient(145deg, #fff, #dce6ff);
  border:2px solid rgba(122,162,255,.8);
  box-shadow:0 4px 12px rgba(0,0,0,.35);
  transition:transform .12s ease, box-shadow .12s ease;
}
.qmm-range-dual-input:active::-moz-range-thumb,
.qmm-range-dual-input:focus-visible::-moz-range-thumb{
  transform:scale(1.05);
  box-shadow:0 6px 16px rgba(0,0,0,.4);
}
.qmm-range-dual-input--min{ z-index:2; }
.qmm-range-dual-input--max{ z-index:3; }
.qmm-range-dual-bubble{
  position:absolute;
  top:14px;
  transform:translate(-50%, -100%);
  padding:4px 8px;
  border-radius:6px;
  font-size:11px;
  line-height:1;
  font-weight:600;
  color:#dbe6ff;
  background:rgba(17,28,46,.9);
  box-shadow:0 4px 14px rgba(0,0,0,.35);
  pointer-events:none;
  transition:opacity .12s ease, transform .12s ease;
  opacity:.85;
}
.qmm-range-dual-bubble::after{
  content:"";
  position:absolute;
  left:50%;
  bottom:-4px;
  width:8px;
  height:8px;
  background:inherit;
  transform:translateX(-50%) rotate(45deg);
  border-radius:2px;
  box-shadow:0 4px 14px rgba(0,0,0,.35);
}
.qmm-range-dual-input--min:focus-visible + .qmm-range-dual-bubble--min,
.qmm-range-dual-input--max:focus-visible + .qmm-range-dual-bubble--max,
.qmm-range-dual-input--min:active + .qmm-range-dual-bubble--min,
.qmm-range-dual-input--max:active + .qmm-range-dual-bubble--max{
  opacity:1;
  transform:translate(-50%, -110%) scale(1.02);
}

/* ---------- Minimal table ---------- */
/* container */
.qmm-table-wrap--minimal{
  border:1px solid #263040; border-radius:8px; background:#0b0f14; box-shadow:none;
}
/* scroller (height cap) */
.qmm-table-scroll{
  overflow:auto; max-height:44vh; /* override via opts.maxHeight */
}

/* base */
.qmm-table--minimal{
  width:100%;
  border-collapse:collapse;
  background:transparent;
  font-size:13px; line-height:1.35; color:var(--qmm-text, #cdd6e3);
}

/* header */
.qmm-table--minimal thead th{
  position:sticky; top:0; z-index:1;
  text-align:left; font-weight:600;
  padding:8px 10px;
  color:#cbd5e1; background:#0f1318;
  border-bottom:1px solid #263040;
  text-transform:none; letter-spacing:0;
}
.qmm-table--minimal thead th.is-center { text-align: center; }
.qmm-table--minimal thead th.is-left   { text-align: left; }   /* already present, ok */
.qmm-table--minimal thead th.is-right  { text-align: right; }
.qmm-table--minimal thead th,
.qmm-table--minimal td { vertical-align: middle; }

/* cells */
.qmm-table--minimal td{
  padding:8px 10px; border-bottom:1px solid #1f2937; vertical-align:middle;
}
.qmm-table--minimal tbody tr:hover{ background:#0f1824; }

/* compact variant */
.qmm-table--compact thead th,
.qmm-table--compact td{ padding:6px 8px; font-size:12px }

/* utils */
.qmm-table--minimal td.is-num{ text-align:right; font-variant-numeric:tabular-nums }
.qmm-table--minimal td.is-center{ text-align:center }
.qmm-ellipsis{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.qmm-prewrap{ white-space:pre-wrap; word-break:break-word }


/* ---------- Split panels ---------- */
.qmm-split{
  display:grid; gap:12px;
  grid-template-columns:minmax(180px,260px) minmax(0,1fr);
  align-items:start;
}
.qmm-split-left{ display:flex; flex-direction:column; gap:10px }
.qmm-split-right{
  border:1px solid var(--qmm-border); border-radius:12px; padding:12px;
  display:flex; flex-direction:column; gap:12px;
  background:var(--qmm-panel); backdrop-filter:blur(var(--qmm-blur));
  box-shadow:var(--qmm-shadow);
}

/* ---------- VTabs (vertical list + filter) ---------- */
.qmm-vtabs{ display:flex; flex-direction:column; gap:8px; min-width:0 }
.qmm-vtabs .filter{ display:block }
.qmm-vtabs .filter input{ width:100% }

.qmm-vlist{
  flex:0 0 auto; overflow:visible;
  border:1px solid var(--qmm-border); border-radius:12px; padding:6px;
  background:linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.04);
}

.qmm-vtab{
  width:100%; text-align:left; cursor:pointer;
  display:grid; grid-template-columns:28px 1fr auto; align-items:center; gap:10px;
  padding:8px 10px; border-radius:10px; border:1px solid #ffffff18;
  background:rgba(255,255,255,.03); color:inherit;
  transition:background .18s ease, border-color .18s ease, transform .08s ease;
}
.qmm-vtab:hover{ background:rgba(255,255,255,.07); border-color:#ffffff34 }
.qmm-vtab:active{ transform:translateY(1px) }
.qmm-vtab.active{
  background:linear-gradient(180deg, rgba(122,162,255,.18), rgba(122,162,255,.08));
  border-color:#9db7ff55;
  box-shadow:0 1px 14px rgba(122,162,255,.18) inset;
}

.qmm-dot{ width:10px; height:10px; border-radius:50%; justify-self:center; box-shadow:0 0 0 1px #0006 inset }
.qmm-chip{ display:flex; align-items:center; gap:8px; min-width:0 }
.qmm-chip img{
  width:20px; height:20px; border-radius:50%; object-fit:cover; border:1px solid #4446;
  box-shadow:0 1px 0 rgba(255,255,255,.08) inset;
}
.qmm-chip .t{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.qmm-tag{
  font-size:11px; line-height:1; padding:3px 7px; border-radius:999px;
  background:#ffffff14; border:1px solid #ffffff26;
}

/* ---------- Small helpers (optional) ---------- */
.qmm .qmm-card{
  border:1px solid var(--qmm-border); border-radius:12px; padding:12px;
  background:var(--qmm-panel); backdrop-filter:blur(var(--qmm-blur)); box-shadow:var(--qmm-shadow);
}
  .qmm .qmm-help{ font-size:12px; color:var(--qmm-text-dim) }
  .qmm .qmm-sep{ height:1px; background:var(--qmm-border); width:100%; opacity:.6; }

/* drag handle */
.qmm-grab {
  margin-left:auto; opacity:.8; cursor:grab; user-select:none;
  display:grid; grid-template-columns:repeat(2, 3px); grid-template-rows:repeat(3, 3px);
  gap:2px; padding:4px 3px; align-content:center; justify-content:center;
}
.qmm-grab:active { cursor:grabbing; }
.qmm-grab-dot {
  width:3px; height:3px; border-radius:999px;
  background:rgba(255,255,255,.82); box-shadow:0 0 0 1px #0005 inset;
}
.qmm-dragging { opacity:.6; }

/* items animables */
.qmm-team-item {
  will-change: transform;
  transition: transform 160ms ease;
}
.qmm-team-item.drag-ghost {
  opacity: .4;
}

.qmm.qmm-alt-drag { cursor: grab; }
.qmm.qmm-alt-drag:active { cursor: grabbing; }

.glc-win.is-hidden { display: none !important; }

.qmm-hotkey{
  cursor:pointer; user-select:none;
  border:1px solid var(--qmm-border); border-radius:10px;
  padding:8px 12px;
  background:linear-gradient(180deg, #ffffff10, #ffffff06);
  color:var(--qmm-text);
  box-shadow:0 1px 0 #000 inset, 0 1px 16px rgba(0,0,0,.18);
  transition:
    background .18s ease,
    border-color .18s ease,
    box-shadow .18s ease,
    transform .08s ease,
    color .18s ease;
}
.qmm-hotkey{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  white-space:nowrap;
  width: var(--qmm-hotkey-w, 180px); 
}
.qmm-hotkey:hover{ background:linear-gradient(180deg, #ffffff16, #ffffff08); border-color:#ffffff40 }
.qmm-hotkey:active{ transform:translateY(1px) }

.qmm-hotkey:focus-visible{ outline:none }

.qmm-hotkey.is-empty{
  color:var(--qmm-text-dim);
  font-style:italic;
}

.qmm-hotkey.is-assigned{
  border-color: rgba(122,162,255,.45);
  box-shadow:0 1px 0 #000 inset, 0 1px 16px rgba(0,0,0,.18), 0 0 0 2px rgba(122,162,255,.24);
}

.qmm-hotkey.is-recording{
  outline:2px solid var(--qmm-accent);
  outline-offset:2px;
  border-color: var(--qmm-accent);
  background:linear-gradient(180deg, rgba(122,162,255,.25), rgba(122,162,255,.10));
  animation: qmm-hotkey-breathe 1.2s ease-in-out infinite;
}
  
@keyframes qmm-hotkey-breathe{
  0%   { box-shadow: 0 0 0 0 rgba(122,162,255,.55), 0 1px 16px rgba(0,0,0,.25); }
  60%  { box-shadow: 0 0 0 12px rgba(122,162,255,0), 0 1px 16px rgba(0,0,0,.25); }
  100% { box-shadow: 0 0 0 0 rgba(122,162,255,0),  0 1px 16px rgba(0,0,0,.25); }
}

/* ---------- Segmented (minimal, modern) ---------- */
.qmm-seg{
  --seg-pad: 8px;
  --seg-radius: 999px;
  --seg-stroke: 1.2px;      /* stroke thickness */
  --seg-nudge-x: 0px;       /* micro-ajustements optionnels */
  --seg-nudge-w: 0px;
  --seg-fill: rgba(122,162,255,.05);           
  --seg-stroke-color: rgba(122,162,255,.60);

  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: var(--seg-pad);
  border-radius: var(--seg-radius);
  background: var(--qmm-bg-soft);
  border: 1px solid var(--qmm-border-2);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
  overflow: hidden;
  background-clip: padding-box; /* important pour que le fond ne passe pas sous la bordure */
}

.qmm-seg--full{ display:flex; width:100% }

.qmm-seg__btn{
  position: relative;
  z-index: 1;
  appearance: none; background: transparent; border: 0; cursor: pointer;
  padding: 8px 14px;
  border-radius: 999px;
  color: var(--qmm-text-dim);
  font: inherit; line-height: 1; white-space: nowrap;
  transition: color .15s ease, transform .06s ease;
}
.qmm-seg__btn-label{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: inherit;
}
.qmm-compact .qmm-seg__btn{ padding: 6px 10px }
.qmm-seg__btn:hover{ color: var(--qmm-text); }
.qmm-seg__btn.active{ color:#fff; font-weight:600; }
.qmm-seg__btn:active{ transform: translateY(1px); }
.qmm-seg__btn[disabled]{ opacity:.5; cursor:not-allowed; }

.qmm-seg__indicator{
  position: absolute;
  top: 0; left: 0;
  height: 100%;
  width: 40px;                      /* maj en JS */
  border-radius: inherit;
  background: var(--seg-fill);              /* \u2B05\uFE0F applique la couleur */
  outline: var(--seg-stroke,1.2px) solid var(--seg-stroke-color);
  outline-offset: calc(-1 * var(--seg-stroke));

  box-shadow: 0 1px 4px rgba(122,162,255,.10);
  transform-origin: left center;
  will-change: transform, width, opacity;
  transition: transform .18s cubic-bezier(.2,.8,.2,1),
              width .18s cubic-bezier(.2,.8,.2,1),
              opacity .18s ease-out;
  pointer-events: none;
}

/* Accessibility */
@media (prefers-reduced-motion: reduce){
  .qmm-seg__indicator, .qmm-seg__btn { transition: none; }
}  /* \u2190 manquait cette accolade */

    `;
      const st = document.createElement("style");
      st.id = "__qmm_css__";
      st.textContent = css;
      (document.documentElement || document.body).appendChild(st);
    }
  };
  var VTabs = class {
    constructor(api, opts = {}) {
      this.api = api;
      this.opts = opts;
      __publicField(this, "root");
      __publicField(this, "filterWrap", null);
      __publicField(this, "filterInput", null);
      __publicField(this, "list");
      __publicField(this, "listWrap", null);
      __publicField(this, "items", []);
      __publicField(this, "selectedId", null);
      __publicField(this, "onSelectCb");
      __publicField(this, "renderItemCustom");
      __publicField(this, "emptyText");
      this.root = el("div", "qmm-vtabs");
      this.root.style.minWidth = "0";
      this.emptyText = opts.emptyText || "Aucun \xE9l\xE9ment.";
      this.renderItemCustom = opts.renderItem;
      if (opts.filterPlaceholder) {
        this.filterWrap = el("div", "filter");
        this.filterInput = document.createElement("input");
        this.filterInput.type = "search";
        this.filterInput.placeholder = opts.filterPlaceholder;
        this.filterInput.className = "qmm-input";
        this.filterInput.oninput = () => this.renderList();
        this.filterWrap.appendChild(this.filterInput);
        this.root.appendChild(this.filterWrap);
      }
      this.list = el("div", "qmm-vlist");
      this.list.style.minWidth = "0";
      if (opts.maxHeightPx) {
        this.list.style.maxHeight = `${opts.maxHeightPx}px`;
        this.list.style.overflow = "auto";
        this.list.style.flex = "1 1 auto";
      }
      if (opts.fillAvailableHeight) {
        this.listWrap = document.createElement("div");
        this.listWrap.className = "qmm-vlist-wrap";
        Object.assign(this.listWrap.style, {
          flex: "1 1 auto",
          minHeight: "0",
          display: "flex",
          flexDirection: "column"
        });
        this.list.style.flex = "1 1 auto";
        if (!opts.maxHeightPx) this.list.style.overflow = "auto";
        this.listWrap.appendChild(this.list);
        this.root.appendChild(this.listWrap);
      } else {
        this.root.appendChild(this.list);
      }
      this.selectedId = opts.initialId ?? null;
      this.onSelectCb = opts.onSelect;
    }
    setItems(items) {
      this.items = Array.isArray(items) ? items.slice() : [];
      if (this.selectedId && !this.items.some((i) => i.id === this.selectedId)) {
        this.selectedId = this.items[0]?.id ?? null;
      }
      this.renderList();
    }
    getSelected() {
      return this.items.find((i) => i.id === this.selectedId) ?? null;
    }
    select(id) {
      this.selectedId = id;
      this.renderList();
      this.onSelectCb?.(this.selectedId, this.getSelected());
    }
    onSelect(cb) {
      this.onSelectCb = cb;
    }
    setBadge(id, text) {
      const btn = this.list.querySelector(`button[data-id="${cssq(id)}"]`);
      if (!btn) return;
      let tag = btn.querySelector(".qmm-tag");
      if (!tag && text != null) {
        tag = el("span", "qmm-tag");
        btn.appendChild(tag);
      }
      if (!tag) return;
      if (text == null || text === "") tag.style.display = "none";
      else {
        tag.textContent = text;
        tag.style.display = "";
      }
    }
    getFilter() {
      return (this.filterInput?.value || "").trim().toLowerCase();
    }
    renderList() {
      const keepScroll = this.list.scrollTop;
      this.list.innerHTML = "";
      const q = this.getFilter();
      const filtered = q ? this.items.filter((it) => (it.title || "").toLowerCase().includes(q) || (it.subtitle || "").toLowerCase().includes(q)) : this.items;
      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.style.opacity = "0.75";
        empty.textContent = this.emptyText;
        this.list.appendChild(empty);
        return;
      }
      const ul = document.createElement("ul");
      ul.style.listStyle = "none";
      ul.style.margin = "0";
      ul.style.padding = "0";
      ul.style.display = "flex";
      ul.style.flexDirection = "column";
      ul.style.gap = "4px";
      for (const it of filtered) {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.className = "qmm-vtab";
        btn.dataset.id = it.id;
        btn.disabled = !!it.disabled;
        if (this.renderItemCustom) {
          this.renderItemCustom(it, btn);
        } else {
          const dot = el("div", "qmm-dot");
          dot.style.background = it.statusColor || "#999a";
          const chip = el("div", "qmm-chip");
          const img = document.createElement("img");
          img.src = it.avatarUrl || "";
          img.alt = it.title;
          const wrap = document.createElement("div");
          wrap.style.display = "flex";
          wrap.style.flexDirection = "column";
          wrap.style.gap = "2px";
          const t = el("div", "t");
          t.textContent = it.title;
          const sub = document.createElement("div");
          sub.textContent = it.subtitle || "";
          sub.style.opacity = "0.7";
          sub.style.fontSize = "12px";
          if (!it.subtitle) sub.style.display = "none";
          wrap.appendChild(t);
          wrap.appendChild(sub);
          chip.appendChild(img);
          chip.appendChild(wrap);
          btn.appendChild(dot);
          btn.appendChild(chip);
          if (it.badge != null) {
            const tag = el("span", "qmm-tag", escapeHtml(String(it.badge)));
            btn.appendChild(tag);
          } else {
            const spacer = document.createElement("div");
            spacer.style.width = "0";
            btn.appendChild(spacer);
          }
        }
        btn.classList.toggle("active", it.id === this.selectedId);
        btn.onclick = () => this.select(it.id);
        li.appendChild(btn);
        ul.appendChild(li);
      }
      this.list.appendChild(ul);
      this.list.scrollTop = keepScroll;
    }
  };
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function cssq(s) {
    return s.replace(/"/g, '\\"');
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]);
  }
  var _MOD_CODES = /* @__PURE__ */ new Set([
    "ShiftLeft",
    "ShiftRight",
    "ControlLeft",
    "ControlRight",
    "AltLeft",
    "AltRight",
    "MetaLeft",
    "MetaRight"
  ]);
  function codesMatch(expected, actual) {
    if (expected === actual) return true;
    const altCodes = expected === "AltLeft" || expected === "AltRight";
    const ctrlCodes = expected === "ControlLeft" || expected === "ControlRight";
    const shiftCodes = expected === "ShiftLeft" || expected === "ShiftRight";
    const metaCodes = expected === "MetaLeft" || expected === "MetaRight";
    if (altCodes && (actual === "AltLeft" || actual === "AltRight")) return true;
    if (ctrlCodes && (actual === "ControlLeft" || actual === "ControlRight")) return true;
    if (shiftCodes && (actual === "ShiftLeft" || actual === "ShiftRight")) return true;
    if (metaCodes && (actual === "MetaLeft" || actual === "MetaRight")) return true;
    return false;
  }
  function isMac() {
    return navigator.platform?.toLowerCase().includes("mac") || /mac|iphone|ipad|ipod/i.test(navigator.userAgent);
  }
  function eventToHotkey(e, allowModifierOnly = false) {
    const isModifier = _MOD_CODES.has(e.code) || e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta";
    if (isModifier && !allowModifierOnly) {
      return null;
    }
    return {
      code: e.code,
      ctrl: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
      meta: e.metaKey
    };
  }
  function matchHotkey(e, h) {
    if (!h) return false;
    if (!!h.ctrl !== e.ctrlKey) return false;
    if (!!h.shift !== e.shiftKey) return false;
    if (!!h.alt !== e.altKey) return false;
    if (!!h.meta !== e.metaKey) return false;
    return codesMatch(h.code, e.code);
  }
  function hotkeyToString(hk) {
    if (!hk) return "";
    const parts = [];
    if (hk.ctrl) parts.push("Ctrl");
    if (hk.shift) parts.push("Shift");
    if (hk.alt) parts.push("Alt");
    if (hk.meta) parts.push("Meta");
    if (hk.code) parts.push(hk.code);
    return parts.join("+");
  }
  function stringToHotkey(s) {
    if (!s) return null;
    const parts = s.split("+").map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return null;
    const code = canonicalizeCode(parts.pop() || "");
    const hk = { code };
    for (const p of parts) {
      const P = p.toLowerCase();
      if (P === "ctrl" || P === "control") hk.ctrl = true;
      else if (P === "shift") hk.shift = true;
      else if (P === "alt") hk.alt = true;
      else if (P === "meta" || P === "cmd" || P === "command") hk.meta = true;
    }
    return hk.code ? hk : null;
  }
  var CANONICAL_CODES = {
    space: "Space",
    enter: "Enter",
    escape: "Escape",
    tab: "Tab",
    backspace: "Backspace",
    delete: "Delete",
    insert: "Insert",
    home: "Home",
    end: "End",
    pageup: "PageUp",
    pagedown: "PageDown",
    arrowup: "ArrowUp",
    arrowdown: "ArrowDown",
    arrowleft: "ArrowLeft",
    arrowright: "ArrowRight",
    bracketleft: "BracketLeft",
    bracketright: "BracketRight",
    backslash: "Backslash",
    slash: "Slash",
    minus: "Minus",
    equal: "Equal",
    semicolon: "Semicolon",
    quote: "Quote",
    backquote: "Backquote",
    comma: "Comma",
    period: "Period",
    dot: "Period",
    capslock: "CapsLock",
    numlock: "NumLock",
    scrolllock: "ScrollLock",
    pause: "Pause",
    contextmenu: "ContextMenu",
    printscreen: "PrintScreen",
    metaleft: "MetaLeft",
    metaright: "MetaRight",
    altleft: "AltLeft",
    altright: "AltRight",
    controlleft: "ControlLeft",
    controlright: "ControlRight",
    shiftleft: "ShiftLeft",
    shiftright: "ShiftRight"
  };
  function canonicalizeCode(rawCode) {
    const trimmed = rawCode.trim();
    if (!trimmed) return "";
    const lower = trimmed.toLowerCase();
    const keyMatch = lower.match(/^key([a-z])$/);
    if (keyMatch) return `Key${keyMatch[1].toUpperCase()}`;
    const digitMatch = lower.match(/^digit([0-9])$/);
    if (digitMatch) return `Digit${digitMatch[1]}`;
    const numpadDigitMatch = lower.match(/^numpad([0-9])$/);
    if (numpadDigitMatch) return `Numpad${numpadDigitMatch[1]}`;
    if (lower.startsWith("numpad")) {
      const suffix = lower.slice(6);
      if (!suffix) return "Numpad";
      const mappedSuffix = CANONICAL_CODES[suffix] ?? capitalizeWord(suffix);
      return `Numpad${mappedSuffix}`;
    }
    const fMatch = lower.match(/^f([0-9]{1,2})$/);
    if (fMatch) return `F${fMatch[1]}`;
    const arrowMatch = lower.match(/^arrow([a-z]+)$/);
    if (arrowMatch) {
      const suffix = arrowMatch[1];
      const mappedSuffix = CANONICAL_CODES[suffix] ?? capitalizeWord(suffix);
      return `Arrow${mappedSuffix}`;
    }
    if (CANONICAL_CODES[lower]) {
      return CANONICAL_CODES[lower];
    }
    return trimmed[0].toUpperCase() + trimmed.slice(1);
  }
  function capitalizeWord(word) {
    if (!word) return "";
    return word[0].toUpperCase() + word.slice(1);
  }
  function prettyCode(code) {
    if (code === "AltLeft" || code === "AltRight") return "Alt";
    if (code === "ControlLeft" || code === "ControlRight") return "Ctrl";
    if (code === "ShiftLeft" || code === "ShiftRight") return "Shift";
    if (code === "MetaLeft" || code === "MetaRight") return isMac() ? "\u2318" : "Meta";
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    if (code.startsWith("Numpad")) return "Numpad " + code.slice(6);
    const arrows = { ArrowUp: "\u2191", ArrowDown: "\u2193", ArrowLeft: "\u2190", ArrowRight: "\u2192" };
    if (arrows[code]) return arrows[code];
    return code;
  }
  function hotkeyToPretty(h) {
    if (!h) return "\u2014";
    const mac = isMac();
    const mods = [];
    if (mac) {
      if (h.ctrl) mods.push("\u2303");
      if (h.alt) mods.push("\u2325");
      if (h.shift) mods.push("\u21E7");
      if (h.meta) mods.push("\u2318");
    } else {
      if (h.ctrl) mods.push("Ctrl");
      if (h.alt) mods.push("Alt");
      if (h.shift) mods.push("Shift");
      if (h.meta) mods.push("Meta");
    }
    const modifierCode = h.alt && (h.code === "AltLeft" || h.code === "AltRight") || h.ctrl && (h.code === "ControlLeft" || h.code === "ControlRight") || h.shift && (h.code === "ShiftLeft" || h.code === "ShiftRight") || h.meta && (h.code === "MetaLeft" || h.code === "MetaRight");
    const parts = mods.slice();
    const codePretty = prettyCode(h.code);
    if (!modifierCode || parts.length === 0) {
      parts.push(codePretty);
    }
    if (!parts.length) return codePretty;
    return parts.join(mac ? "" : " + ");
  }

  // src/services/keybinds.ts
  var DEFAULT_KEYBINDS = {
    "gui.toggle-layout-creator": { code: "KeyL" }
  };
  var listeners2 = /* @__PURE__ */ new Map();
  function readKeybindMap() {
    return readAriesPath("keybinds.bindings") || {};
  }
  function writeKeybindMap(next) {
    updateAriesPath("keybinds.bindings", next);
  }
  function getKeybind(id) {
    const map = readKeybindMap();
    if (map[id]) return stringToHotkey(map[id]);
    return DEFAULT_KEYBINDS[id] ?? null;
  }
  function setKeybind(id, hk) {
    const map = readKeybindMap();
    if (hk) {
      map[id] = hotkeyToString(hk);
    } else {
      delete map[id];
    }
    writeKeybindMap(map);
    listeners2.get(id)?.forEach((cb) => cb(getKeybind(id)));
  }
  function onKeybindChange(id, cb) {
    const set2 = listeners2.get(id) ?? /* @__PURE__ */ new Set();
    set2.add(cb);
    listeners2.set(id, set2);
    return () => {
      set2.delete(cb);
    };
  }
  function eventMatchesKeybind(id, ev) {
    const hk = getKeybind(id);
    return !!hk && matchHotkey(ev, hk);
  }

  // src/store/jotai.ts
  var _store = null;
  var _captureInProgress = false;
  var _captureError = null;
  var _lastCapturedVia = null;
  var _warnedWriteOnceTimeout = false;
  var _retryListenersInstalled = false;
  var getAtomCache = () => pageWindow.jotaiAtomCache?.cache;
  function findStoreViaFiber() {
    const hook = pageWindow.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook?.renderers?.size) return null;
    for (const [rid] of hook.renderers) {
      const roots = hook.getFiberRoots?.(rid);
      if (!roots) continue;
      for (const root of roots) {
        const seen = /* @__PURE__ */ new Set();
        const stack = [root.current];
        while (stack.length) {
          const f = stack.pop();
          if (!f || seen.has(f)) continue;
          seen.add(f);
          const v = f?.pendingProps?.value;
          if (v && typeof v.get === "function" && typeof v.set === "function" && typeof v.sub === "function") {
            _lastCapturedVia = "fiber";
            return v;
          }
          if (f.child) stack.push(f.child);
          if (f.sibling) stack.push(f.sibling);
          if (f.alternate) stack.push(f.alternate);
        }
      }
    }
    return null;
  }
  async function captureViaWriteOnce(timeoutMs = 5e3, allowReschedule = true) {
    const cache = getAtomCache();
    if (!cache) {
      console.warn("[GLC jotai-bridge] jotaiAtomCache.cache introuvable");
      throw new Error("jotaiAtomCache.cache introuvable");
    }
    let capturedGet = null;
    let capturedSet = null;
    const patched = [];
    const restorePatched = () => {
      for (const a of patched) {
        try {
          if (a.__origWrite) {
            a.write = a.__origWrite;
            delete a.__origWrite;
          }
        } catch {
        }
      }
    };
    for (const atom of cache.values()) {
      if (!atom || typeof atom.write !== "function" || atom.__origWrite) continue;
      const orig = atom.write;
      atom.__origWrite = orig;
      atom.write = function(get, set2, ...args) {
        if (!capturedSet) {
          capturedGet = get;
          capturedSet = set2;
          restorePatched();
        }
        return orig.call(this, get, set2, ...args);
      };
      patched.push(atom);
    }
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const t0 = Date.now();
    try {
      pageWindow.dispatchEvent?.(new pageWindow.Event("visibilitychange"));
    } catch {
    }
    while (!capturedSet && Date.now() - t0 < timeoutMs) {
      await wait(50);
    }
    if (!capturedSet) {
      restorePatched();
      _lastCapturedVia = "polyfill";
      if (!_warnedWriteOnceTimeout) {
        _warnedWriteOnceTimeout = true;
        console.warn("[GLC jotai-bridge] write-once: timeout \u2192 polyfill");
      }
      if (allowReschedule) scheduleRetryCapture();
      return {
        get: () => {
          throw new Error("Store non captur\xE9: get indisponible");
        },
        set: () => {
          throw new Error("Store non captur\xE9: set indisponible");
        },
        sub: () => () => {
        },
        __polyfill: true
      };
    }
    _lastCapturedVia = "write";
    return {
      get: (a) => capturedGet(a),
      set: (a, v) => capturedSet(a, v),
      sub: (a, cb) => {
        let last;
        try {
          last = capturedGet(a);
        } catch {
        }
        const id = setInterval(() => {
          let curr;
          try {
            curr = capturedGet(a);
          } catch {
            return;
          }
          if (curr !== last) {
            last = curr;
            try {
              cb();
            } catch {
            }
          }
        }, 100);
        return () => clearInterval(id);
      }
    };
  }
  function scheduleRetryCapture() {
    if (_retryListenersInstalled || typeof window === "undefined") return;
    _retryListenersInstalled = true;
    const trigger = async () => {
      if (!_retryListenersInstalled) return;
      _retryListenersInstalled = false;
      try {
        window.removeEventListener("keydown", onEvent, true);
        window.removeEventListener("pointerdown", onEvent, true);
        window.removeEventListener("visibilitychange", onEvent, true);
      } catch {
      }
      try {
        const viaFiber = findStoreViaFiber();
        if (viaFiber) {
          _store = viaFiber;
          _lastCapturedVia = "fiber";
          return;
        }
        const viaWrite = await captureViaWriteOnce(4e3, false);
        if (!viaWrite.__polyfill) {
          _store = viaWrite;
        }
      } catch {
      }
    };
    const onEvent = () => {
      void trigger();
    };
    window.addEventListener("keydown", onEvent, true);
    window.addEventListener("pointerdown", onEvent, true);
    window.addEventListener("visibilitychange", onEvent, true);
    setTimeout(() => void trigger(), 2e3);
  }
  async function ensureStore() {
    if (_store && !_store.__polyfill) return _store;
    if (_captureInProgress) {
      const t0 = Date.now();
      const maxWait = 5500;
      while (!_store && Date.now() - t0 < maxWait) {
        await new Promise((r) => setTimeout(r, 25));
      }
      if (_store && !_store.__polyfill) return _store;
    }
    _captureInProgress = true;
    try {
      const viaFiber = findStoreViaFiber();
      if (viaFiber) {
        _store = viaFiber;
        return _store;
      }
      const viaWrite = await captureViaWriteOnce();
      _store = viaWrite;
      return _store;
    } catch (e) {
      _captureError = e;
      throw e;
    } finally {
      _captureInProgress = false;
    }
  }
  async function jGet(atom) {
    const s = await ensureStore();
    return s.get(atom);
  }
  async function jSet(atom, value) {
    const s = await ensureStore();
    await s.set(atom, value);
  }
  async function jSub(atom, cb) {
    const s = await ensureStore();
    return s.sub(atom, cb);
  }
  function findAtomsByLabel(regex) {
    const cache = getAtomCache();
    if (!cache) return [];
    const out = [];
    for (const a of cache.values()) {
      const label = a?.debugLabel || a?.label || "";
      if (regex.test(String(label))) out.push(a);
    }
    return out;
  }
  function getAtomByLabel(label) {
    const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return findAtomsByLabel(new RegExp("^" + escape(label) + "$"))[0] || null;
  }

  // src/store/api.ts
  async function ensureStore2() {
    try {
      await ensureStore();
    } catch {
    }
  }
  async function select(label, fallback) {
    await ensureStore2();
    const atom = getAtomByLabel(label);
    if (!atom) return fallback;
    try {
      return await jGet(atom);
    } catch {
      return fallback;
    }
  }
  async function subscribe(label, cb) {
    await ensureStore2();
    const atom = getAtomByLabel(label);
    if (!atom) return () => {
    };
    const unsub = await jSub(atom, async () => {
      try {
        cb(await jGet(atom));
      } catch {
      }
    });
    return unsub;
  }
  async function subscribeImmediate(label, cb) {
    const first = await select(label);
    if (first !== void 0) cb(first);
    return subscribe(label, cb);
  }
  async function set(label, value) {
    await ensureStore2();
    const atom = getAtomByLabel(label);
    if (!atom) return;
    await jSet(atom, value);
  }
  var Store = { ensure: ensureStore2, select, subscribe, subscribeImmediate, set };

  // src/utils/tileObjectSystemApi.ts
  var state = {
    engine: null,
    tos: null,
    origBind: Function.prototype.bind,
    bindPatched: false
  };
  function looksLikeEngine(o) {
    return !!(o && typeof o === "object" && typeof o.start === "function" && typeof o.destroy === "function" && o.app && o.app.stage && o.app.renderer && o.systems && typeof o.systems.values === "function");
  }
  function findTileObjectSystem(engine) {
    try {
      for (const e of engine.systems.values()) {
        const s = e?.system;
        if (s?.name === "tileObject") return s;
      }
    } catch {
    }
    return null;
  }
  function tryCaptureFromKnownGlobals() {
    const w = window;
    if (!state.engine && w.__QUINOA_ENGINE__) state.engine = w.__QUINOA_ENGINE__;
    if (!state.tos && w.__TILE_OBJECT_SYSTEM__) state.tos = w.__TILE_OBJECT_SYSTEM__;
    if (state.engine && !state.tos) state.tos = findTileObjectSystem(state.engine);
  }
  function armCapture() {
    if (state.engine && state.tos) return;
    if (state.bindPatched) return;
    state.bindPatched = true;
    Function.prototype.bind = function(thisArg, ...args) {
      const bound = state.origBind.call(this, thisArg, ...args);
      try {
        if (!state.engine && looksLikeEngine(thisArg)) {
          state.engine = thisArg;
          state.tos = findTileObjectSystem(thisArg);
          Function.prototype.bind = state.origBind;
          state.bindPatched = false;
        }
      } catch {
      }
      return bound;
    };
  }
  function deepClone(v) {
    try {
      if (typeof structuredClone === "function") return structuredClone(v);
    } catch {
    }
    try {
      return JSON.parse(JSON.stringify(v));
    } catch {
    }
    return v;
  }
  function globalIndexFromXY(tx, ty) {
    const cols = state.tos?.map?.cols;
    if (!Number.isFinite(cols) || cols <= 0) return null;
    return ty * cols + tx | 0;
  }
  function getTileViewAt(tx, ty, ensureView) {
    const gidx = globalIndexFromXY(tx, ty);
    if (!state.tos || gidx == null) return { gidx: null, tv: null };
    let tv = state.tos.tileViews?.get?.(gidx) ?? null;
    if (!tv && ensureView && typeof state.tos.getOrCreateTileView === "function") {
      try {
        tv = state.tos.getOrCreateTileView(gidx);
      } catch {
      }
    }
    return { gidx, tv };
  }
  function assertReady() {
    if (!state.engine || !state.tos) {
      throw new Error("Quinoa engine/TOS not captured. Call tos.init() early (main entry) and ensure it runs before engine initializes.");
    }
  }
  function applyTileObject(tx, ty, nextObj, opts = {}) {
    assertReady();
    const ensureView = opts.ensureView !== false;
    const forceUpdate = opts.forceUpdate !== false;
    const { gidx, tv } = getTileViewAt(tx, ty, ensureView);
    if (gidx == null) throw new Error("TOS/map cols not available");
    if (!tv) throw new Error("TileView not available");
    const before = tv.tileObject;
    tv.onDataChanged(nextObj);
    if (forceUpdate && state.engine?.reusableContext) {
      try {
        tv.update(state.engine.reusableContext);
      } catch {
      }
    }
    return { tx, ty, gidx, ok: true, before, after: tv.tileObject };
  }
  function assertType(obj, type) {
    if (!obj) throw new Error("No tileObject on this tile");
    if (obj.objectType !== type) throw new Error(`Wrong objectType: expected "${type}", got "${obj.objectType}"`);
  }
  function patchPlantSlot(slot, slotPatch) {
    const p = slotPatch || {};
    if ("startTime" in p) slot.startTime = Number(p.startTime);
    if ("endTime" in p) slot.endTime = Number(p.endTime);
    if ("targetScale" in p) slot.targetScale = Number(p.targetScale);
    if ("mutations" in p) {
      if (!Array.isArray(p.mutations)) throw new Error("mutations must be an array of strings");
      if (!p.mutations.every((x) => typeof x === "string")) throw new Error("mutations must contain only strings");
      slot.mutations = p.mutations.slice();
    }
  }
  var tos = {
    /** Call once in main, as early as possible */
    init() {
      tryCaptureFromKnownGlobals();
      armCapture();
      tryCaptureFromKnownGlobals();
      return { ok: !!(state.engine && state.tos), engine: state.engine, tos: state.tos };
    },
    isReady() {
      return !!(state.engine && state.tos);
    },
    getStatus() {
      return { ok: !!(state.engine && state.tos), engine: state.engine, tos: state.tos };
    },
    getTileObject(tx, ty, opts = {}) {
      assertReady();
      const ensureView = opts.ensureView !== false;
      const { gidx, tv } = getTileViewAt(Number(tx), Number(ty), ensureView);
      if (gidx == null) throw new Error("TOS/map cols not available");
      return {
        tx: Number(tx),
        ty: Number(ty),
        gidx,
        tileView: tv,
        tileObject: tv?.tileObject
      };
    },
    /** Clears the tile (tileObject = null) */
    setTileEmpty(tx, ty, opts = {}) {
      return applyTileObject(Number(tx), Number(ty), null, opts);
    },
    setTilePlant(tx, ty, patch, opts = {}) {
      const info = this.getTileObject(tx, ty, opts);
      const cur = info.tileObject;
      assertType(cur, "plant");
      const next = deepClone(cur);
      if (!Array.isArray(next.slots)) next.slots = [];
      const p = patch || {};
      if ("plantedAt" in p) next.plantedAt = Number(p.plantedAt);
      if ("maturedAt" in p) next.maturedAt = Number(p.maturedAt);
      if ("species" in p) next.species = String(p.species);
      if ("slotIdx" in p && "slotPatch" in p) {
        const i = Number(p.slotIdx) | 0;
        if (!next.slots[i]) throw new Error(`Plant slot ${i} does not exist`);
        patchPlantSlot(next.slots[i], p.slotPatch);
        return applyTileObject(Number(tx), Number(ty), next, opts);
      }
      if ("slots" in p) {
        const s = p.slots;
        if (Array.isArray(s)) {
          for (let i = 0; i < s.length; i++) {
            if (s[i] == null) continue;
            if (!next.slots[i]) throw new Error(`Plant slot ${i} does not exist`);
            patchPlantSlot(next.slots[i], s[i]);
          }
        } else if (s && typeof s === "object") {
          for (const k of Object.keys(s)) {
            const i = Number(k) | 0;
            if (!Number.isFinite(i)) continue;
            if (!next.slots[i]) throw new Error(`Plant slot ${i} does not exist`);
            patchPlantSlot(next.slots[i], s[k]);
          }
        } else {
          throw new Error("patch.slots must be an array or object map");
        }
        return applyTileObject(Number(tx), Number(ty), next, opts);
      }
      return applyTileObject(Number(tx), Number(ty), next, opts);
    },
    setTileDecor(tx, ty, patch, opts = {}) {
      const info = this.getTileObject(tx, ty, opts);
      const cur = info.tileObject;
      assertType(cur, "decor");
      const next = deepClone(cur);
      const p = patch || {};
      if ("rotation" in p) next.rotation = Number(p.rotation);
      return applyTileObject(Number(tx), Number(ty), next, opts);
    },
    setTileEgg(tx, ty, patch, opts = {}) {
      const info = this.getTileObject(tx, ty, opts);
      const cur = info.tileObject;
      assertType(cur, "egg");
      const next = deepClone(cur);
      const p = patch || {};
      if ("plantedAt" in p) next.plantedAt = Number(p.plantedAt);
      if ("maturedAt" in p) next.maturedAt = Number(p.maturedAt);
      return applyTileObject(Number(tx), Number(ty), next, opts);
    }
  };

  // src/ui/toast.ts
  async function sendToast(toast) {
    const sendAtom = getAtomByLabel("sendQuinoaToastAtom");
    if (sendAtom) {
      await jSet(sendAtom, toast);
      return;
    }
    const listAtom = getAtomByLabel("quinoaToastsAtom");
    if (!listAtom) throw new Error("Aucun atom de toast trouv\xE9");
    const prev = await jGet(listAtom).catch(() => []);
    const t = { isClosable: true, duration: 1e4, ...toast };
    if ("toastType" in t && t.toastType === "board") {
      t.id = t.id ?? (t.isStackable ? `quinoa-stackable-${Date.now()}-${Math.random()}` : "quinoa-game-toast");
    } else {
      t.id = t.id ?? "quinoa-game-toast";
    }
    await jSet(listAtom, [...prev, t]);
  }
  async function toastSimple(title, description, variant = "info", duration = 3500) {
    await sendToast({ title, description, variant, duration });
  }

  // src/data/hardcoded-data.clean.js
  var rarity = {
    Common: "Common",
    Uncommon: "Uncommon",
    Rare: "Rare",
    Legendary: "Legendary",
    Mythic: "Mythical",
    Divine: "Divine",
    Celestial: "Celestial"
  };
  var harvestType = {
    Single: "Single",
    Multiple: "Multiple"
  };
  var tileRefsPlants = {
    DirtPatch: 1,
    SproutFlower: 2,
    SproutVegetable: 3,
    SproutFruit: 4,
    SproutVine: 5,
    StemFlower: 6,
    Trellis: 7,
    Daffodil: 11,
    Tulip: 12,
    Sunflower: 13,
    Lily: 14,
    Starweaver: 15,
    Chrysanthemum: 16,
    Aloe: 18,
    Blueberry: 21,
    Banana: 22,
    Strawberry: 23,
    Mango: 24,
    Grape: 25,
    Watermelon: 26,
    Lemon: 27,
    Apple: 28,
    Pear: 29,
    Pineapple: 30,
    Pepper: 31,
    PalmTree: 3e3,
    CacaoTree: 3001,
    Tree: 8,
    Tomato: 32,
    BabyCarrot: 33,
    Carrot: 34,
    Pumpkin: 35,
    Corn: 36,
    FavaBean: 37,
    Cacao: 38,
    PalmTreeTop: 39,
    BushyTree: 40,
    Coconut: 41,
    PassionFruit: 43,
    DragonFruit: 44,
    Lychee: 45,
    Mushroom: 3002,
    BurrosTail: 47,
    Echeveria: 49,
    Delphinium: 50,
    DawnCelestialCrop: 51,
    MoonCelestialCrop: 52,
    Camellia: 57,
    Hedge: 58,
    FlowerBush: 59,
    Squash: 60,
    PineTree: 61,
    Poinsettia: 62,
    Shrub: 63
  };
  var tileRefsTallPlants = {
    Bamboo: 1,
    DawnCelestialPlatform: 3,
    DawnCelestialPlant: 4,
    DawnCelestialPlantActive: 5,
    DawnCelestialPlatformTopmostLayer: 6,
    Cactus: 7,
    MoonCelestialPlatform: 9,
    MoonCelestialPlant: 10,
    MoonCelestialPlantActive: 11,
    StarweaverPlatform: 13,
    StarweaverPlant: 14
  };
  var tileRefsSeeds = {
    Daffodil: 1,
    Tulip: 2,
    Sunflower: 3,
    Starweaver: 6,
    DawnCelestial: 7,
    MoonCelestial: 8,
    Blueberry: 11,
    Banana: 12,
    Strawberry: 13,
    Mango: 14,
    Grape: 15,
    Watermelon: 16,
    Lemon: 17,
    Apple: 18,
    Pear: 19,
    Lily: 20,
    Pepper: 21,
    Tomato: 22,
    Carrot: 23,
    Pumpkin: 25,
    Corn: 26,
    Peach: 27,
    FavaBean: 28,
    Cacao: 29,
    Delphinium: 30,
    Coconut: 31,
    Mushroom: 32,
    PassionFruit: 33,
    DragonFruit: 34,
    Lychee: 35,
    BurrosTail: 37,
    Aloe: 39,
    Echeveria: 40,
    Bamboo: 41,
    Cactus: 42,
    Camellia: 48,
    Chrysanthemum: 49,
    Squash: 50,
    Pinecone: 51,
    Poinsettia: 52
  };
  var tileRefsItems = {
    Coin: 1,
    Shovel: 2,
    PlanterPot: 6,
    InventoryBag: 7,
    WateringCan: 9,
    MoneyBag: 11,
    RainbowPotion: 14,
    GoldPotion: 15,
    WetPotion: 16,
    ChilledPotion: 17,
    FrozenPotion: 18,
    DawnlitPotion: 19,
    AmberlitPotion: 20,
    JournalStamp: 22,
    Donut: 23,
    ToolsRestocked: 24,
    SeedsRestocked: 25,
    EggsRestocked: 26,
    DecorRestocked: 27,
    Leaderboard: 28,
    Stats: 29,
    ActivityLog: 30,
    ChatBubble: 39,
    ArrowKeys: 41,
    Touchpad: 42
  };
  var tileRefsPets = {
    Bee: 1,
    Chicken: 2,
    Bunny: 3,
    Turtle: 4,
    Capybara: 5,
    Cow: 6,
    Pig: 7,
    Butterfly: 8,
    Snail: 9,
    Worm: 10,
    CommonEgg: 11,
    UncommonEgg: 12,
    RareEgg: 13,
    LegendaryEgg: 14,
    MythicalEgg: 15,
    DivineEgg: 16,
    CelestialEgg: 17,
    Squirrel: 18,
    Goat: 19,
    Dragonfly: 20,
    Turkey: 29,
    Peacock: 30,
    SnowFox: 31,
    Stoat: 32,
    WhiteCaribou: 33,
    WinterEgg: 34,
    SnowEgg: 35
  };
  var tileRefsMutations = {
    Wet: 1,
    Chilled: 2,
    Frozen: 3,
    Puddle: 5,
    Dawnlit: 11,
    Amberlit: 12,
    Dawncharged: 13,
    Ambercharged: 14
  };
  var tileRefsDecor = {
    SmallRock: 11,
    MediumRock: 21,
    LargeRock: 31,
    WoodPedestal: 4,
    WoodBench: 13,
    WoodBenchBackwards: 14,
    WoodBenchSideways: 24,
    WoodBucketPedestal: 34,
    WoodLampPost: 23,
    WoodStool: 63,
    WoodArch: 33,
    WoodArchSide: 43,
    WoodBridge: 34,
    WoodBridgeSideways: 44,
    WoodOwl: 53,
    WoodGardenBox: 74,
    Birdhouse: 54,
    WoodWindmill: 64,
    StonePedestal: 6,
    StoneBench: 15,
    StoneBenchSideways: 2600,
    StoneBucketPedestal: 16,
    StoneLampPost: 25,
    StoneColumn: 2601,
    StoneArch: 35,
    StoneArchSideways: 45,
    StoneBridge: 36,
    StoneBridgeSideways: 46,
    StoneGnome: 55,
    StoneGardenBox: 66,
    StoneBirdBath: 56,
    MarblePedestal: 8,
    MarbleBench: 17,
    MarbleBenchBackwards: 18,
    MarbleBenchSideways: 28,
    MarbleBucketPedestal: 58,
    MarbleLampPost: 27,
    MarbleColumn: 68,
    MarbleArch: 37,
    MarbleArchSideways: 47,
    MarbleBridge: 38,
    MarbleBridgeSideways: 48,
    MarbleBlobling: 57,
    MarbleFountain: 58,
    MarbleGardenBox: 78,
    MiniFairyCottage: 50,
    MiniFairyForge: 40,
    MiniFairyKeep: 60,
    MiniWizardTower: 68,
    HayBale: 29,
    HayBaleSideways: 39,
    StrawScarecrow: 49,
    Cauldron: 59,
    SmallGravestone: 69,
    SmallGravestoneSideways: 70,
    MediumGravestone: 79,
    MediumGravestoneSideways: 80,
    LargeGravestone: 89,
    LargeGravestoneSideways: 90,
    WoodCaribou: 91,
    StoneCaribou: 92,
    MarbleCaribou: 93,
    ColoredStringLights: 94,
    ColoredStringLightsSideways: 95,
    StringLights: 96,
    StringLightsSideways: 97,
    PetHutch: 30,
    DecorShed: 98
  };
  var plantCatalog = {
    Carrot: {
      seed: {
        tileRef: tileRefsSeeds.Carrot,
        name: "Carrot Seed",
        coinPrice: 10,
        creditPrice: 7,
        rarity: rarity.Common
      },
      plant: {
        tileRef: tileRefsPlants.BabyCarrot,
        name: "Carrot Plant",
        harvestType: harvestType.Single,
        baseTileScale: 0.7
      },
      crop: {
        tileRef: tileRefsPlants.Carrot,
        name: "Carrot",
        baseSellPrice: 20,
        baseWeight: 0.1,
        baseTileScale: 0.6,
        maxScale: 3
      }
    },
    Strawberry: {
      seed: {
        tileRef: tileRefsSeeds.Strawberry,
        name: "Strawberry Seed",
        coinPrice: 50,
        creditPrice: 21,
        rarity: rarity.Common
      },
      plant: {
        tileRef: tileRefsPlants.SproutFruit,
        name: "Strawberry Plant",
        harvestType: harvestType.Multiple,
        slotOffsets: [
          { x: -0.2, y: -0.1, rotation: 0 },
          { x: 0.175, y: -0.2, rotation: 0 },
          { x: -0.18, y: 0.22, rotation: 0 },
          { x: 0.2, y: 0.2, rotation: 0 },
          { x: 0.01, y: 0.01, rotation: 0 }
        ],
        secondsToMature: 70,
        baseTileScale: 1,
        rotateSlotOffsetsRandomly: true
      },
      crop: {
        tileRef: tileRefsPlants.Strawberry,
        name: "Strawberry",
        baseSellPrice: 14,
        baseWeight: 0.05,
        baseTileScale: 0.25,
        maxScale: 2
      }
    },
    Aloe: {
      seed: {
        tileRef: tileRefsSeeds.Aloe,
        name: "Aloe Seed",
        coinPrice: 135,
        creditPrice: 18,
        rarity: rarity.Common
      },
      plant: {
        tileRef: tileRefsPlants.AloePlant,
        name: "Aloe Plant",
        harvestType: harvestType.Single,
        baseTileScale: 0.9
      },
      crop: {
        tileRef: tileRefsPlants.Aloe,
        name: "Aloe",
        baseSellPrice: 310,
        baseWeight: 1.5,
        baseTileScale: 0.7,
        maxScale: 2.5
      }
    },
    FavaBean: {
      seed: {
        tileRef: tileRefsSeeds.FavaBean,
        name: "Fava Bean",
        coinPrice: 250,
        creditPrice: 30,
        rarity: rarity.Uncommon
      },
      plant: {
        tileRef: tileRefsPlants.SproutFlower,
        name: "Fava Bean Plant",
        harvestType: harvestType.Multiple,
        slotOffsets: [
          { x: -0.1, y: 0.15, rotation: 35 },
          { x: -0.23, y: 0.22, rotation: 35 },
          { x: 0.05, y: 0.3, rotation: 35 },
          { x: 0.18, y: 0.25, rotation: 35 },
          { x: 0.22, y: -0.02, rotation: 35 },
          { x: 0.1, y: -0.15, rotation: 35 },
          { x: -0.1, y: -0.17, rotation: 35 },
          { x: -0.25, y: -0.11, rotation: 35 }
        ],
        secondsToMature: 900,
        baseTileScale: 1.1,
        rotateSlotOffsetsRandomly: true
      },
      crop: {
        tileRef: tileRefsPlants.FavaBean,
        name: "Fava Bean Pod",
        baseSellPrice: 30,
        baseWeight: 0.03,
        baseTileScale: 0.3,
        maxScale: 3
      }
    },
    Delphinium: {
      seed: {
        tileRef: tileRefsSeeds.Delphinium,
        name: "Delphinium Seed",
        coinPrice: 300,
        creditPrice: 12,
        rarity: rarity.Uncommon
      },
      plant: {
        tileRef: tileRefsPlants.Delphinium,
        name: "Delphinium Plant",
        harvestType: harvestType.Single,
        baseTileScale: 0.8,
        tileTransformOrigin: "bottom",
        nudgeY: -0.43,
        nudgeYMultiplier: 0.05
      },
      crop: {
        tileRef: tileRefsPlants.Delphinium,
        name: "Delphinium",
        baseSellPrice: 530,
        baseWeight: 0.02,
        baseTileScale: 0.8,
        maxScale: 3
      }
    },
    Blueberry: {
      seed: {
        tileRef: tileRefsSeeds.Blueberry,
        name: "Blueberry Seed",
        coinPrice: 400,
        creditPrice: 49,
        rarity: rarity.Uncommon
      },
      plant: {
        tileRef: tileRefsPlants.SproutFruit,
        name: "Blueberry Plant",
        harvestType: harvestType.Multiple,
        slotOffsets: [
          { x: -0.2, y: -0.1, rotation: 0 },
          { x: 0.175, y: -0.2, rotation: 0 },
          { x: -0.18, y: 0.22, rotation: 0 },
          { x: 0.2, y: 0.2, rotation: 0 },
          { x: 0.01, y: 0.01, rotation: 0 }
        ],
        secondsToMature: 105,
        baseTileScale: 1,
        rotateSlotOffsetsRandomly: true
      },
      crop: {
        tileRef: tileRefsPlants.Blueberry,
        name: "Blueberry",
        baseSellPrice: 23,
        baseWeight: 0.01,
        baseTileScale: 0.25,
        maxScale: 2
      }
    },
    Apple: {
      seed: {
        tileRef: tileRefsSeeds.Apple,
        name: "Apple Seed",
        coinPrice: 500,
        creditPrice: 67,
        rarity: rarity.Uncommon,
        unavailableSurfaces: ["discord"]
      },
      plant: {
        tileRef: tileRefsTallPlants.Tree,
        name: "Apple Tree",
        harvestType: harvestType.Multiple,
        slotOffsets: [
          { x: -0.35, y: -2.4, rotation: 0 },
          { x: -0.5, y: -2, rotation: 0 },
          { x: 0.1, y: -2.2, rotation: 0 },
          { x: -0.2, y: -1.65, rotation: 0 },
          { x: 0.55, y: -1.9, rotation: 0 },
          { x: 0.3, y: -1.7, rotation: 0 },
          { x: 0.4, y: 0.1, rotation: 0 }
        ],
        secondsToMature: 360 * 60,
        baseTileScale: 3,
        rotateSlotOffsetsRandomly: true,
        tileTransformOrigin: "bottom",
        nudgeY: -0.25
      },
      crop: {
        tileRef: tileRefsPlants.Apple,
        name: "Apple",
        baseSellPrice: 73,
        baseWeight: 0.18,
        baseTileScale: 0.5,
        maxScale: 2
      }
    },
    OrangeTulip: {
      seed: {
        tileRef: tileRefsSeeds.Tulip,
        name: "Tulip Seed",
        coinPrice: 600,
        creditPrice: 14,
        rarity: rarity.Uncommon
      },
      plant: {
        tileRef: tileRefsPlants.Tulip,
        name: "Tulip Plant",
        harvestType: harvestType.Single,
        baseTileScale: 0.5
      },
      crop: {
        tileRef: tileRefsPlants.Tulip,
        name: "Tulip",
        baseSellPrice: 767,
        baseWeight: 0.01,
        baseTileScale: 0.5,
        maxScale: 3
      }
    },
    Tomato: {
      seed: {
        tileRef: tileRefsSeeds.Tomato,
        name: "Tomato Seed",
        coinPrice: 800,
        creditPrice: 79,
        rarity: rarity.Uncommon
      },
      plant: {
        tileRef: tileRefsPlants.SproutVine,
        name: "Tomato Plant",
        harvestType: harvestType.Multiple,
        slotOffsets: [
          { x: -0.3, y: -0.3, rotation: 0 },
          { x: 0.3, y: 0.3, rotation: 0 }
        ],
        secondsToMature: 1100,
        baseTileScale: 1,
        rotateSlotOffsetsRandomly: false
      },
      crop: {
        tileRef: tileRefsPlants.Tomato,
        name: "Tomato",
        baseSellPrice: 27,
        baseWeight: 0.3,
        baseTileScale: 0.33,
        maxScale: 2
      }
    },
    Daffodil: {
      seed: {
        tileRef: tileRefsSeeds.Daffodil,
        name: "Daffodil Seed",
        coinPrice: 1e3,
        creditPrice: 19,
        rarity: rarity.Rare
      },
      plant: {
        tileRef: tileRefsPlants.Daffodil,
        name: "Daffodil Plant",
        harvestType: harvestType.Single,
        baseTileScale: 0.5
      },
      crop: {
        tileRef: tileRefsPlants.Daffodil,
        name: "Daffodil",
        baseSellPrice: 1090,
        baseWeight: 0.01,
        baseTileScale: 0.5,
        maxScale: 3
      }
    },
    Corn: {
      seed: {
        tileRef: tileRefsSeeds.Corn,
        name: "Corn Kernel",
        coinPrice: 1300,
        creditPrice: 135,
        rarity: rarity.Rare
      },
      plant: {
        tileRef: tileRefsPlants.SproutVegetable,
        name: "Corn Plant",
        harvestType: harvestType.Multiple,
        slotOffsets: [{ x: 0, y: -0.1, rotation: 0 }],
        secondsToMature: 130,
        baseTileScale: 1,
        rotateSlotOffsetsRandomly: false
      },
      crop: {
        tileRef: tileRefsPlants.Corn,
        name: "Corn",
        baseSellPrice: 36,
        baseWeight: 1.2,
        baseTileScale: 0.7,
        maxScale: 2
      }
    },
    Watermelon: {
      seed: {
        tileRef: tileRefsSeeds.Watermelon,
        name: "Watermelon Seed",
        coinPrice: 2500,
        creditPrice: 195,
        rarity: rarity.Rare
      },
      plant: {
        tileRef: tileRefsPlants.Watermelon,
        name: "Watermelon Plant",
        harvestType: harvestType.Single,
        baseTileScale: 0.8
      },
      crop: {
        tileRef: tileRefsPlants.Watermelon,
        name: "Watermelon",
        baseSellPrice: 2708,
        baseWeight: 4.5,
        baseTileScale: 0.8,
        maxScale: 3
      }
    },
    Pumpkin: {
      seed: {
        tileRef: tileRefsSeeds.Pumpkin,
        name: "Pumpkin Seed",
        coinPrice: 3e3,
        creditPrice: 210,
        rarity: rarity.Rare
      },
      plant: {
        tileRef: tileRefsPlants.Pumpkin,
        name: "Pumpkin Plant",
        harvestType: harvestType.Single,
        baseTileScale: 0.8
      },
      crop: {
        tileRef: tileRefsPlants.Pumpkin,
        name: "Pumpkin",
        baseSellPrice: 3700,
        baseWeight: 6,
        baseTileScale: 0.8,
        maxScale: 3
      }
    },
    Echeveria: {
      seed: {
        tileRef: tileRefsSeeds.Echeveria,
        name: "Echeveria Cutting",
        coinPrice: 4200,
        creditPrice: 113,
        rarity: rarity.Rare
      },
      plant: {
        tileRef: tileRefsPlants.Echeveria,
        name: "Echeveria Plant",
        harvestType: harvestType.Single,
        baseTileScale: 0.8
      },
      crop: {
        tileRef: tileRefsPlants.Echeveria,
        name: "Echeveria",
        baseSellPrice: 4600,
        baseWeight: 0.8,
        baseTileScale: 0.8,
        maxScale: 2.75
      }
    },
    Coconut: {
      seed: {
        tileRef: tileRefsSeeds.Coconut,
        name: "Coconut Seed",
        coinPrice: 6e3,
        creditPrice: 235,
        rarity: rarity.Legendary
      },
      plant: {
        tileRef: tileRefsTallPlants.PalmTree,
        name: "Coconut Tree",
        harvestType: harvestType.Multiple,
        slotOffsets: [
          { x: -0.2, y: -2.6, rotation: 0 },
          { x: -0.3, y: -2.4, rotation: 0 },
          { x: 0.2, y: -2.5, rotation: 0 },
          { x: -0.25, y: -2.1, rotation: 0 },
          { x: 0, y: -2.3, rotation: 0 },
          { x: 0.3, y: -2.2, rotation: 0 },
          { x: 0.05, y: -2, rotation: 0 }
        ],
        secondsToMature: 720 * 60,
        baseTileScale: 3,
        rotateSlotOffsetsRandomly: true,
        tileTransformOrigin: "bottom",
        nudgeY: -0.35
      },
      crop: {
        tileRef: tileRefsPlants.Coconut,
        name: "Coconut",
        baseSellPrice: 302,
        baseWeight: 5,
        baseTileScale: 0.25,
        maxScale: 3
      }
    },
    Banana: {
      seed: {
        tileRef: tileRefsSeeds.Banana,
        name: "Banana Seed",
        coinPrice: 7500,
        creditPrice: 199,
        rarity: rarity.Legendary,
        getCanSpawnInGuild: (guildId) => {
          const last = guildId.slice(-1);
          const r = parseInt(last, 10);
          return !isNaN(r) && r % 2 === 0;
        },
        unavailableSurfaces: ["web"]
      },
      plant: {
        tileRef: tileRefsTallPlants.PalmTree,
        name: "Banana Plant",
        harvestType: harvestType.Multiple,
        slotOffsets: [
          { x: -0.3, y: -1.7, rotation: 10 },
          { x: -0.2, y: -1.7, rotation: -10 },
          { x: -0.1, y: -1.7, rotation: -30 },
          { x: 0, y: -1.7, rotation: -50 },
          { x: 0.1, y: -1.7, rotation: -70 }
        ],
        secondsToMature: 14400,
        baseTileScale: 2.5,
        rotateSlotOffsetsRandomly: false,
        tileTransformOrigin: "bottom",
        nudgeY: -0.4
      },
      crop: {
        tileRef: tileRefsPlants.Banana,
        name: "Banana",
        baseSellPrice: 1750,
        baseWeight: 0.12,
        baseTileScale: 0.5,
        maxScale: 1.7
      }
    },
    PineTree: {
      seed: {
        tileRef: tileRefsSeeds.Pinecone,
        name: "Pinecone",
        coinPrice: 12e3,
        creditPrice: 30,
        rarity: rarity.Legendary
      },
      plant: {
        tileRef: tileRefsPlants.PineTree,
        name: "Pine Tree",
        harvestType: harvestType.Single,
        baseTileScale: 1.5
      },
      crop: {
        tileRef: tileRefsPlants.PineTree,
        name: "Pine Tree",
        baseSellPrice: 15e3,
        baseWeight: 1e3,
        baseTileScale: 1.5,
        maxScale: 3.5
      }
    },
    Lily: {
      seed: {
        tileRef: tileRefsSeeds.Lily,
        name: "Lily Seed",
        coinPrice: 2e4,
        creditPrice: 34,
        rarity: rarity.Legendary
      },
      plant: {
        tileRef: tileRefsPlants.Lily,
        name: "Lily Plant",
        harvestType: harvestType.Single,
        baseTileScale: 0.75,
        nudgeY: -0.1
      },
      crop: {
        tileRef: tileRefsPlants.Lily,
        name: "Lily",
        baseSellPrice: 20123,
        baseWeight: 0.02,
        baseTileScale: 0.5,
        maxScale: 2.75
      }
    },
    Camellia: {
      seed: {
        tileRef: tileRefsSeeds.Camellia,
        name: "Camellia Seed",
        coinPrice: 55e3,
        creditPrice: 289,
        rarity: rarity.Legendary
      },
      plant: {
        tileRef: tileRefsPlants.Hedge,
        name: "Camellia Hedge",
        harvestType: harvestType.Multiple,
        slotOffsets: [
          { x: 0, y: -0.9, rotation: 0 },
          { x: -0.28, y: -0.6, rotation: 0 },
          { x: 0.28, y: -0.6, rotation: 0 },
          { x: -0.35, y: -0.2, rotation: 0 },
          { x: 0.32, y: -0.2, rotation: 0 },
          { x: -0.3, y: 0.25, rotation: 0 },
          { x: 0.28, y: 0.25, rotation: 0 },
          { x: 0, y: 0, rotation: 0 }
        ],
        secondsToMature: 1440 * 60,
        baseTileScale: 2,
        rotateSlotOffsetsRandomly: true,
        tileTransformOrigin: "bottom",
        nudgeY: -0.4,
        nudgeYMultiplier: 0.5
      },
      crop: {
        tileRef: tileRefsPlants.Camellia,
        name: "Camellia",
        baseSellPrice: 4875,
        baseWeight: 0.3,
        baseTileScale: 0.4,
        maxScale: 2.5
      }
    },
    Squash: {
      seed: {
        tileRef: tileRefsSeeds.Squash,
        name: "Squash Seed",
        coinPrice: 55e3,
        creditPrice: 199,
        rarity: rarity.Legendary
      },
      plant: {
        tileRef: tileRefsPlants.SproutFlower,
        name: "Squash Plant",
        harvestType: harvestType.Multiple,
        slotOffsets: [
          { x: -0.08, y: 0.2, rotation: 35 },
          { x: 0.2, y: 0, rotation: 35 },
          { x: -0.2, y: -0.1, rotation: 35 }
        ],
        secondsToMature: 1500,
        baseTileScale: 1.2,
        rotateSlotOffsetsRandomly: true
      },
      crop: {
        tileRef: tileRefsPlants.Squash,
        name: "Squash",
        baseSellPrice: 3500,
        baseWeight: 0.3,
        baseTileScale: 0.4,
        maxScale: 2.5
      }
    },
    BurrosTail: {
      seed: {
        tileRef: tileRefsSeeds.BurrosTail,
        name: "Burro's Tail Cutting",
        coinPrice: 93e3,
        creditPrice: 338,
        rarity: rarity.Legendary
      },
      plant: {
        tileRef: tileRefsPlants.Trellis,
        name: "Burro's Tail Plant",
        harvestType: harvestType.Multiple,
        slotOffsets: [
          { x: -0.13, y: -0.1, rotation: 0 },
          { x: 0.17, y: 0.13, rotation: 0 }
        ],
        secondsToMature: 1800,
        baseTileScale: 0.8,
        rotateSlotOffsetsRandomly: false
      },
      crop: {
        tileRef: tileRefsPlants.BurrosTail,
        name: "Burro's Tail",
        baseSellPrice: 6e3,
        baseWeight: 0.4,
        baseTileScale: 0.4,
        maxScale: 2.5
      }
    },
    Mushroom: {
      seed: {
        tileRef: tileRefsSeeds.Mushroom,
        name: "Mushroom Spore",
        coinPrice: 15e4,
        creditPrice: 249,
        rarity: rarity.Mythic
      },
      plant: {
        tileRef: tileRefsPlants.MushroomPlant,
        name: "Mushroom Plant",
        harvestType: harvestType.Single,
        baseTileScale: 0.8
      },
      crop: {
        tileRef: tileRefsPlants.Mushroom,
        name: "Mushroom",
        baseSellPrice: 16e4,
        baseWeight: 25,
        baseTileScale: 0.65,
        maxScale: 3.5
      }
    },
    Cactus: {
      seed: {
        tileRef: tileRefsSeeds.Cactus,
        name: "Cactus Seed",
        coinPrice: 25e4,
        creditPrice: 250,
        rarity: rarity.Mythic
      },
      plant: {
        tileRef: tileRefsTallPlants.Cactus,
        name: "Cactus Plant",
        harvestType: harvestType.Single,
        baseTileScale: 2.5,
        tileTransformOrigin: "bottom",
        nudgeY: -0.4,
        nudgeYMultiplier: 0.3
      },
      crop: {
        tileRef: tileRefsTallPlants.Cactus,
        name: "Cactus",
        baseSellPrice: 261e3,
        baseWeight: 1500,
        baseTileScale: 2.5,
        maxScale: 1.8
      }
    },
    Bamboo: {
      seed: {
        tileRef: tileRefsSeeds.Bamboo,
        name: "Bamboo Seed",
        coinPrice: 4e5,
        creditPrice: 300,
        rarity: rarity.Mythic
      },
      plant: {
        tileRef: tileRefsTallPlants.Bamboo,
        name: "Bamboo Plant",
        harvestType: harvestType.Single,
        baseTileScale: 2.5,
        tileTransformOrigin: "bottom",
        nudgeY: -0.45,
        nudgeYMultiplier: 0.3
      },
      crop: {
        tileRef: tileRefsTallPlants.Bamboo,
        name: "Bamboo Shoot",
        baseSellPrice: 5e5,
        baseWeight: 1,
        baseTileScale: 2.5,
        maxScale: 2
      }
    },
    Poinsettia: {
      seed: {
        tileRef: tileRefsSeeds.Poinsettia,
        name: "Poinsettia Seed",
        coinPrice: 5e5,
        creditPrice: 500,
        rarity: rarity.Mythic
      },
      plant: {
        tileRef: tileRefsTallPlants.Shrub,
        name: "Poinsettia Bush",
        harvestType: harvestType.Multiple,
        slotOffsets: [{
          x: 0.05,
          y: -0.4,
          rotation: 0
        }, {
          x: -0.3,
          y: -0.15,
          rotation: 0
        }, {
          x: 0.3,
          y: -0.1,
          rotation: 0
        }, {
          x: -0.02,
          y: 0.17,
          rotation: 0
        }],
        secondsToMature: 10800,
        baseTileScale: 1,
        rotateSlotOffsetsRandomly: true
      },
      crop: {
        tileRef: tileRefsTallPlants.Poinsettia,
        name: "Poinsettia",
        baseSellPrice: 3e4,
        baseWeight: 0.02,
        baseTileScale: 0.3,
        maxScale: 2
      }
    },
    Chrysanthemum: {
      seed: {
        tileRef: tileRefsSeeds.Chrysanthemum,
        name: "Chrysanthemum Seed",
        coinPrice: 67e4,
        creditPrice: 567,
        rarity: rarity.Mythic
      },
      plant: {
        tileRef: tileRefsPlants.FlowerBush,
        name: "Chrysanthemum Bush",
        harvestType: harvestType.Multiple,
        slotOffsets: [
          { x: 0, y: 0, rotation: 0 },
          { x: -0.28, y: 0.22, rotation: 0 },
          { x: 0.28, y: 0.22, rotation: 0 },
          { x: 0, y: 0.33, rotation: 0 },
          { x: -0.25, y: -0.2, rotation: 0 },
          { x: 0.25, y: -0.2, rotation: 0 },
          { x: 0, y: -0.28, rotation: 0 }
        ],
        secondsToMature: 1440 * 60,
        baseTileScale: 1,
        rotateSlotOffsetsRandomly: false,
        tileTransformOrigin: "bottom"
      },
      crop: {
        tileRef: tileRefsPlants.Chrysanthemum,
        name: "Chrysanthemum",
        baseSellPrice: 18e3,
        baseWeight: 0.01,
        baseTileScale: 0.3,
        maxScale: 2.75
      }
    },
    Grape: {
      seed: {
        tileRef: tileRefsSeeds.Grape,
        name: "Grape Seed",
        coinPrice: 85e4,
        creditPrice: 599,
        rarity: rarity.Mythic,
        getCanSpawnInGuild: (guildId) => guildId.endsWith("1"),
        unavailableSurfaces: ["web"]
      },
      plant: {
        tileRef: tileRefsPlants.SproutVine,
        name: "Grape Plant",
        harvestType: harvestType.Multiple,
        slotOffsets: [{ x: 0, y: 0, rotation: 0 }],
        secondsToMature: 1440 * 60,
        baseTileScale: 1,
        rotateSlotOffsetsRandomly: true
      },
      crop: {
        tileRef: tileRefsPlants.Grape,
        name: "Grape",
        baseSellPrice: 12500,
        baseWeight: 3,
        baseTileScale: 0.5,
        maxScale: 2
      }
    },
    Pepper: {
      seed: {
        tileRef: tileRefsSeeds.Pepper,
        name: "Pepper Seed",
        coinPrice: 1e6,
        creditPrice: 629,
        rarity: rarity.Divine
      },
      plant: {
        tileRef: tileRefsPlants.SproutVine,
        name: "Pepper Plant",
        harvestType: harvestType.Multiple,
        slotOffsets: [
          { x: -0.02, y: 0.219, rotation: 0 },
          { x: 0.172, y: 0.172, rotation: 0 },
          { x: -0.172, y: 0.137, rotation: 0 },
          { x: 0.168, y: -0.035, rotation: 0 },
          { x: -0.082, y: -0.047, rotation: 0 },
          { x: -0.207, y: -0.074, rotation: 0 },
          { x: 0.18, y: -0.176, rotation: 0 },
          { x: -0.273, y: -0.195, rotation: 0 },
          { x: -0.074, y: -0.25, rotation: 0 }
        ],
        secondsToMature: 560,
        baseTileScale: 1,
        rotateSlotOffsetsRandomly: true
      },
      crop: {
        tileRef: tileRefsPlants.Pepper,
        name: "Pepper",
        baseSellPrice: 7220,
        baseWeight: 0.5,
        baseTileScale: 0.3,
        maxScale: 2
      }
    },
    Lemon: {
      seed: {
        tileRef: tileRefsSeeds.Lemon,
        name: "Lemon Seed",
        coinPrice: 2e6,
        creditPrice: 500,
        rarity: rarity.Divine,
        getCanSpawnInGuild: (guildId) => guildId.endsWith("2"),
        unavailableSurfaces: ["web"]
      },
      plant: {
        tileRef: tileRefsTallPlants.Tree,
        name: "Lemon Tree",
        harvestType: harvestType.Multiple,
        slotOffsets: [
          { x: -0.5, y: -1.5, rotation: 0 },
          { x: 0.4, y: -1.6, rotation: 0 },
          { x: -0.3, y: -1.18, rotation: 0 },
          { x: 0.2, y: -1.2, rotation: 0 },
          { x: 0.01, y: -1.5, rotation: 0 },
          { x: -0.05, y: -1.8, rotation: 0 }
        ],
        secondsToMature: 720 * 60,
        baseTileScale: 2.3,
        rotateSlotOffsetsRandomly: true,
        tileTransformOrigin: "bottom",
        nudgeY: -0.25
      },
      crop: {
        tileRef: tileRefsPlants.Lemon,
        name: "Lemon",
        baseSellPrice: 1e4,
        baseWeight: 0.5,
        baseTileScale: 0.25,
        maxScale: 3
      }
    },
    PassionFruit: {
      seed: {
        tileRef: tileRefsSeeds.PassionFruit,
        name: "Passion Fruit Seed",
        coinPrice: 275e4,
        creditPrice: 679,
        rarity: rarity.Divine
      },
      plant: {
        tileRef: tileRefsPlants.SproutVine,
        name: "Passion Fruit Plant",
        harvestType: harvestType.Multiple,
        slotOffsets: [
          { x: -0.3, y: -0.3, rotation: 0 },
          { x: 0.3, y: 0.3, rotation: 0 }
        ],
        secondsToMature: 1440 * 60,
        baseTileScale: 1.1,
        rotateSlotOffsetsRandomly: false
      },
      crop: {
        tileRef: tileRefsPlants.PassionFruit,
        name: "Passion Fruit",
        baseSellPrice: 24500,
        baseWeight: 9.5,
        baseTileScale: 0.35,
        maxScale: 2
      }
    },
    DragonFruit: {
      seed: {
        tileRef: tileRefsSeeds.DragonFruit,
        name: "Dragon Fruit Seed",
        coinPrice: 5e6,
        creditPrice: 715,
        rarity: rarity.Divine
      },
      plant: {
        tileRef: tileRefsPlants.PalmTreeTop,
        name: "Dragon Fruit Plant",
        harvestType: harvestType.Multiple,
        slotOffsets: [
          { x: -0.3, y: -0.4, rotation: 0 },
          { x: -0.4, y: -0.05, rotation: 0 },
          { x: 0.36, y: -0.3, rotation: 0 },
          { x: -0.25, y: 0.3, rotation: 0 },
          { x: 0, y: -0.1, rotation: 0 },
          { x: 0.4, y: 0.1, rotation: 0 },
          { x: 0.1, y: 0.2, rotation: 0 }
        ],
        secondsToMature: 600,
        baseTileScale: 1.6,
        rotateSlotOffsetsRandomly: true
      },
      crop: {
        tileRef: tileRefsPlants.DragonFruit,
        name: "Dragon Fruit",
        baseSellPrice: 24500,
        baseWeight: 8.4,
        baseTileScale: 0.4,
        maxScale: 2
      }
    },
    Cacao: {
      seed: {
        tileRef: tileRefsSeeds.Cacao,
        name: "Cacao Bean",
        coinPrice: 1e7,
        creditPrice: 750,
        rarity: rarity.Divine
      },
      plant: {
        tileRef: tileRefsTallPlants.CacaoTree,
        name: "Cacao Plant",
        harvestType: harvestType.Multiple,
        slotOffsets: [
          { x: 0.28, y: -1.17, rotation: 20 },
          { x: -0.3, y: -1.07, rotation: 20 },
          { x: -0.05, y: -1.42, rotation: 20 },
          { x: 0.45, y: -1.67, rotation: 20 },
          { x: -0.5, y: -1.57, rotation: 20 },
          { x: -0.05, y: -1.87, rotation: 20 }
        ],
        secondsToMature: 1440 * 60,
        baseTileScale: 2.8,
        rotateSlotOffsetsRandomly: true,
        tileTransformOrigin: "bottom",
        nudgeY: -0.32
      },
      crop: {
        tileRef: tileRefsPlants.Cacao,
        name: "Cacao Fruit",
        baseSellPrice: 7e4,
        baseWeight: 0.5,
        baseTileScale: 0.4,
        maxScale: 2.5
      }
    },
    Lychee: {
      seed: {
        tileRef: tileRefsSeeds.Lychee,
        name: "Lychee Pit",
        coinPrice: 25e6,
        creditPrice: 819,
        rarity: rarity.Divine,
        getCanSpawnInGuild: (guildId) => guildId.endsWith("2"),
        unavailableSurfaces: ["web"]
      },
      plant: {
        tileRef: tileRefsPlants.BushyTree,
        name: "Lychee Plant",
        harvestType: harvestType.Multiple,
        slotOffsets: [
          { x: -0.4, y: -0.1, rotation: 0 },
          { x: 0.3, y: -0.2, rotation: 0 },
          { x: -0.3, y: 0.22, rotation: 0 },
          { x: 0.2, y: 0.2, rotation: 0 },
          { x: 0.01, y: -0.1, rotation: 0 },
          { x: -0.2, y: -0.3, rotation: 0 }
        ],
        secondsToMature: 1440 * 60,
        baseTileScale: 1.2,
        rotateSlotOffsetsRandomly: true
      },
      crop: {
        tileRef: tileRefsPlants.Lychee,
        name: "Lychee Fruit",
        baseSellPrice: 5e4,
        baseWeight: 9,
        baseTileScale: 0.2,
        maxScale: 2
      }
    },
    Sunflower: {
      seed: {
        tileRef: tileRefsSeeds.Sunflower,
        name: "Sunflower Seed",
        coinPrice: 1e8,
        creditPrice: 900,
        rarity: rarity.Divine
      },
      plant: {
        tileRef: tileRefsPlants.StemFlower,
        name: "Sunflower Plant",
        harvestType: harvestType.Multiple,
        slotOffsets: [{ x: 0.01, y: -0.6, rotation: 0 }],
        secondsToMature: 1440 * 60,
        rotateSlotOffsetsRandomly: false,
        tileTransformOrigin: "bottom",
        baseTileScale: 0.8,
        nudgeY: -0.35
      },
      crop: {
        tileRef: tileRefsPlants.Sunflower,
        name: "Sunflower",
        baseSellPrice: 75e4,
        baseWeight: 10,
        baseTileScale: 0.5,
        maxScale: 2.5
      }
    },
    Starweaver: {
      seed: {
        tileRef: tileRefsSeeds.Starweaver,
        name: "Starweaver Pod",
        coinPrice: 1e9,
        creditPrice: 1e3,
        rarity: rarity.Celestial
      },
      plant: {
        tileRef: tileRefsTallPlants.StarweaverPlant,
        name: "Starweaver Plant",
        harvestType: harvestType.Multiple,
        slotOffsets: [{ x: 0, y: -0.918, rotation: 0 }],
        secondsToMature: 1440 * 60,
        baseTileScale: 1.5,
        rotateSlotOffsetsRandomly: false,
        tileTransformOrigin: "bottom",
        nudgeY: -0.27,
        immatureTileRef: tileRefsTallPlants.StarweaverPlatform,
        isFixedScale: true,
        growingAnimationTiles: { frames: 10, row: 8, fps: 20, nudgeY: -0.2 }
      },
      crop: {
        tileRef: tileRefsPlants.Starweaver,
        name: "Starweaver Fruit",
        baseSellPrice: 1e7,
        baseWeight: 10,
        baseTileScale: 0.6,
        maxScale: 2
      }
    },
    DawnCelestial: {
      seed: {
        tileRef: tileRefsSeeds.DawnCelestial,
        name: "Dawnbinder Pod",
        coinPrice: 1e10,
        creditPrice: 1129,
        rarity: rarity.Celestial
      },
      plant: {
        tileRef: tileRefsTallPlants.DawnCelestialPlant,
        name: "Dawnbinder",
        harvestType: harvestType.Multiple,
        secondsToMature: 1440 * 60,
        slotOffsets: [{ x: -0.015, y: -0.95, rotation: 0 }],
        baseTileScale: 2.3,
        rotateSlotOffsetsRandomly: false,
        tileTransformOrigin: "bottom",
        nudgeY: -0.2,
        abilities: ["DawnKisser"],
        activeState: {
          tileRef: tileRefsTallPlants.DawnCelestialPlantActive,
          activeAnimationTiles: { frames: 10, row: 6, fps: 20, nudgeY: -0.1 }
        },
        topmostLayerTileRef: tileRefsTallPlants.DawnCelestialPlatformTopmostLayer,
        immatureTileRef: tileRefsTallPlants.DawnCelestialPlatform,
        isFixedScale: true,
        growingAnimationTiles: { frames: 10, row: 8, fps: 20, nudgeY: -0.2 }
      },
      crop: {
        tileRef: tileRefsPlants.DawnCelestialCrop,
        name: "Dawnbinder Bulb",
        baseSellPrice: 11e6,
        baseWeight: 6,
        baseTileScale: 0.4,
        maxScale: 2.5,
        transformOrigin: "top"
      }
    },
    MoonCelestial: {
      seed: {
        tileRef: tileRefsSeeds.MoonCelestial,
        name: "Moonbinder Pod",
        coinPrice: 5e10,
        creditPrice: 1249,
        rarity: rarity.Celestial
      },
      plant: {
        tileRef: tileRefsTallPlants.MoonCelestialPlant,
        name: "Moonbinder",
        harvestType: harvestType.Multiple,
        slotOffsets: [
          { x: 0.01, y: -1.81, rotation: 0 },
          { x: -0.26, y: -0.82, rotation: -20 },
          { x: 0.23, y: -1, rotation: 20 }
        ],
        secondsToMature: 1440 * 60,
        baseTileScale: 2.5,
        rotateSlotOffsetsRandomly: false,
        tileTransformOrigin: "bottom",
        nudgeY: -0.2,
        abilities: ["MoonKisser"],
        activeState: {
          tileRef: tileRefsTallPlants.MoonCelestialPlantActive,
          activeAnimationTiles: { frames: 10, row: 6, fps: 20, nudgeY: -0.1 }
        },
        immatureTileRef: tileRefsTallPlants.MoonCelestialPlatform,
        isFixedScale: true,
        growingAnimationTiles: { frames: 10, row: 8, fps: 20, nudgeY: -0.2 }
      },
      crop: {
        tileRef: tileRefsPlants.MoonCelestialCrop,
        name: "Moonbinder Bulb",
        baseSellPrice: 11e6,
        baseWeight: 2,
        baseTileScale: 0.4,
        maxScale: 2,
        transformOrigin: "bottom"
      }
    }
  };
  var mutationCatalog = {
    Gold: { name: "Gold", baseChance: 0.01, coinMultiplier: 25 },
    Rainbow: { name: "Rainbow", baseChance: 1e-3, coinMultiplier: 50 },
    Wet: { name: "Wet", baseChance: 0, coinMultiplier: 2, tileRef: tileRefsMutations.Wet },
    Chilled: { name: "Chilled", baseChance: 0, coinMultiplier: 2, tileRef: tileRefsMutations.Chilled },
    Frozen: { name: "Frozen", baseChance: 0, coinMultiplier: 10, tileRef: tileRefsMutations.Frozen },
    Dawnlit: { name: "Dawnlit", baseChance: 0, coinMultiplier: 2, tileRef: tileRefsMutations.Dawnlit },
    Amberlit: { name: "Amberlit", baseChance: 0, coinMultiplier: 5, tileRef: tileRefsMutations.Amberlit },
    Dawncharged: { name: "Dawnbound", baseChance: 0, coinMultiplier: 3, tileRef: tileRefsMutations.Dawncharged },
    Ambercharged: { name: "Amberbound", baseChance: 0, coinMultiplier: 6, tileRef: tileRefsMutations.Ambercharged }
  };
  var eggCatalog = {
    CommonEgg: { tileRef: tileRefsPets.CommonEgg, name: "Common Egg", coinPrice: 1e5, creditPrice: 19, rarity: rarity.Common, initialTileScale: 0.3, baseTileScale: 0.8, secondsToHatch: 600, faunaSpawnWeights: { Worm: 60, Snail: 35, Bee: 5 } },
    UncommonEgg: { tileRef: tileRefsPets.UncommonEgg, name: "Uncommon Egg", coinPrice: 1e6, creditPrice: 48, rarity: rarity.Uncommon, initialTileScale: 0.3, baseTileScale: 0.8, secondsToHatch: 3600, faunaSpawnWeights: { Chicken: 65, Bunny: 25, Dragonfly: 10 } },
    RareEgg: { tileRef: tileRefsPets.RareEgg, name: "Rare Egg", coinPrice: 1e7, creditPrice: 99, rarity: rarity.Rare, initialTileScale: 0.3, baseTileScale: 0.8, secondsToHatch: 21600, faunaSpawnWeights: { Pig: 90, Cow: 10 } },
    LegendaryEgg: { tileRef: tileRefsPets.LegendaryEgg, name: "Legendary Egg", coinPrice: 1e8, creditPrice: 249, rarity: rarity.Legendary, initialTileScale: 0.3, baseTileScale: 0.8, secondsToHatch: 43200, faunaSpawnWeights: { Squirrel: 60, Turtle: 30, Goat: 10 } },
    MythicalEgg: { tileRef: tileRefsPets.MythicalEgg, name: "Mythical Egg", coinPrice: 1e9, creditPrice: 599, rarity: rarity.Mythic, initialTileScale: 0.3, baseTileScale: 0.8, secondsToHatch: 86400, faunaSpawnWeights: { Butterfly: 75, Capybara: 5, Peacock: 20 } },
    WinterEgg: {
      tileRef: tileRefsPets.WinterEgg,
      name: "Winter Egg",
      coinPrice: 8e7,
      creditPrice: 199,
      rarity: rarity.Legendary,
      initialTileScale: 0.3,
      baseTileScale: 0.8,
      secondsToHatch: 43200,
      faunaSpawnWeights: { SnowFox: 75, Stoat: 20, WhiteCaribou: 5 },
      expiryDate: /* @__PURE__ */ new Date("2026-01-12T01:00:00.000Z")
    },
    SnowEgg: {
      tileRef: tileRefsPets.SnowEgg,
      name: "Snow Egg",
      coinPrice: 2e8,
      creditPrice: 269,
      rarity: rarity.Legendary,
      secondsToHatch: 43200,
      faunaSpawnWeights: {
        SnowFox: 75,
        Stoat: 20,
        WhiteCaribou: 5
      },
      requiredWeather: "Frost"
    }
  };
  var petCatalog = {
    Worm: {
      tileRef: tileRefsPets.Worm,
      name: "Worm",
      description: "",
      coinsToFullyReplenishHunger: 500,
      innateAbilityWeights: { SeedFinderI: 50, ProduceEater: 50 },
      baseTileScale: 0.6,
      maxScale: 2,
      maturitySellPrice: 5e3,
      matureWeight: 0.1,
      moveProbability: 0.1,
      hoursToMature: 12,
      rarity: rarity.Common,
      tileTransformOrigin: "bottom",
      nudgeY: -0.25,
      diet: ["Carrot", "Strawberry", "Aloe", "Tomato", "Apple"]
    },
    Snail: {
      tileRef: tileRefsPets.Snail,
      name: "Snail",
      description: "",
      coinsToFullyReplenishHunger: 1e3,
      innateAbilityWeights: { CoinFinderI: 100 },
      baseTileScale: 0.6,
      maxScale: 2,
      maturitySellPrice: 1e4,
      matureWeight: 0.15,
      moveProbability: 0.01,
      hoursToMature: 12,
      rarity: rarity.Common,
      tileTransformOrigin: "bottom",
      nudgeY: -0.25,
      diet: ["Blueberry", "Tomato", "Corn", "Daffodil", "Chrysanthemum"]
    },
    Bee: {
      tileRef: tileRefsPets.Bee,
      name: "Bee",
      coinsToFullyReplenishHunger: 1500,
      innateAbilityWeights: { ProduceScaleBoost: 50, ProduceMutationBoost: 50 },
      baseTileScale: 0.6,
      maxScale: 2.5,
      maturitySellPrice: 3e4,
      matureWeight: 0.2,
      moveProbability: 0.5,
      hoursToMature: 12,
      rarity: rarity.Common,
      diet: ["Strawberry", "Blueberry", "Daffodil", "Lily", "Chrysanthemum"]
    },
    Chicken: {
      tileRef: tileRefsPets.Chicken,
      name: "Chicken",
      coinsToFullyReplenishHunger: 3e3,
      innateAbilityWeights: { EggGrowthBoost: 80, PetRefund: 20 },
      baseTileScale: 0.8,
      maxScale: 2,
      maturitySellPrice: 5e4,
      matureWeight: 3,
      moveProbability: 0.2,
      hoursToMature: 24,
      rarity: rarity.Uncommon,
      tileTransformOrigin: "bottom",
      nudgeY: -0.2,
      diet: ["Aloe", "Corn", "Watermelon", "Pumpkin"]
    },
    Bunny: {
      tileRef: tileRefsPets.Bunny,
      name: "Bunny",
      coinsToFullyReplenishHunger: 750,
      innateAbilityWeights: { CoinFinderII: 60, SellBoostI: 40 },
      baseTileScale: 0.7,
      maxScale: 2,
      maturitySellPrice: 75e3,
      matureWeight: 2,
      moveProbability: 0.3,
      hoursToMature: 24,
      rarity: rarity.Uncommon,
      tileTransformOrigin: "bottom",
      nudgeY: -0.2,
      diet: ["Carrot", "Strawberry", "Blueberry", "OrangeTulip", "Apple"]
    },
    Dragonfly: {
      tileRef: tileRefsPets.Dragonfly,
      name: "Dragonfly",
      coinsToFullyReplenishHunger: 250,
      innateAbilityWeights: { HungerRestore: 70, PetMutationBoost: 30 },
      baseTileScale: 0.6,
      maxScale: 2.5,
      maturitySellPrice: 15e4,
      matureWeight: 0.2,
      moveProbability: 0.7,
      hoursToMature: 24,
      rarity: rarity.Uncommon,
      tileTransformOrigin: "center",
      diet: ["Apple", "OrangeTulip", "Echeveria"]
    },
    Pig: {
      tileRef: tileRefsPets.Pig,
      name: "Pig",
      coinsToFullyReplenishHunger: 5e4,
      innateAbilityWeights: { SellBoostII: 30, PetAgeBoost: 30, PetHatchSizeBoost: 30 },
      baseTileScale: 1,
      maxScale: 2.5,
      maturitySellPrice: 5e5,
      matureWeight: 200,
      moveProbability: 0.2,
      hoursToMature: 72,
      rarity: rarity.Rare,
      tileTransformOrigin: "bottom",
      nudgeY: -0.15,
      diet: ["Watermelon", "Pumpkin", "Mushroom", "Bamboo"]
    },
    Cow: {
      tileRef: tileRefsPets.Cow,
      name: "Cow",
      coinsToFullyReplenishHunger: 25e3,
      innateAbilityWeights: { SeedFinderII: 30, HungerBoost: 30, PlantGrowthBoost: 30 },
      baseTileScale: 1.1,
      maxScale: 2.5,
      maturitySellPrice: 1e6,
      matureWeight: 600,
      moveProbability: 0.1,
      hoursToMature: 72,
      rarity: rarity.Rare,
      tileTransformOrigin: "bottom",
      nudgeY: -0.15,
      diet: ["Coconut", "Banana", "BurrosTail", "Mushroom"]
    },
    Turkey: {
      tileRef: tileRefsPets.Turkey,
      name: "Turkey",
      coinsToFullyReplenishHunger: 500,
      innateAbilityWeights: { RainDance: 60, EggGrowthBoostII_NEW: 35, DoubleHatch: 5 },
      baseTileScale: 1,
      maxScale: 2.5,
      maturitySellPrice: 3e6,
      matureWeight: 10,
      moveProbability: 0.25,
      hoursToMature: 72,
      rarity: rarity.Rare,
      tileTransformOrigin: "bottom",
      nudgeY: -0.15,
      diet: ["FavaBean", "Corn", "Squash"]
    },
    Squirrel: {
      tileRef: tileRefsPets.Squirrel,
      name: "Squirrel",
      coinsToFullyReplenishHunger: 15e3,
      innateAbilityWeights: { CoinFinderIII: 70, SellBoostIII: 20, PetMutationBoostII: 10 },
      baseTileScale: 0.6,
      maxScale: 2,
      maturitySellPrice: 5e6,
      matureWeight: 0.5,
      moveProbability: 0.4,
      hoursToMature: 100,
      rarity: rarity.Legendary,
      tileTransformOrigin: "bottom",
      nudgeY: -0.1,
      diet: ["Pumpkin", "Banana", "Grape"]
    },
    Turtle: {
      tileRef: tileRefsPets.Turtle,
      name: "Turtle",
      coinsToFullyReplenishHunger: 1e5,
      innateAbilityWeights: { HungerRestoreII: 25, HungerBoostII: 25, PlantGrowthBoostII: 25, EggGrowthBoostII: 25 },
      baseTileScale: 1,
      maxScale: 2.5,
      maturitySellPrice: 1e7,
      matureWeight: 150,
      moveProbability: 0.05,
      hoursToMature: 100,
      rarity: rarity.Legendary,
      tileTransformOrigin: "bottom",
      nudgeY: -0.15,
      diet: ["Watermelon", "BurrosTail", "Bamboo", "Pepper"]
    },
    Goat: {
      tileRef: tileRefsPets.Goat,
      name: "Goat",
      coinsToFullyReplenishHunger: 2e4,
      innateAbilityWeights: { PetHatchSizeBoostII: 10, PetAgeBoostII: 40, PetXpBoost: 40 },
      baseTileScale: 1,
      maxScale: 2,
      maturitySellPrice: 2e7,
      matureWeight: 100,
      moveProbability: 0.2,
      hoursToMature: 100,
      rarity: rarity.Legendary,
      tileTransformOrigin: "bottom",
      nudgeY: -0.1,
      diet: ["Pumpkin", "Coconut", "Pepper", "Camellia", "PassionFruit"]
    },
    SnowFox: {
      tileRef: tileRefsPets.SnowFox,
      name: "Snow Fox",
      coinsToFullyReplenishHunger: 14e3,
      innateAbilityWeights: {
        SnowGranter: 30,
        SnowyCoinFinder: 30,
        SnowyPetXpBoost: 30
      },
      maxScale: 2,
      maturitySellPrice: 7e6,
      matureWeight: 7.5,
      moveProbability: 0.35,
      moveTweenDurationMs: 400,
      hoursToMature: 100,
      rarity: rarity.Legendary,
      diet: ["Echeveria", "Squash", "Grape"]
    },
    Stoat: {
      tileRef: tileRefsPets.Stoat,
      name: "Stoat",
      coinsToFullyReplenishHunger: 1e4,
      innateAbilityWeights: {
        SnowGranter: 40,
        SnowyHungerBoost: 40,
        SnowyCropMutationBoost: 20
      },
      maxScale: 2,
      maturitySellPrice: 1e7,
      matureWeight: 0.4,
      moveProbability: 0.3,
      moveTweenDurationMs: 600,
      hoursToMature: 100,
      rarity: rarity.Legendary,
      diet: ["Banana", "Pepper", "Cactus"]
    },
    WhiteCaribou: {
      tileRef: tileRefsPets.WhiteCaribou,
      name: "Caribou",
      coinsToFullyReplenishHunger: 3e4,
      innateAbilityWeights: {
        FrostGranter: 50,
        SnowyPlantGrowthBoost: 40,
        SnowyCropSizeBoost: 10
      },
      maxScale: 2.5,
      maturitySellPrice: 15e6,
      matureWeight: 300,
      moveProbability: 0.2,
      moveTweenDurationMs: 1e3,
      hoursToMature: 100,
      rarity: rarity.Legendary,
      diet: ["Camellia", "BurrosTail", "Mushroom"]
    },
    Butterfly: {
      tileRef: tileRefsPets.Butterfly,
      name: "Butterfly",
      coinsToFullyReplenishHunger: 25e3,
      innateAbilityWeights: { ProduceScaleBoostII: 40, ProduceMutationBoostII: 40, SeedFinderIII: 20 },
      baseTileScale: 0.6,
      maxScale: 2.5,
      maturitySellPrice: 5e7,
      matureWeight: 0.2,
      moveProbability: 0.6,
      hoursToMature: 144,
      rarity: rarity.Mythic,
      tileTransformOrigin: "center",
      diet: ["Daffodil", "Lily", "Grape", "Lemon", "Sunflower"]
    },
    Capybara: {
      tileRef: tileRefsPets.Capybara,
      name: "Capybara",
      coinsToFullyReplenishHunger: 15e4,
      innateAbilityWeights: { DoubleHarvest: 50, ProduceRefund: 50 },
      baseTileScale: 1,
      maxScale: 2.5,
      maturitySellPrice: 2e8,
      matureWeight: 50,
      moveProbability: 0.2,
      hoursToMature: 144,
      rarity: rarity.Mythic,
      tileTransformOrigin: "bottom",
      nudgeY: -0.1,
      diet: ["Lemon", "PassionFruit", "DragonFruit", "Lychee"]
    },
    Peacock: {
      tileRef: tileRefsPets.Peacock,
      name: "Peacock",
      coinsToFullyReplenishHunger: 1e5,
      innateAbilityWeights: { SellBoostIV: 40, PetXpBoostII: 50, PetRefundII: 10 },
      baseTileScale: 1.2,
      maxScale: 2.5,
      maturitySellPrice: 1e8,
      matureWeight: 5,
      moveProbability: 0.2,
      hoursToMature: 144,
      rarity: rarity.Mythic,
      tileTransformOrigin: "bottom",
      nudgeY: -0.1,
      diet: ["Cactus", "Sunflower", "Lychee"]
    }
  };
  var toolCatalog = {
    WateringCan: {
      tileRef: tileRefsItems.WateringCan,
      name: "Watering Can",
      coinPrice: 5e3,
      creditPrice: 2,
      rarity: rarity.Common,
      description: "Speeds up growth of plant by 5 minutes. SINGLE USE.",
      isOneTimePurchase: false,
      baseTileScale: 0.6,
      maxInventoryQuantity: 99
    },
    PlanterPot: {
      tileRef: tileRefsItems.PlanterPot,
      name: "Planter Pot",
      coinPrice: 25e3,
      creditPrice: 5,
      rarity: rarity.Common,
      description: "Extract a plant to your inventory (can be replanted). SINGLE USE.",
      isOneTimePurchase: false,
      baseTileScale: 0.8
    },
    Shovel: {
      tileRef: tileRefsItems.Shovel,
      name: "Garden Shovel",
      coinPrice: 1e6,
      creditPrice: 100,
      rarity: rarity.Uncommon,
      description: "Remove plants from your garden. UNLIMITED USES.",
      isOneTimePurchase: true,
      baseTileScale: 0.7
    },
    RainbowPotion: {
      tileRef: tileRefsItems.RainbowPotion,
      name: "Rainbow Potion",
      coinPrice: 1 / 0,
      creditPrice: 1 / 0,
      rarity: rarity.Celestial,
      description: "Adds the Rainbow mutation to a crop in your garden. SINGLE USE.",
      isOneTimePurchase: true,
      baseTileScale: 1
    }
  };
  var decorCatalog = {
    // Rochers
    SmallRock: {
      tileRef: tileRefsDecor.SmallRock,
      name: "Small Garden Rock",
      coinPrice: 1e3,
      creditPrice: 2,
      rarity: rarity.Common,
      baseTileScale: 1,
      isOneTimePurchase: false
    },
    MediumRock: {
      tileRef: tileRefsDecor.MediumRock,
      name: "Medium Garden Rock",
      coinPrice: 2500,
      creditPrice: 5,
      rarity: rarity.Common,
      baseTileScale: 1,
      isOneTimePurchase: false
    },
    LargeRock: {
      tileRef: tileRefsDecor.LargeRock,
      name: "Large Garden Rock",
      coinPrice: 5e3,
      creditPrice: 10,
      rarity: rarity.Common,
      baseTileScale: 1,
      isOneTimePurchase: false
    },
    WoodCaribou: {
      tileRef: tileRefsDecor.WoodCaribou,
      name: "Wood Caribou",
      coinPrice: 9e3,
      creditPrice: 14,
      rarity: rarity.Common,
      baseTileScale: 1,
      isOneTimePurchase: false
    },
    // Bois
    WoodBench: {
      tileRef: tileRefsDecor.WoodBench,
      rotationVariants: {
        90: { tileRef: tileRefsDecor.WoodBenchSideways, flipH: true, baseTileScale: 1.46, nudgeY: -0.3 },
        180: { tileRef: tileRefsDecor.WoodBenchBackwards },
        270: { tileRef: tileRefsDecor.WoodBenchSideways, baseTileScale: 1.46, nudgeY: -0.3 }
      },
      name: "Wood Bench",
      coinPrice: 1e4,
      creditPrice: 15,
      rarity: rarity.Common,
      baseTileScale: 1,
      isOneTimePurchase: false,
      nudgeY: -0.3,
      avatarNudgeY: -0.18
    },
    WoodArch: {
      tileRef: tileRefsDecor.WoodArch,
      rotationVariants: {
        90: { tileRef: tileRefsDecor.WoodArchSide, flipH: true, baseTileScale: 2.1, nudgeY: -0.48 },
        180: { tileRef: tileRefsDecor.WoodArch, flipH: true },
        270: { tileRef: tileRefsDecor.WoodArchSide, baseTileScale: 2.1, nudgeY: -0.48 }
      },
      name: "Wood Arch",
      coinPrice: 2e4,
      creditPrice: 25,
      rarity: rarity.Common,
      baseTileScale: 1.53,
      isOneTimePurchase: false,
      nudgeY: -0.5
    },
    WoodBridge: {
      tileRef: tileRefsDecor.WoodBridge,
      rotationVariants: {
        90: { tileRef: tileRefsDecor.WoodBridgeSideways, flipH: true, baseTileScale: 1.7, nudgeY: -0.28 },
        180: { tileRef: tileRefsDecor.WoodBridge, flipH: true },
        270: { tileRef: tileRefsDecor.WoodBridgeSideways, baseTileScale: 1.7, nudgeY: -0.28 }
      },
      name: "Wood Bridge",
      coinPrice: 4e4,
      creditPrice: 35,
      rarity: rarity.Common,
      baseTileScale: 1.22,
      isOneTimePurchase: false,
      nudgeY: -0.35,
      avatarNudgeY: -0.44
    },
    WoodLampPost: {
      tileRef: tileRefsDecor.WoodLampPost,
      name: "Wood Lamp Post",
      coinPrice: 8e4,
      creditPrice: 49,
      rarity: rarity.Common,
      baseTileScale: 1.5,
      isOneTimePurchase: false,
      nudgeY: -0.6
    },
    WoodOwl: {
      tileRef: tileRefsDecor.WoodOwl,
      name: "Wood Owl",
      coinPrice: 9e4,
      creditPrice: 59,
      rarity: rarity.Common,
      baseTileScale: 1.3,
      isOneTimePurchase: false,
      nudgeY: -0.4
    },
    WoodBirdhouse: {
      tileRef: tileRefsDecor.Birdhouse,
      name: "Wood Birdhouse",
      coinPrice: 1e5,
      creditPrice: 69,
      rarity: rarity.Common,
      baseTileScale: 1.5,
      isOneTimePurchase: false,
      nudgeY: -0.6
    },
    WoodWindmill: {
      tileRef: tileRefsDecor.WoodWindmill,
      name: "Wood Windmill",
      coinPrice: 5e5,
      creditPrice: 74,
      rarity: rarity.Common,
      baseTileScale: 1.5,
      isOneTimePurchase: false,
      nudgeY: -0.47
    },
    StoneCaribou: {
      tileRef: tileRefsDecor.StoneCaribou,
      name: "Stone Caribou",
      coinPrice: 75e4,
      creditPrice: 72,
      rarity: rarity.Uncommon,
      baseTileScale: 1.2,
      isOneTimePurchase: false
    },
    // Pierre
    StoneBench: {
      tileRef: tileRefsDecor.StoneBench,
      rotationVariants: {
        90: { tileRef: tileRefsDecor.StoneBenchSideways, flipH: true, baseTileScale: 1.47, nudgeY: -0.3 },
        180: { tileRef: tileRefsDecor.StoneBench, flipH: true },
        270: { tileRef: tileRefsDecor.StoneBenchSideways, baseTileScale: 1.47, nudgeY: -0.3 }
      },
      name: "Stone Bench",
      coinPrice: 1e6,
      creditPrice: 75,
      rarity: rarity.Uncommon,
      baseTileScale: 1,
      isOneTimePurchase: false,
      nudgeY: -0.3,
      avatarNudgeY: -0.18
    },
    StoneArch: {
      tileRef: tileRefsDecor.StoneArch,
      rotationVariants: {
        90: { tileRef: tileRefsDecor.StoneArchSideways, flipH: true, baseTileScale: 2.1, nudgeY: -0.44 },
        180: { tileRef: tileRefsDecor.StoneArch, flipH: true },
        270: { tileRef: tileRefsDecor.StoneArchSideways, baseTileScale: 2.1, nudgeY: -0.44 }
      },
      name: "Stone Arch",
      coinPrice: 4e6,
      creditPrice: 124,
      rarity: rarity.Uncommon,
      baseTileScale: 1.53,
      isOneTimePurchase: false,
      nudgeY: -0.5
    },
    StoneBridge: {
      tileRef: tileRefsDecor.StoneBridge,
      rotationVariants: {
        90: { tileRef: tileRefsDecor.StoneBridgeSideways, flipH: true, baseTileScale: 1.7, nudgeY: -0.28 },
        180: { tileRef: tileRefsDecor.StoneBridge, flipH: true },
        270: { tileRef: tileRefsDecor.StoneBridgeSideways, baseTileScale: 1.7, nudgeY: -0.28 }
      },
      name: "Stone Bridge",
      coinPrice: 5e6,
      creditPrice: 179,
      rarity: rarity.Uncommon,
      baseTileScale: 1.22,
      isOneTimePurchase: false,
      nudgeY: -0.35,
      avatarNudgeY: -0.44
    },
    StoneLampPost: {
      tileRef: tileRefsDecor.StoneLampPost,
      name: "Stone Lamp Post",
      coinPrice: 8e6,
      creditPrice: 199,
      rarity: rarity.Uncommon,
      baseTileScale: 1.5,
      isOneTimePurchase: false,
      nudgeY: -0.6
    },
    StoneGnome: {
      tileRef: tileRefsDecor.StoneGnome,
      name: "Stone Gnome",
      coinPrice: 9e6,
      creditPrice: 219,
      rarity: rarity.Uncommon,
      baseTileScale: 1.3,
      isOneTimePurchase: false,
      nudgeY: -0.4
    },
    StoneBirdbath: {
      tileRef: tileRefsDecor.StoneBirdBath,
      name: "Stone Birdbath",
      coinPrice: 1e7,
      creditPrice: 249,
      rarity: rarity.Uncommon,
      baseTileScale: 1.2,
      isOneTimePurchase: false,
      nudgeY: -0.46
    },
    MarbleCaribou: {
      tileRef: tileRefsDecor.MarbleCaribou,
      name: "Marble Caribou",
      coinPrice: 5e7,
      creditPrice: 299,
      rarity: rarity.Rare,
      baseTileScale: 1.4,
      isOneTimePurchase: false
    },
    // Marbre
    MarbleBench: {
      tileRef: tileRefsDecor.MarbleBench,
      rotationVariants: {
        90: { tileRef: tileRefsDecor.MarbleBenchSideways, flipH: true, baseTileScale: 1.55, nudgeY: -0.35 },
        180: { tileRef: tileRefsDecor.MarbleBenchBackwards },
        270: { tileRef: tileRefsDecor.MarbleBenchSideways, baseTileScale: 1.55, nudgeY: -0.35 }
      },
      name: "Marble Bench",
      coinPrice: 75e6,
      creditPrice: 349,
      rarity: rarity.Rare,
      baseTileScale: 1,
      isOneTimePurchase: false,
      nudgeY: -0.3,
      avatarNudgeY: -0.18
    },
    MarbleArch: {
      tileRef: tileRefsDecor.MarbleArch,
      rotationVariants: {
        90: { tileRef: tileRefsDecor.MarbleArchSideways, flipH: true, baseTileScale: 2.38, nudgeY: -0.57 },
        180: { tileRef: tileRefsDecor.MarbleArch, flipH: true },
        270: { tileRef: tileRefsDecor.MarbleArchSideways, baseTileScale: 2.38, nudgeY: -0.57 }
      },
      name: "Marble Arch",
      coinPrice: 1e8,
      creditPrice: 399,
      rarity: rarity.Rare,
      baseTileScale: 1.53,
      isOneTimePurchase: false,
      nudgeY: -0.5
    },
    MarbleBridge: {
      tileRef: tileRefsDecor.MarbleBridge,
      rotationVariants: {
        90: { tileRef: tileRefsDecor.MarbleBridgeSideways, flipH: true, baseTileScale: 1.7, nudgeY: -0.28 },
        180: { tileRef: tileRefsDecor.MarbleBridge, flipH: true },
        270: { tileRef: tileRefsDecor.MarbleBridgeSideways, baseTileScale: 1.7, nudgeY: -0.28 }
      },
      name: "Marble Bridge",
      coinPrice: 15e7,
      creditPrice: 429,
      rarity: rarity.Rare,
      baseTileScale: 1.22,
      isOneTimePurchase: false,
      nudgeY: -0.35,
      avatarNudgeY: -0.44
    },
    MarbleLampPost: {
      tileRef: tileRefsDecor.MarbleLampPost,
      name: "Marble Lamp Post",
      coinPrice: 2e8,
      creditPrice: 449,
      rarity: rarity.Rare,
      baseTileScale: 1.5,
      isOneTimePurchase: false,
      nudgeY: -0.6
    },
    MarbleBlobling: {
      tileRef: tileRefsDecor.MarbleBlobling,
      name: "Marble Blobling",
      coinPrice: 3e8,
      creditPrice: 499,
      rarity: rarity.Rare,
      baseTileScale: 1.5,
      isOneTimePurchase: false,
      nudgeY: -0.56
    },
    MarbleFountain: {
      tileRef: tileRefsDecor.MarbleFountain,
      name: "Marble Fountain",
      coinPrice: 45e7,
      creditPrice: 449,
      rarity: rarity.Rare,
      baseTileScale: 1.5,
      isOneTimePurchase: false,
      nudgeY: -0.3
    },
    // Special
    MiniFairyCottage: {
      tileRef: tileRefsDecor.MiniFairyCottage,
      name: "Mini Fairy Cottage",
      coinPrice: 5e8,
      creditPrice: 549,
      rarity: rarity.Rare,
      baseTileScale: 1.1,
      isOneTimePurchase: false,
      nudgeY: -0.37
    },
    Cauldron: {
      tileRef: tileRefsDecor.Cauldron,
      name: "Cauldron",
      coinPrice: 666e6,
      creditPrice: 666,
      rarity: rarity.Legendary,
      baseTileScale: 1.5,
      isOneTimePurchase: false,
      nudgeY: -0.25,
      expiryDate: /* @__PURE__ */ new Date("2025-11-07T01:00:00.000Z")
    },
    StrawScarecrow: {
      tileRef: tileRefsDecor.StrawScarecrow,
      name: "Straw Scarecrow",
      coinPrice: 1e9,
      creditPrice: 599,
      rarity: rarity.Legendary,
      baseTileScale: 1.8,
      isOneTimePurchase: false,
      nudgeY: -0.65
    },
    MiniFairyForge: {
      tileRef: tileRefsDecor.MiniFairyForge,
      name: "Mini Fairy Forge",
      coinPrice: 5e9,
      creditPrice: 979,
      rarity: rarity.Legendary,
      baseTileScale: 1,
      isOneTimePurchase: false,
      nudgeY: -0.3
    },
    MiniFairyKeep: {
      tileRef: tileRefsDecor.MiniFairyKeep,
      name: "Mini Fairy Keep",
      coinPrice: 25e9,
      creditPrice: 1249,
      rarity: rarity.Mythic,
      baseTileScale: 1.05,
      isOneTimePurchase: false,
      nudgeY: -0.33
    },
    PetHutch: {
      tileRef: tileRefsDecor.PetHutch,
      name: "Pet Hutch",
      coinPrice: 8e10,
      creditPrice: 499,
      rarity: rarity.Divine,
      baseTileScale: 2.1,
      isOneTimePurchase: true,
      nudgeY: -0.45
    },
    DecorShed: {
      tileRef: tileRefsDecor.DecorShed,
      name: "Decor Shed",
      coinPrice: 6e10,
      creditPrice: 399,
      rarity: rarity.Divine,
      baseTileScale: 1,
      isOneTimePurchase: true
    },
    MiniWizardTower: {
      tileRef: tileRefsDecor.MiniWizardTower,
      name: "Mini Wizard Tower",
      coinPrice: 75e9,
      creditPrice: 1379,
      rarity: rarity.Mythic,
      baseTileScale: 1.8,
      isOneTimePurchase: false,
      nudgeY: -0.59
    },
    // Saisonniers (Halloween)
    HayBale: {
      tileRef: tileRefsDecor.HayBale,
      rotationVariants: {
        90: { tileRef: tileRefsDecor.HayBaleSideways, flipH: true },
        180: { tileRef: tileRefsDecor.HayBale, flipH: true },
        270: { tileRef: tileRefsDecor.HayBaleSideways }
      },
      name: "Hay Bale",
      coinPrice: 7e3,
      creditPrice: 12,
      rarity: rarity.Common,
      baseTileScale: 1.8,
      isOneTimePurchase: false,
      nudgeY: -0.42,
      expiryDate: /* @__PURE__ */ new Date("2025-11-07T01:00:00.000Z")
    },
    StringLights: {
      tileRef: tileRefsDecor.StringLights,
      rotationVariants: {
        90: {
          tileRef: tileRefsDecor.StringLightsSideways,
          flipH: true
        },
        180: {
          tileRef: tileRefsDecor.StringLights,
          flipH: true
        },
        270: {
          tileRef: tileRefsDecor.StringLightsSideways
        }
      },
      name: "String Lights",
      coinPrice: 7e3,
      creditPrice: 12,
      rarity: rarity.Common,
      baseTileScale: 1,
      isOneTimePurchase: false
    },
    ColoredStringLights: {
      tileRef: tileRefsDecor.ColoredStringLights,
      rotationVariants: {
        90: {
          tileRef: tileRefsDecor.ColoredStringLightsSideways,
          flipH: true
        },
        180: {
          tileRef: tileRefsDecor.ColoredStringLights,
          flipH: true
        },
        270: {
          tileRef: tileRefsDecor.ColoredStringLightsSideways
        }
      },
      name: "Colored String Lights",
      coinPrice: 8e3,
      creditPrice: 13,
      rarity: rarity.Common,
      baseTileScale: 1,
      isOneTimePurchase: false
    },
    SmallGravestone: {
      tileRef: tileRefsDecor.SmallGravestone,
      rotationVariants: {
        90: { tileRef: tileRefsDecor.SmallGravestoneSideways, flipH: true, baseTileScale: 1.12, nudgeY: -0.32 },
        180: { tileRef: tileRefsDecor.SmallGravestone, flipH: true },
        270: { tileRef: tileRefsDecor.SmallGravestoneSideways, baseTileScale: 1.12, nudgeY: -0.32 }
      },
      name: "Small Gravestone",
      coinPrice: 8e3,
      creditPrice: 12,
      rarity: rarity.Common,
      baseTileScale: 1,
      isOneTimePurchase: false,
      nudgeY: -0.38,
      expiryDate: /* @__PURE__ */ new Date("2025-11-07T01:00:00.000Z")
    },
    MediumGravestone: {
      tileRef: tileRefsDecor.MediumGravestone,
      rotationVariants: {
        90: { tileRef: tileRefsDecor.MediumGravestoneSideways, flipH: true, baseTileScale: 1.32, nudgeY: -0.33 },
        180: { tileRef: tileRefsDecor.MediumGravestone, flipH: true },
        270: { tileRef: tileRefsDecor.MediumGravestoneSideways, baseTileScale: 1.32, nudgeY: -0.33 }
      },
      name: "Medium Gravestone",
      coinPrice: 5e5,
      creditPrice: 72,
      rarity: rarity.Uncommon,
      baseTileScale: 1.2,
      isOneTimePurchase: false,
      nudgeY: -0.45,
      expiryDate: /* @__PURE__ */ new Date("2025-11-07T01:00:00.000Z")
    },
    LargeGravestone: {
      tileRef: tileRefsDecor.LargeGravestone,
      rotationVariants: {
        90: { tileRef: tileRefsDecor.LargeGravestoneSideways, flipH: true, baseTileScale: 1.5, nudgeY: -0.39 },
        180: { tileRef: tileRefsDecor.LargeGravestone, flipH: true },
        270: { tileRef: tileRefsDecor.LargeGravestoneSideways, baseTileScale: 1.5, nudgeY: -0.39 }
      },
      name: "Large Gravestone",
      coinPrice: 5e7,
      creditPrice: 299,
      rarity: rarity.Rare,
      baseTileScale: 1.4,
      isOneTimePurchase: false,
      nudgeY: -0.51,
      expiryDate: /* @__PURE__ */ new Date("2025-11-07T01:00:00.000Z")
    }
  };

  // src/core/webSocketBridge.ts
  function postAllToWorkers(msg) {
    if (Workers.forEach) Workers.forEach((w) => {
      try {
        w.postMessage(msg);
      } catch {
      }
    });
    else for (const w of Workers._a) {
      try {
        w.postMessage(msg);
      } catch {
      }
    }
  }
  function getPageWS() {
    if (quinoaWS && quinoaWS.readyState === NativeWS.OPEN) return quinoaWS;
    let any = null;
    if (sockets.find) any = sockets.find((s) => s.readyState === NativeWS.OPEN) || null;
    if (!any) {
      for (let i = 0; i < sockets.length; i++) if (sockets[i].readyState === NativeWS.OPEN) {
        any = sockets[i];
        break;
      }
    }
    if (any) {
      setQWS(any, "getPageWS");
      return any;
    }
    throw new Error("No page WebSocket open");
  }
  function sendToGame(payloadObj) {
    const msg = { scopePath: ["Room", "Quinoa"], ...payloadObj };
    try {
      const ws = getPageWS();
      ws.send(JSON.stringify(msg));
      return true;
    } catch {
      postAllToWorkers({ __QWS_CMD: "send", payload: JSON.stringify(msg) });
      return true;
    }
  }

  // src/services/player.ts
  var PlayerService = {
    async potPlant(slot) {
      try {
        sendToGame({ type: "PotPlant", slot });
      } catch {
      }
    },
    async plantGardenPlant(slot, itemId) {
      try {
        sendToGame({ type: "PlantGardenPlant", slot, itemId });
      } catch {
      }
    },
    async placeDecor(tileType, localTileIndex, decorId, rotation) {
      try {
        sendToGame({ type: "PlaceDecor", tileType, localTileIndex, decorId, rotation });
      } catch {
      }
    },
    async pickupDecor(tileType, localTileIndex) {
      try {
        sendToGame({ type: "PickupDecor", tileType, localTileIndex });
      } catch {
      }
    }
  };

  // src/services/gardenLayout.ts
  var ARIES_LAYOUTS_PATH = "editor.savedGardens";
  var LEGACY_LAYOUTS_PATH = "editor.savedLayouts";
  var LEGACY_LAYOUTS_KEY = "qws:editor:saved-layouts";
  var MAX_LAYOUTS = 50;
  var EMPTY_GARDEN = { tileObjects: {}, boardwalkTileObjects: {}, ignoredTiles: { dirt: [], boardwalk: [] } };
  var previewBackup = null;
  var previewActive = false;
  var PLANT_DISPLAY_NAME_OVERRIDES = {
    DawnCelestial: "Dawnbinder",
    MoonCelestial: "Moonbinder",
    Starweaver: "Starweaver",
    Lychee: "Lychee",
    Cacao: "Cacao"
  };
  var GardenLayoutService = {
    listLayouts() {
      return readLayouts();
    },
    async previewGarden(garden) {
      if (!garden || typeof garden !== "object") return false;
      try {
        const pid = await getPlayerId();
        if (!pid) return false;
        const userSlotIdx = await getUserSlotIdx(pid);
        if (!Number.isFinite(userSlotIdx)) return false;
        const currentGarden = await getGardenForPlayer(pid) || EMPTY_GARDEN;
        previewBackup = { garden: sanitizeGardenForPreview(currentGarden), userSlotIdx };
        await applyGardenToTos(sanitizeGardenForPreview(garden), userSlotIdx);
        previewActive = true;
        return true;
      } catch {
        previewActive = false;
        return false;
      }
    },
    async clearPreview() {
      if (!previewActive) return false;
      previewActive = false;
      try {
        const backup = previewBackup;
        previewBackup = null;
        if (backup) {
          await applyGardenToTos(backup.garden, backup.userSlotIdx);
        }
        return true;
      } catch {
        return false;
      }
    },
    saveLayout(name, garden) {
      const now = Date.now();
      const all = readLayouts();
      const baseName = name?.trim() || "Untitled";
      const gardenData = sanitizeGarden(garden);
      const saved = {
        id: `${now}-${Math.random().toString(16).slice(2)}`,
        name: baseName,
        createdAt: now,
        garden: { ...gardenData, name: baseName }
      };
      all.unshift(saved);
      const updated = all.slice(0, MAX_LAYOUTS);
      writeLayouts(updated);
      return saved;
    },
    deleteLayout(id) {
      if (!id) return false;
      const all = readLayouts();
      const next = all.filter((g) => g.id !== id);
      if (next.length === all.length) return false;
      writeLayouts(next);
      return true;
    },
    renameLayout(id, name) {
      if (!id) return false;
      const nextName = String(name || "").trim();
      if (!nextName) return false;
      const all = readLayouts();
      const idx = all.findIndex((g) => g.id === id);
      if (idx < 0) return false;
      const updated = all.map(
        (g, i) => i === idx ? { ...g, name: nextName, garden: { ...g.garden, name: nextName } } : g
      );
      writeLayouts(updated);
      return true;
    },
    updateLayout(id, garden) {
      if (!id) return false;
      const all = readLayouts();
      const idx = all.findIndex((g) => g.id === id);
      if (idx < 0) return false;
      const existing = all[idx];
      const nextGarden = sanitizeGarden(garden);
      const updated = all.map(
        (g, i) => i === idx ? {
          ...g,
          createdAt: Date.now(),
          garden: { ...nextGarden, name: existing.name }
        } : g
      );
      writeLayouts(updated);
      return true;
    },
    async getRequirementSummary(garden) {
      const requiredPlants = /* @__PURE__ */ new Map();
      const requiredDecors = /* @__PURE__ */ new Map();
      const aliasMap = getPlantAliasMap();
      const registerPlant = (id, mutation) => {
        if (!id) return;
        const key = mutationKeyFor(id, mutation);
        const entry = requiredPlants.get(key);
        if (entry) {
          entry.needed += 1;
        } else {
          requiredPlants.set(key, { id, mutation: mutation || void 0, needed: 1 });
        }
      };
      const registerDecor = (map, id) => {
        if (!id) return;
        map.set(id, (map.get(id) || 0) + 1);
      };
      const mapEntries = [
        ["Dirt", garden?.tileObjects || {}],
        ["Boardwalk", garden?.boardwalkTileObjects || {}]
      ];
      for (const [tileType, map] of mapEntries) {
        const ignored = getIgnoredSet(garden, tileType);
        for (const [key, obj] of Object.entries(map)) {
          const idx = Number(key);
          if (Number.isFinite(idx) && ignored.has(idx)) continue;
          if (!obj || typeof obj !== "object") continue;
          const type = String(obj.objectType || "").toLowerCase();
          if (type === "plant") {
            const rawSpecies = String(obj.species || obj.seedKey || "");
            const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
            const mutation = getDesiredMutation(obj);
            registerPlant(species || null, mutation);
          } else if (type === "decor") {
            const decorId = String(obj.decorId || obj.id || "");
            registerDecor(requiredDecors, decorId || null);
          }
        }
      }
      const inventory = await getInventoryCounts();
      const inventoryMutations = await getInventoryPlantMutationCounts(aliasMap);
      const current = await getCurrentGarden();
      const gardenPlantCounts = current ? countGardenPlants(current, aliasMap, getIgnoredSet(garden, "Dirt")) : /* @__PURE__ */ new Map();
      const gardenPlantMutations = current ? countGardenPlantsByMutation(current, aliasMap, getIgnoredSet(garden, "Dirt")) : /* @__PURE__ */ new Map();
      const gardenDecorCounts = current ? countGardenDecors(
        current,
        getIgnoredSet(garden, "Dirt"),
        getIgnoredSet(garden, "Boardwalk")
      ) : /* @__PURE__ */ new Map();
      const summary = [];
      for (const entry of requiredPlants.values()) {
        const id = entry.id;
        const mutation = entry.mutation;
        const key = mutationKeyFor(id, mutation);
        const have = mutation ? (inventoryMutations.get(key) || 0) + (gardenPlantMutations.get(key) || 0) : (inventory.plants.get(id) || 0) + (gardenPlantCounts.get(id) || 0);
        summary.push({ type: "plant", id, mutation, needed: entry.needed, have });
      }
      for (const [id, needed] of requiredDecors) {
        const have = (inventory.decors.get(id) || 0) + (gardenDecorCounts.get(id) || 0);
        summary.push({ type: "decor", id, needed, have });
      }
      summary.sort((a, b) => {
        if (a.type !== b.type) return a.type === "plant" ? -1 : 1;
        return a.id.localeCompare(b.id);
      });
      return summary;
    },
    resolvePlantSpecies(raw) {
      const aliasMap = getPlantAliasMap();
      return resolvePlantSpeciesKey(String(raw || ""), aliasMap);
    },
    normalizeMutation(raw) {
      return normalizeMutationTag(raw);
    },
    async getPlantAvailabilityCounts(ignoredTiles) {
      const aliasMap = getPlantAliasMap();
      const inventory = await getInventoryCounts();
      const current = await getCurrentGarden();
      const ignored = new Set(
        Array.isArray(ignoredTiles?.dirt) ? ignoredTiles.dirt.filter((n) => Number.isFinite(n)) : []
      );
      const gardenPlantCounts = current ? countGardenPlants(current, aliasMap, ignored) : /* @__PURE__ */ new Map();
      const combined = /* @__PURE__ */ new Map();
      for (const [id, count] of inventory.plants) {
        addCount(combined, id, count);
      }
      for (const [id, count] of gardenPlantCounts) {
        addCount(combined, id, count);
      }
      return combined;
    },
    async getPlantAvailabilityMutationCounts(ignoredTiles) {
      const aliasMap = getPlantAliasMap();
      const inventory = await getInventoryPlantMutationCounts(aliasMap);
      const current = await getCurrentGarden();
      const ignored = new Set(
        Array.isArray(ignoredTiles?.dirt) ? ignoredTiles.dirt.filter((n) => Number.isFinite(n)) : []
      );
      const gardenMutationCounts = current ? countGardenPlantsByMutation(current, aliasMap, ignored) : /* @__PURE__ */ new Map();
      const combined = /* @__PURE__ */ new Map();
      for (const [key, count] of inventory) {
        addCount(combined, key, count);
      }
      for (const [key, count] of gardenMutationCounts) {
        addCount(combined, key, count);
      }
      return combined;
    },
    async getDecorAvailabilityCounts(ignoredTiles) {
      const inventory = await getInventoryCounts();
      const current = await getCurrentGarden();
      const ignoredDirt = new Set(
        Array.isArray(ignoredTiles?.dirt) ? ignoredTiles.dirt.filter((n) => Number.isFinite(n)) : []
      );
      const ignoredBoard = new Set(
        Array.isArray(ignoredTiles?.boardwalk) ? ignoredTiles.boardwalk.filter((n) => Number.isFinite(n)) : []
      );
      const gardenDecorCounts = current ? countGardenDecors(current, ignoredDirt, ignoredBoard) : /* @__PURE__ */ new Map();
      const combined = /* @__PURE__ */ new Map();
      for (const [id, count] of inventory.decors) {
        addCount(combined, id, count);
      }
      for (const [id, count] of gardenDecorCounts) {
        addCount(combined, id, count);
      }
      return combined;
    },
    exportLayout(id) {
      if (!id) return null;
      const all = readLayouts();
      const found = all.find((g) => g.id === id);
      if (!found) return null;
      return JSON.stringify(found.garden, null, 2);
    },
    exportLoadouts() {
      return JSON.stringify(readLayouts(), null, 2);
    },
    importLoadouts(payload) {
      if (!payload) return { success: false, message: "Import payload is empty." };
      try {
        const parsed = JSON.parse(payload);
        const list = normalizeImportedLayouts(parsed);
        if (!list.length) {
          return { success: false, message: "No valid loadouts found in JSON." };
        }
        writeLayouts(list.slice(0, MAX_LAYOUTS));
        return { success: true, message: `Imported ${list.length} loadout(s).` };
      } catch {
        return { success: false, message: "Invalid JSON payload." };
      }
    },
    importLayout(name, raw) {
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        const garden = sanitizeGarden(parsed);
        const now = Date.now();
        const gardenData = sanitizeGarden(parsed);
        const saved = {
          id: `${now}-${Math.random().toString(16).slice(2)}`,
          name: name?.trim() || "Imported layout",
          createdAt: now,
          garden: { ...gardenData, name: name?.trim() || "Imported layout" }
        };
        const all = readLayouts();
        all.unshift(saved);
        writeLayouts(all.slice(0, MAX_LAYOUTS));
        return saved;
      } catch {
        return null;
      }
    },
    getEmptyGarden() {
      return { tileObjects: {}, boardwalkTileObjects: {}, ignoredTiles: { dirt: [], boardwalk: [] } };
    },
    async getCurrentGarden() {
      return getCurrentGarden();
    },
    async getInventoryFreeSlots() {
      return resolveInventoryFreeSlots();
    },
    async getTileGrid(type) {
      const pid = await getPlayerId();
      if (!pid) return [];
      const cur = await Store.select("stateAtom");
      const slots = cur?.child?.data?.userSlots;
      const slotMatch = findPlayerSlot(slots, pid, { sortObject: true });
      if (!slotMatch || !slotMatch.matchSlot) return [];
      const userSlotIdx = slotMatchToIndex(slotMatch);
      const mapData = await Store.select("mapAtom");
      const cols = Number(mapData?.cols);
      if (!mapData || !Number.isFinite(cols)) return [];
      const source = type === "Dirt" ? mapData?.globalTileIdxToDirtTile || {} : mapData?.globalTileIdxToBoardwalk || {};
      const out = [];
      for (const [gidxStr, v] of Object.entries(source)) {
        if (Number(v?.userSlotIdx) !== userSlotIdx) continue;
        const gidx = Number(gidxStr);
        if (!Number.isFinite(gidx)) continue;
        const localIdx = type === "Dirt" ? Number(v?.dirtTileIdx ?? -1) : Number(v?.boardwalkTileIdx ?? -1);
        if (!Number.isFinite(localIdx) || localIdx < 0) continue;
        out.push({ localIdx, x: gidx % cols, y: Math.floor(gidx / cols) });
      }
      return out;
    },
    async getClearSideTasks(draftGarden, opts) {
      const clearLeft = !!opts.clearLeft;
      const clearRight = !!opts.clearRight;
      if (!clearLeft && !clearRight) return { tasks: [], blocked: 0 };
      const current = await getCurrentGarden();
      if (!current) return { tasks: [], blocked: 0 };
      const [dirtTiles, boardTiles] = await Promise.all([
        this.getTileGrid("Dirt"),
        this.getTileGrid("Boardwalk")
      ]);
      const tasks = [];
      let blocked = 0;
      const ignoredDirt = getIgnoredSet(draftGarden, "Dirt");
      const ignoredBoardwalk = getIgnoredSet(draftGarden, "Boardwalk");
      const gatherTasks = (tileType, tiles, draftMap, currentMap) => {
        const bounds = getTileBounds(tiles);
        if (!bounds) return;
        for (const entry of tiles) {
          const ignored = tileType === "Dirt" ? ignoredDirt : ignoredBoardwalk;
          if (ignored.has(entry.localIdx)) continue;
          const side = getTileSide(entry.x, bounds);
          if (side === "left" && !clearLeft) continue;
          if (side === "right" && !clearRight) continue;
          if (draftMap[String(entry.localIdx)]) continue;
          const obj = currentMap[String(entry.localIdx)];
          if (!obj || typeof obj !== "object") continue;
          const objType = String(obj.objectType ?? obj.type ?? "").toLowerCase();
          if (objType === "plant") {
            tasks.push({ tileType: "Dirt", localIdx: entry.localIdx, action: "pot" });
          } else if (objType === "decor") {
            tasks.push({ tileType, localIdx: entry.localIdx, action: "pickup" });
          } else {
            blocked += 1;
          }
        }
      };
      gatherTasks("Dirt", dirtTiles, draftGarden.tileObjects || {}, current.tileObjects || {});
      gatherTasks(
        "Boardwalk",
        boardTiles,
        draftGarden.boardwalkTileObjects || {},
        current.boardwalkTileObjects || {}
      );
      return { tasks, blocked };
    },
    async clearSideTasks(tasks, slotsAvailable) {
      let slotsLeft = Math.max(0, Math.floor(Number(slotsAvailable) || 0));
      let cleared = 0;
      for (const task of tasks) {
        if (slotsLeft <= 0) break;
        try {
          if (task.action === "pot") {
            await PlayerService.potPlant(task.localIdx);
          } else {
            await PlayerService.pickupDecor(task.tileType, task.localIdx);
          }
        } catch {
        }
        slotsLeft -= 1;
        cleared += 1;
        await delay(60);
      }
      const skipped = Math.max(0, tasks.length - cleared);
      return { cleared, skipped };
    },
    async invertLayout(garden, tileType) {
      const safe = sanitizeGarden(garden);
      const [dirtTiles, boardTiles] = await Promise.all([
        this.getTileGrid("Dirt"),
        this.getTileGrid("Boardwalk")
      ]);
      const ignoredDirt = getIgnoredSet(safe, "Dirt");
      const ignoredBoardwalk = getIgnoredSet(safe, "Boardwalk");
      const nextTileObjects = tileType === "Boardwalk" ? safe.tileObjects || {} : mirrorTileMap(safe.tileObjects || {}, dirtTiles);
      const nextBoardwalkObjects = tileType === "Dirt" ? safe.boardwalkTileObjects || {} : mirrorTileMap(safe.boardwalkTileObjects || {}, boardTiles);
      const keepEggs = (source, target) => {
        for (const [key, obj] of Object.entries(source || {})) {
          if (!obj || typeof obj !== "object") continue;
          const type = String(obj.objectType ?? obj.type ?? "").toLowerCase();
          if (type !== "egg") continue;
          target[key] = obj;
        }
      };
      keepEggs(safe.tileObjects || {}, nextTileObjects);
      keepEggs(safe.boardwalkTileObjects || {}, nextBoardwalkObjects);
      return {
        tileObjects: nextTileObjects,
        boardwalkTileObjects: nextBoardwalkObjects,
        ignoredTiles: {
          dirt: tileType === "Boardwalk" ? Array.from(ignoredDirt.values()) : mirrorIgnoredTiles(ignoredDirt, dirtTiles),
          boardwalk: tileType === "Dirt" ? Array.from(ignoredBoardwalk.values()) : mirrorIgnoredTiles(ignoredBoardwalk, boardTiles)
        }
      };
    },
    buildTileObject(type, id) {
      if (type === "empty") return null;
      if (!id) return null;
      const now = Date.now();
      if (type === "plant") {
        const info = plantCatalog[id];
        const slotCount = Array.isArray(info?.plant?.slotOffsets) ? info.plant.slotOffsets.length : 1;
        const secondsToMature = Number(info?.plant?.secondsToMature) || 60;
        const end = now + secondsToMature * 1e3;
        const slots = Array.from({ length: slotCount }, () => ({
          species: id,
          startTime: now,
          endTime: end,
          targetScale: 1,
          mutations: []
        }));
        return {
          objectType: "plant",
          species: id,
          seedKey: id,
          plantedAt: now,
          maturedAt: end,
          slots
        };
      }
      if (type === "decor") {
        return {
          objectType: "decor",
          decorId: id,
          rotation: 0
        };
      }
      return {
        objectType: "egg",
        eggId: id,
        plantedAt: now,
        maturedAt: now + 60 * 1e3
      };
    },
    formatTileLabel(obj) {
      if (!obj) return "";
      const typ = String(obj.objectType || "");
      if (typ === "plant") {
        const species = String(obj.species || "");
        const display = PLANT_DISPLAY_NAME_OVERRIDES[species] || plantCatalog[species]?.crop?.name || plantCatalog[species]?.plant?.name;
        const mutation = getDesiredMutation(obj);
        const base = display || species || "Plant";
        return mutation ? `${base} (${mutation})` : base;
      }
      if (typ === "decor") {
        const decorId = String(obj.decorId || "");
        return decorCatalog[decorId]?.name || decorId || "Decor";
      }
      if (typ === "egg") {
        const eggId = String(obj.eggId || "");
        return eggCatalog[eggId]?.name || eggId || "Egg";
      }
      return "Item";
    },
    async applyGarden(garden, opts = {}) {
      const current = await getCurrentGarden();
      if (current) {
        const blocked = await getBlockedTargetTilesAsync(current, garden);
        if (blocked.length && !opts.clearTargetTiles) {
          const details = describeBlockedTiles(current, blocked).slice(0, 5).join(", ");
          await toastSimple(
            "Garden Layout",
            `Clear target tiles first. Blocked: ${details || blocked.length}`,
            "error"
          );
          return false;
        }
      }
      if (!opts.ignoreInventory) {
        const inventory = await getInventoryCounts();
        const missing = await buildMissingItems(garden, inventory, opts.clearTargetTiles ? current : null);
        if (missing.length) {
          await toastSimple("Garden Layout", `Missing items: ${formatMissingSummary(missing)}`, "error");
        }
      }
      if (opts.clearTargetTiles) {
        const blocked = current ? await getBlockedTargetTilesAsync(current, garden) : [];
        return applyGardenServerWithPotting(garden, blocked, {
          inventorySlotsAvailable: opts.inventorySlotsAvailable,
          allowClientSide: opts.ignoreInventory
        });
      }
      if (opts.ignoreInventory) return setCurrentGarden(garden);
      await toastSimple("Garden Layout", "Applying layout...", "info", 2e3);
      return applyGardenServer(garden);
    },
    async applySavedLayout(id, opts = {}) {
      if (!id) return false;
      const all = readLayouts();
      const found = all.find((g) => g.id === id);
      if (!found) return false;
      return this.applyGarden(found.garden, opts);
    },
    listPlantIds() {
      return Object.keys(plantCatalog || {});
    },
    listDecorIds() {
      return Object.keys(decorCatalog || {});
    },
    listEggIds() {
      return Object.keys(eggCatalog || {});
    },
    async debugPlantInventory() {
      const snapshot = await readPlantInventoryDebugSnapshot();
      const total = snapshot.length;
      if (!total) {
        await toastSimple("Garden Layout", "No plant items found in inventory.", "info", 2500);
        return;
      }
      const preview = snapshot.slice(0, 5).map((entry) => `${entry.species || "?"}:${entry.id || "?"}`).join(", ");
      await toastSimple(
        "Garden Layout",
        `Plant items: ${total}. Sample: ${preview || "n/a"}`,
        "info",
        3500
      );
      try {
        console.log("[GLC GardenLayout] Plant inventory snapshot", snapshot);
      } catch {
      }
    }
  };
  function readLayouts() {
    const parseList = (parsed) => {
      const arr = Array.isArray(parsed) ? parsed : [];
      return arr.map((g) => ({
        id: String(g?.id || ""),
        name: String(g?.name || g?.garden?.name || "Untitled"),
        createdAt: Number(g?.createdAt) || Date.now(),
        garden: sanitizeGarden(g?.garden || {})
      })).filter((g) => !!g.id);
    };
    try {
      const parsed = readAriesPath(ARIES_LAYOUTS_PATH);
      if (Array.isArray(parsed)) {
        return parseList(parsed);
      }
    } catch {
    }
    try {
      const parsed = readAriesPath(LEGACY_LAYOUTS_PATH);
      const list = parseList(parsed);
      if (list.length) {
        writeLayouts(list);
      }
      return list;
    } catch {
    }
    try {
      const raw = typeof window !== "undefined" ? window.localStorage?.getItem(LEGACY_LAYOUTS_KEY) : null;
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const list = parseList(parsed);
      if (list.length) {
        writeLayouts(list);
      }
      return list;
    } catch {
      return [];
    }
  }
  function writeLayouts(list) {
    try {
      writeAriesPath(ARIES_LAYOUTS_PATH, list || []);
    } catch {
    }
    try {
      if (typeof window !== "undefined") {
        window.localStorage?.setItem(LEGACY_LAYOUTS_KEY, JSON.stringify(list || []));
      }
    } catch {
    }
  }
  function normalizeImportedLayouts(raw) {
    const arr = Array.isArray(raw) ? raw : [];
    const out = [];
    for (const g of arr) {
      if (!g || typeof g !== "object") continue;
      const id = String(g?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const name = String(g?.name || g?.garden?.name || "Untitled").trim() || "Untitled";
      const createdAt = Number(g?.createdAt) || Date.now();
      const garden = sanitizeGarden(g?.garden || {});
      out.push({
        id,
        name,
        createdAt,
        garden: { ...garden, name }
      });
    }
    return out;
  }
  function sanitizeGarden(val) {
    const tileObjects = val && typeof val === "object" && typeof val.tileObjects === "object" ? val.tileObjects : {};
    const boardwalkTileObjects = val && typeof val === "object" && typeof val.boardwalkTileObjects === "object" ? val.boardwalkTileObjects : {};
    const ignoredTiles = sanitizeIgnoredTiles(val?.ignoredTiles);
    const stripEggs = (map) => {
      const next = {};
      for (const [key, obj] of Object.entries(map || {})) {
        if (!obj || typeof obj !== "object") continue;
        const type = String(obj.objectType || obj.type || "").toLowerCase();
        if (type === "egg") continue;
        next[key] = obj;
      }
      return next;
    };
    return {
      tileObjects: stripEggs(tileObjects),
      boardwalkTileObjects: stripEggs(boardwalkTileObjects),
      ignoredTiles
    };
  }
  function sanitizeGardenForPreview(val) {
    const tileObjects = val && typeof val === "object" && typeof val.tileObjects === "object" ? val.tileObjects : {};
    const boardwalkTileObjects = val && typeof val === "object" && typeof val.boardwalkTileObjects === "object" ? val.boardwalkTileObjects : {};
    const ignoredTiles = sanitizeIgnoredTiles(val?.ignoredTiles);
    return {
      tileObjects: { ...tileObjects },
      boardwalkTileObjects: { ...boardwalkTileObjects },
      ignoredTiles
    };
  }
  function sanitizeIgnoredTiles(raw) {
    const dirt = Array.isArray(raw?.dirt) ? raw.dirt : Array.isArray(raw?.Dirt) ? raw.Dirt : [];
    const boardwalk = Array.isArray(raw?.boardwalk) ? raw.boardwalk : Array.isArray(raw?.Boardwalk) ? raw.Boardwalk : [];
    const clean = (list) => Array.from(
      new Set(
        list.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n >= 0).map((n) => Math.floor(n))
      )
    );
    return { dirt: clean(dirt), boardwalk: clean(boardwalk) };
  }
  function getTileBounds(tiles) {
    if (!tiles.length) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const entry of tiles) {
      minX = Math.min(minX, entry.x);
      maxX = Math.max(maxX, entry.x);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null;
    return { minX, maxX };
  }
  function getTileSide(x, bounds) {
    const mid = bounds.minX + Math.floor((bounds.maxX - bounds.minX) / 2);
    return x <= mid ? "left" : "right";
  }
  function getIgnoredSet(garden, tileType) {
    const raw = tileType === "Dirt" ? garden?.ignoredTiles?.dirt : garden?.ignoredTiles?.boardwalk;
    if (!Array.isArray(raw)) return /* @__PURE__ */ new Set();
    return new Set(
      raw.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n >= 0).map((n) => Math.floor(n))
    );
  }
  function mirrorTileMap(source, tiles) {
    if (!tiles.length) return { ...source };
    let minX = Infinity;
    let maxX = -Infinity;
    const coordToLocal = /* @__PURE__ */ new Map();
    for (const entry of tiles) {
      minX = Math.min(minX, entry.x);
      maxX = Math.max(maxX, entry.x);
      coordToLocal.set(`${entry.x},${entry.y}`, entry.localIdx);
    }
    const next = {};
    for (const entry of tiles) {
      const obj = source[String(entry.localIdx)];
      if (!obj) continue;
      const mirroredX = minX + (maxX - entry.x);
      const targetLocal = coordToLocal.get(`${mirroredX},${entry.y}`);
      if (targetLocal == null) continue;
      next[String(targetLocal)] = obj;
    }
    return next;
  }
  function mirrorIgnoredTiles(source, tiles) {
    if (!tiles.length) return Array.from(source.values());
    let minX = Infinity;
    let maxX = -Infinity;
    const coordToLocal = /* @__PURE__ */ new Map();
    for (const entry of tiles) {
      minX = Math.min(minX, entry.x);
      maxX = Math.max(maxX, entry.x);
      coordToLocal.set(`${entry.x},${entry.y}`, entry.localIdx);
    }
    const next = /* @__PURE__ */ new Set();
    for (const entry of tiles) {
      if (!source.has(entry.localIdx)) continue;
      const mirroredX = minX + (maxX - entry.x);
      const targetLocal = coordToLocal.get(`${mirroredX},${entry.y}`);
      if (targetLocal == null) continue;
      next.add(targetLocal);
    }
    return Array.from(next.values());
  }
  async function getBlockedTargetTilesAsync(current, target) {
    if (tos.isReady()) {
      const pid = await getPlayerId();
      if (!pid) return getBlockedTargetTilesFromState(current, target);
      const cur = await Store.select("stateAtom");
      const slots = cur?.child?.data?.userSlots;
      const slotMatch = findPlayerSlot(slots, pid, { sortObject: true });
      if (!slotMatch || !slotMatch.matchSlot) return getBlockedTargetTilesFromState(current, target);
      const userSlotIdx = slotMatchToIndex(slotMatch);
      const mapData = await Store.select("mapAtom");
      const cols = Number(mapData?.cols);
      if (!mapData || !Number.isFinite(cols)) return getBlockedTargetTilesFromState(current, target);
      const dirtCoords = buildTileCoordMap(mapData, userSlotIdx, "Dirt");
      const boardCoords = buildTileCoordMap(mapData, userSlotIdx, "Boardwalk");
      const blocked = [];
      const check = (next, coordMap) => {
        for (const key of Object.keys(next || {})) {
          const localIdx = Number(key);
          if (!Number.isFinite(localIdx)) continue;
          const coords = coordMap.get(localIdx);
          if (!coords) continue;
          const info = tos.getTileObject(coords.x, coords.y, { ensureView: true });
          const curObj = info?.tileObject;
          if (isTileOccupied(curObj) && !isSameTileObject(curObj, next?.[key])) {
            blocked.push(localIdx);
          }
        }
      };
      check(target.tileObjects || {}, dirtCoords);
      check(target.boardwalkTileObjects || {}, boardCoords);
      return blocked;
    }
    return getBlockedTargetTilesFromState(current, target);
  }
  function buildTileCoordMap(mapData, userSlotIdx, type) {
    const map = /* @__PURE__ */ new Map();
    const source = type === "Dirt" ? mapData?.globalTileIdxToDirtTile || {} : mapData?.globalTileIdxToBoardwalk || {};
    const cols = Number(mapData?.cols);
    if (!Number.isFinite(cols)) return map;
    for (const [gidxStr, v] of Object.entries(source)) {
      if (Number(v?.userSlotIdx) !== userSlotIdx) continue;
      const gidx = Number(gidxStr);
      if (!Number.isFinite(gidx)) continue;
      const localIdx = type === "Dirt" ? Number(v?.dirtTileIdx ?? -1) : Number(v?.boardwalkTileIdx ?? -1);
      if (!Number.isFinite(localIdx) || localIdx < 0) continue;
      map.set(localIdx, { x: gidx % cols, y: Math.floor(gidx / cols) });
    }
    return map;
  }
  function getBlockedTargetTilesFromState(current, target) {
    const blocked = [];
    const check = (cur, next) => {
      for (const key of Object.keys(next || {})) {
        const curObj = cur?.[key];
        if (isTileOccupied(curObj) && !isSameTileObject(curObj, next?.[key])) {
          const n = Number(key);
          blocked.push(Number.isFinite(n) ? n : -1);
        }
      }
    };
    check(current.tileObjects || {}, target.tileObjects || {});
    check(current.boardwalkTileObjects || {}, target.boardwalkTileObjects || {});
    return blocked.filter((n) => n >= 0);
  }
  function isTileOccupied(obj) {
    if (!obj || typeof obj !== "object") return false;
    const typ = obj.objectType ?? obj.type;
    if (typeof typ === "string" && typ) return true;
    const markers = ["species", "seedKey", "decorId", "eggId"];
    return markers.some((k) => typeof obj[k] === "string" && obj[k]);
  }
  function isSameTileObject(a, b) {
    if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
    const typeA = String(a.objectType ?? a.type ?? "");
    const typeB = String(b.objectType ?? b.type ?? "");
    if (!typeA || !typeB || typeA !== typeB) return false;
    if (typeA === "plant") {
      return String(a.species || a.seedKey || "") === String(b.species || b.seedKey || "");
    }
    if (typeA === "decor") {
      return String(a.decorId || "") === String(b.decorId || "");
    }
    if (typeA === "egg") {
      return String(a.eggId || "") === String(b.eggId || "");
    }
    return false;
  }
  function describeBlockedTiles(current, blocked) {
    const lookup = (map, slot) => map?.[String(slot)];
    const results = [];
    for (const slot of blocked) {
      const obj = lookup(current.tileObjects || {}, slot) ?? lookup(current.boardwalkTileObjects || {}, slot);
      if (!obj || typeof obj !== "object") {
        results.push(String(slot));
        continue;
      }
      const typ = String(obj.objectType ?? obj.type ?? "item");
      const label = obj.species || obj.decorId || obj.eggId || "";
      results.push(`${slot}:${typ}${label ? `:${label}` : ""}`);
    }
    return results;
  }
  async function getPlayerId() {
    const player = await Store.select("playerAtom");
    const pid = player?.id ?? player?.playerId ?? null;
    return typeof pid === "string" && pid ? pid : null;
  }
  async function getUserSlotIdx(playerId) {
    try {
      const cur = await Store.select("stateAtom");
      const slots = cur?.child?.data?.userSlots;
      const slotMatch = findPlayerSlot(slots, playerId, { sortObject: true });
      if (!slotMatch || !slotMatch.matchSlot) return null;
      return slotMatchToIndex(slotMatch);
    } catch {
      return null;
    }
  }
  async function getCurrentGarden() {
    try {
      const pid = await getPlayerId();
      if (!pid) return null;
      return await getGardenForPlayer(pid);
    } catch {
      return null;
    }
  }
  async function resolveInventoryFreeSlots() {
    try {
      const inventory = await Store.select("myInventoryAtom");
      const items = Array.isArray(inventory?.items) ? inventory.items : Array.isArray(inventory?.inventory) ? inventory.inventory : Array.isArray(inventory?.inventory?.items) ? inventory.inventory.items : Array.isArray(inventory) ? inventory : [];
      const usedSlots = items.length;
      const capacity = inventory?.capacity ?? inventory?.maxSlots ?? inventory?.maxSize ?? inventory?.inventory?.capacity ?? inventory?.inventory?.maxSlots ?? inventory?.inventory?.maxSize ?? inventory?.data?.capacity ?? inventory?.data?.maxSlots ?? inventory?.data?.maxSize ?? 100;
      if (!Number.isFinite(capacity)) return null;
      const safeCapacity = Math.max(0, Math.floor(capacity));
      const freeSlots = Math.max(0, safeCapacity - usedSlots);
      return { usedSlots, capacity: safeCapacity, freeSlots };
    } catch {
      return null;
    }
  }
  async function getGardenForPlayer(playerId) {
    try {
      if (!playerId) return null;
      const cur = await Store.select("stateAtom");
      const slots = cur?.child?.data?.userSlots;
      const slotMatch = findPlayerSlot(slots, playerId, { sortObject: true });
      if (!slotMatch || !slotMatch.matchSlot) return null;
      const g = slotMatch.matchSlot?.data?.garden;
      return sanitizeGardenForPreview(g || {});
    } catch {
      return null;
    }
  }
  async function setCurrentGarden(nextGarden) {
    try {
      const pid = await getPlayerId();
      if (!pid) return false;
      const cur = await Store.select("stateAtom");
      const slots = cur?.child?.data?.userSlots;
      const slotMatch = findPlayerSlot(slots, pid, { sortObject: true });
      if (!slotMatch || !slotMatch.matchSlot) return false;
      const userSlotIdx = slotMatchToIndex(slotMatch);
      const updatedSlot = {
        ...slotMatch.matchSlot,
        data: {
          ...slotMatch.matchSlot?.data || {},
          garden: sanitizeGarden(nextGarden)
        }
      };
      const nextUserSlots = rebuildUserSlots(slotMatch, () => updatedSlot);
      const nextState = buildStateWithUserSlots(cur, nextUserSlots);
      await Store.set("stateAtom", nextState);
      try {
        await applyGardenToTos(nextGarden, userSlotIdx);
      } catch {
      }
      return true;
    } catch {
      return false;
    }
  }
  async function applyGardenToTos(garden, userSlotIdx) {
    if (!tos.isReady()) return;
    const mapData = await Store.select("mapAtom");
    const cols = Number(mapData?.cols);
    if (!mapData || !Number.isFinite(cols)) return;
    const dirtEntries = Object.entries(mapData?.globalTileIdxToDirtTile || {}).filter(
      ([, v]) => v?.userSlotIdx === userSlotIdx
    );
    const boardEntries = Object.entries(mapData?.globalTileIdxToBoardwalk || {}).filter(
      ([, v]) => v?.userSlotIdx === userSlotIdx
    );
    const applyEntry = (entry, type) => {
      const [gidxStr, v] = entry;
      const gidx = Number(gidxStr);
      if (!Number.isFinite(gidx)) return;
      const x = gidx % cols;
      const y = Math.floor(gidx / cols);
      const localIdx = type === "Dirt" ? Number(v?.dirtTileIdx ?? -1) : Number(v?.boardwalkTileIdx ?? -1);
      const obj = type === "Dirt" ? (garden.tileObjects || {})[String(localIdx)] : (garden.boardwalkTileObjects || {})[String(localIdx)];
      if (!obj) {
        tos.setTileEmpty(x, y, { ensureView: true, forceUpdate: true });
        return;
      }
      injectTileObjectRaw(x, y, obj);
      const typ = obj.objectType;
      if (typ === "plant") {
        tos.setTilePlant(
          x,
          y,
          {
            species: obj.species,
            plantedAt: obj.plantedAt,
            maturedAt: obj.maturedAt,
            slots: obj.slots
          },
          { ensureView: true, forceUpdate: true }
        );
      } else if (typ === "decor") {
        tos.setTileDecor(x, y, { rotation: obj.rotation }, { ensureView: true, forceUpdate: true });
      } else if (typ === "egg") {
        return;
      } else {
        tos.setTileEmpty(x, y, { ensureView: true, forceUpdate: true });
      }
    };
    dirtEntries.forEach((e) => applyEntry(e, "Dirt"));
    boardEntries.forEach((e) => applyEntry(e, "Boardwalk"));
  }
  async function applyGardenServer(garden) {
    try {
      const dirt = garden.tileObjects || {};
      const board = garden.boardwalkTileObjects || {};
      const actions = [];
      const dirtEntries = toChunkedEntries(dirt);
      for (const chunk of dirtEntries) {
        for (const [localIdx, obj] of chunk) {
          if (!obj || typeof obj !== "object") continue;
          const typ = String(obj.objectType || "");
          if (typ === "plant") {
            await toastSimple("Garden Layout", "Only potted plants are supported.", "error");
            return false;
          } else if (typ === "egg") {
            continue;
          } else if (typ === "decor") {
            const decorId = String(obj.decorId || "");
            if (decorId) {
              const rotation = Number(obj.rotation ?? 0);
              actions.push(() => PlayerService.placeDecor("Dirt", localIdx, decorId, rotation));
            }
          }
        }
        for (const action of actions) {
          await action();
          await delay(40);
        }
        actions.length = 0;
      }
      const boardEntries = toChunkedEntries(board);
      for (const chunk of boardEntries) {
        for (const [localIdx, obj] of chunk) {
          if (!obj || typeof obj !== "object") continue;
          const typ = String(obj.objectType || "");
          if (typ !== "decor") continue;
          const decorId = String(obj.decorId || "");
          if (decorId) {
            const rotation = Number(obj.rotation ?? 0);
            actions.push(() => PlayerService.placeDecor("Boardwalk", localIdx, decorId, rotation));
          }
        }
        for (const action of actions) {
          await action();
          await delay(40);
        }
        actions.length = 0;
      }
      return true;
    } catch {
      return false;
    }
  }
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function toChunkedEntries(map, chunkSize = 10) {
    const entries = [];
    for (const [key, obj] of Object.entries(map || {})) {
      const localIdx = Number(key);
      if (!Number.isFinite(localIdx)) continue;
      entries.push([localIdx, obj]);
    }
    entries.sort((a, b) => a[0] - b[0]);
    const chunks = [];
    for (let i = 0; i < entries.length; i += chunkSize) {
      chunks.push(entries.slice(i, i + chunkSize));
    }
    return chunks;
  }
  async function calculatePlanterPotsNeeded(garden, currentGarden) {
    const ignoredDirt = getIgnoredSet(garden, "Dirt");
    const aliasMap = getPlantAliasMap();
    let potsNeeded = 0;
    for (const [key, draftObj] of Object.entries(garden.tileObjects || {})) {
      const idx = Number(key);
      if (Number.isFinite(idx) && ignoredDirt.has(idx)) continue;
      if (!draftObj || typeof draftObj !== "object") continue;
      const curObj = (currentGarden.tileObjects || {})[key];
      if (!curObj || typeof curObj !== "object") continue;
      const curType = String(curObj.objectType || "").toLowerCase();
      if (curType === "plant") {
        const draftType = String(draftObj.objectType || "").toLowerCase();
        if (draftType === "plant") {
          const curSpecies = resolvePlantSpeciesKey(String(curObj.species || curObj.seedKey || ""), aliasMap);
          const draftSpecies = resolvePlantSpeciesKey(String(draftObj.species || draftObj.seedKey || ""), aliasMap);
          if (curSpecies !== draftSpecies) {
            potsNeeded += 1;
          }
        } else {
          potsNeeded += 1;
        }
      }
    }
    return potsNeeded;
  }
  async function applyGardenServerWithPotting(garden, blocked, opts) {
    const initialGarden = await getCurrentGarden();
    if (!initialGarden) return false;
    let currentGarden = initialGarden;
    const potsNeeded = await calculatePlanterPotsNeeded(garden, currentGarden);
    if (potsNeeded > 0) {
      const inventory = await getInventoryCounts();
      const potsOwned = inventory.tools.get("Planter Pot") || 0;
      if (potsNeeded > potsOwned) {
        const missing = potsNeeded - potsOwned;
        await toastSimple(
          "Garden Layout",
          `To apply this Layout you need ${potsNeeded} Planter Pots, you're missing ${missing} Planter Pots`,
          "error",
          4e3
        );
        return false;
      }
    }
    const rawSlots = Number(opts.inventorySlotsAvailable ?? 0);
    const configuredSlots = Number.isFinite(rawSlots) && rawSlots >= 1 ? Math.floor(rawSlots) : 10;
    let freeSlotInfo = await resolveInventoryFreeSlots();
    let availableSlots = freeSlotInfo?.freeSlots ?? configuredSlots;
    let slotsLeft = Number.isFinite(availableSlots) ? availableSlots : 0;
    if (blocked.length) {
      await toastSimple("Garden Layout", "Clearing target tiles...", "info", 1800);
    }
    const aliasMap = getPlantAliasMap();
    let invPlants = await readPlantInventoryBySpecies(aliasMap);
    let invPlantsByMutation = await readPlantInventoryBySpeciesWithMutations(aliasMap);
    let inventoryDirty = false;
    let inventoryFullWarned = false;
    let eggBlockedWarned = false;
    if (!invPlants.size) {
      await toastSimple("Garden Layout", "No potted plants detected in inventory.", "info", 2e3);
    }
    const blockedSet = new Set(blocked);
    const ignoredDirt = getIgnoredSet(garden, "Dirt");
    const ignoredBoardwalk = getIgnoredSet(garden, "Boardwalk");
    const desiredSpeciesBySlot = /* @__PURE__ */ new Map();
    const desiredMutationBySlot = /* @__PURE__ */ new Map();
    const desiredDecorBySlotDirt = /* @__PURE__ */ new Map();
    const desiredDecorBySlotBoardwalk = /* @__PURE__ */ new Map();
    for (const [key, obj] of Object.entries(garden.tileObjects || {})) {
      if (!obj || typeof obj !== "object") continue;
      const type = String(obj.objectType || "").toLowerCase();
      if (type === "decor") {
        const decorId = String(obj.decorId || "");
        const idx2 = Number(key);
        if (decorId && Number.isFinite(idx2) && !ignoredDirt.has(idx2)) {
          desiredDecorBySlotDirt.set(idx2, decorId);
        }
        continue;
      }
      if (type !== "plant") continue;
      const rawSpecies = String(obj.species || obj.seedKey || "");
      const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
      const idx = Number(key);
      if (!Number.isFinite(idx) || !species) continue;
      if (ignoredDirt.has(idx)) continue;
      desiredSpeciesBySlot.set(idx, species);
      desiredMutationBySlot.set(idx, getDesiredMutation(obj));
    }
    for (const [key, obj] of Object.entries(garden.boardwalkTileObjects || {})) {
      if (!obj || typeof obj !== "object") continue;
      const type = String(obj.objectType || "").toLowerCase();
      if (type !== "decor") continue;
      const decorId = String(obj.decorId || "");
      const idx = Number(key);
      if (decorId && Number.isFinite(idx) && !ignoredBoardwalk.has(idx)) {
        desiredDecorBySlotBoardwalk.set(idx, decorId);
      }
    }
    let gardenPlants = collectGardenPlantSlots(currentGarden, aliasMap, ignoredDirt);
    let mispositionedGardenPlants = /* @__PURE__ */ new Map();
    let mispositionedGardenDecors = /* @__PURE__ */ new Map();
    let decorCounts = /* @__PURE__ */ new Map();
    const mapData = await Store.select("mapAtom");
    const pid = await getPlayerId();
    let dirtCoords = /* @__PURE__ */ new Map();
    let boardCoords = /* @__PURE__ */ new Map();
    if (pid && mapData) {
      const cur = await Store.select("stateAtom");
      const slots = cur?.child?.data?.userSlots;
      const slotMatch = findPlayerSlot(slots, pid, { sortObject: true });
      if (slotMatch && slotMatch.matchSlot) {
        const userSlotIdx = slotMatchToIndex(slotMatch);
        dirtCoords = buildTileCoordMap(mapData, userSlotIdx, "Dirt");
        boardCoords = buildTileCoordMap(mapData, userSlotIdx, "Boardwalk");
      }
    }
    const processTile = async (tileType, localIdx, obj) => {
      if (!obj || typeof obj !== "object") return false;
      const ignoredSet = tileType === "Dirt" ? ignoredDirt : ignoredBoardwalk;
      if (ignoredSet.has(localIdx)) return false;
      const desiredType = String(obj.objectType || "");
      const desiredMutation = desiredType === "plant" ? getDesiredMutation(obj) : null;
      const desiredSpecies = desiredType === "plant" ? resolvePlantSpeciesKey(String(obj.species || obj.seedKey || ""), aliasMap) : "";
      let changed = false;
      if (tileType === "Boardwalk") {
        const curObj2 = getCurrentTileObject(currentGarden, tileType, localIdx, boardCoords);
        const curType2 = String(curObj2?.objectType ?? curObj2?.type ?? "");
        const curDecorId = curType2 === "decor" ? String(curObj2?.decorId || "") : "";
        if (curObj2 && desiredType && isSameTileObject(curObj2, obj)) {
          return false;
        }
        if (curObj2) {
          await PlayerService.pickupDecor("Boardwalk", localIdx);
          if (curDecorId) {
            addCount(decorCounts, curDecorId, 1);
            removeGardenDecorSlot(mispositionedGardenDecors, curDecorId, "Boardwalk", localIdx);
          }
          await delay(50);
          changed = true;
        }
        if (desiredType === "decor") {
          const decorId = String(obj.decorId || "");
          if (decorId) {
            const ok = await ensureDecorAvailable(
              decorCounts,
              mispositionedGardenDecors,
              decorId,
              "Boardwalk",
              localIdx
            );
            if (!ok) {
              return changed;
            }
            await PlayerService.placeDecor("Boardwalk", localIdx, decorId, Number(obj.rotation ?? 0));
            await delay(40);
            changed = true;
          }
        }
        return changed;
      }
      const curObj = getCurrentTileObject(currentGarden, tileType, localIdx, dirtCoords);
      const curType = String(curObj?.objectType ?? curObj?.type ?? "");
      if (curObj && desiredType && isSameTileObject(curObj, obj)) {
        if (!desiredMutation || plantHasMutation(curObj, desiredMutation)) {
          return false;
        }
      }
      if (curObj && desiredType === "plant" && curType === "plant") {
        const curRawSpecies = String(curObj?.species || curObj?.seedKey || "");
        const desiredRawSpecies = String(obj.species || obj.seedKey || "");
        const curSpecies = resolvePlantSpeciesKey(curRawSpecies, aliasMap);
        const desiredSpecies2 = resolvePlantSpeciesKey(desiredRawSpecies, aliasMap);
        if (curSpecies && desiredSpecies2 && curSpecies === desiredSpecies2) {
          if (!desiredMutation || plantHasMutation(curObj, desiredMutation)) {
            return false;
          }
        }
      }
      if (curObj) {
        if (curType === "plant") {
          if (slotsLeft <= 0) {
            if (!inventoryFullWarned) {
              inventoryFullWarned = true;
              const debug = `Slots setting: ${availableSlots}, remaining: ${slotsLeft}.`;
              await toastSimple("Garden Layout", `Inventory full. Free slots and retry. ${debug}`, "error");
              try {
                console.warn("[GLC GardenLayout] Inventory full debug", {
                  availableSlots,
                  slotsLeft,
                  inventoryDirty,
                  pottedInventorySpecies: invPlants?.size ?? 0
                });
              } catch {
              }
            }
            return false;
          }
          await PlayerService.potPlant(localIdx);
          slotsLeft -= 1;
          inventoryDirty = true;
          changed = true;
        } else if (curType === "egg") {
          if (!eggBlockedWarned) {
            eggBlockedWarned = true;
            await toastSimple("Garden Layout", "Remove eggs on target tiles before applying.", "error");
          }
          return false;
        } else {
          const curDecorId = String(curObj?.decorId || "");
          await PlayerService.pickupDecor("Dirt", localIdx);
          if (curDecorId) {
            addCount(decorCounts, curDecorId, 1);
            removeGardenDecorSlot(mispositionedGardenDecors, curDecorId, "Dirt", localIdx);
          }
          changed = true;
        }
        await delay(50);
      }
      if (desiredType === "plant") {
        const rawSpecies = String(obj.species || obj.seedKey || "");
        const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
        let list = desiredMutation ? getPlantListByMutation(invPlantsByMutation, species, desiredMutation) : getPlantListBySpecies(invPlants, species);
        const mispositionedSlots = mispositionedGardenPlants.get(species) || [];
        if (mispositionedSlots.length && slotsLeft > 0) {
          const pottedFromGarden = desiredMutation ? await potGardenPlantsBatchWithMutation(
            currentGarden,
            mispositionedGardenPlants,
            species,
            desiredMutation,
            1,
            localIdx
          ) : await potGardenPlantsBatch(mispositionedGardenPlants, species, 1, localIdx);
          if (pottedFromGarden > 0) {
            slotsLeft -= pottedFromGarden;
            await delay(160);
            invPlants = await readPlantInventoryBySpecies(aliasMap);
            invPlantsByMutation = await readPlantInventoryBySpeciesWithMutations(aliasMap);
            inventoryDirty = false;
            list = desiredMutation ? getPlantListByMutation(invPlantsByMutation, species, desiredMutation) : getPlantListBySpecies(invPlants, species);
            changed = true;
          }
        }
        if ((!list || !list.length) && inventoryDirty) {
          invPlants = await readPlantInventoryBySpecies(aliasMap);
          invPlantsByMutation = await readPlantInventoryBySpeciesWithMutations(aliasMap);
          inventoryDirty = false;
          list = desiredMutation ? getPlantListByMutation(invPlantsByMutation, species, desiredMutation) : getPlantListBySpecies(invPlants, species);
        }
        if (!list || !list.length) {
          if (slotsLeft <= 0) {
            if (!inventoryFullWarned) {
              inventoryFullWarned = true;
              const debug = `Slots setting: ${availableSlots}, remaining: ${slotsLeft}.`;
              await toastSimple("Garden Layout", `Inventory full. Free slots and retry. ${debug}`, "error");
              try {
                console.warn("[GLC GardenLayout] Inventory full debug", {
                  availableSlots,
                  slotsLeft,
                  inventoryDirty,
                  pottedInventorySpecies: invPlants?.size ?? 0
                });
              } catch {
              }
            }
            return changed;
          }
          const potted = desiredMutation ? await potGardenPlantsBatchWithMutation(
            currentGarden,
            gardenPlants,
            species,
            desiredMutation,
            slotsLeft,
            localIdx
          ) : await potGardenPlantsBatch(gardenPlants, species, slotsLeft, localIdx);
          if (potted > 0) {
            slotsLeft -= potted;
            await delay(160);
            invPlants = await readPlantInventoryBySpecies(aliasMap);
            invPlantsByMutation = await readPlantInventoryBySpeciesWithMutations(aliasMap);
            inventoryDirty = false;
            list = desiredMutation ? getPlantListByMutation(invPlantsByMutation, species, desiredMutation) : getPlantListBySpecies(invPlants, species);
            changed = true;
          }
        }
        if (list && list.length) {
          const itemId = list.shift();
          await PlayerService.plantGardenPlant(localIdx, itemId);
          slotsLeft += 1;
          await delay(80);
          changed = true;
        } else {
          return changed;
        }
      } else if (desiredType === "decor") {
        const decorId = String(obj.decorId || "");
        if (decorId) {
          const ok = await ensureDecorAvailable(decorCounts, mispositionedGardenDecors, decorId, "Dirt", localIdx);
          if (!ok) {
            return changed;
          }
          await PlayerService.placeDecor("Dirt", localIdx, decorId, Number(obj.rotation ?? 0));
          changed = true;
        }
      } else if (desiredType === "egg") {
        return changed;
      }
      await delay(50);
      return changed;
    };
    try {
      const groupDirtEntries = () => {
        const bySpecies = /* @__PURE__ */ new Map();
        const byDecor = /* @__PURE__ */ new Map();
        const others = [];
        for (const [localIdx, obj] of toChunkedEntries(garden.tileObjects || {}).flat()) {
          if (ignoredDirt.has(localIdx)) continue;
          if (!obj || typeof obj !== "object") continue;
          const desiredType = String(obj.objectType || "").toLowerCase();
          if (desiredType === "plant") {
            const rawSpecies = String(obj.species || obj.seedKey || "");
            const species = resolvePlantSpeciesKey(rawSpecies, aliasMap) || rawSpecies;
            if (!bySpecies.has(species)) bySpecies.set(species, []);
            bySpecies.get(species).push([localIdx, obj]);
          } else if (desiredType === "decor") {
            const decorId = String(obj.decorId || "");
            if (!byDecor.has(decorId)) byDecor.set(decorId, []);
            byDecor.get(decorId).push([localIdx, obj]);
          } else {
            others.push([localIdx, obj]);
          }
        }
        const ordered = [];
        Array.from(bySpecies.keys()).sort((a, b) => a.localeCompare(b)).forEach((species) => {
          ordered.push(...bySpecies.get(species));
        });
        Array.from(byDecor.keys()).sort((a, b) => a.localeCompare(b)).forEach((decorId) => {
          ordered.push(...byDecor.get(decorId));
        });
        ordered.push(...others);
        return ordered;
      };
      const groupBoardEntries = () => {
        const byDecor = /* @__PURE__ */ new Map();
        const others = [];
        for (const [localIdx, obj] of toChunkedEntries(garden.boardwalkTileObjects || {}).flat()) {
          if (ignoredBoardwalk.has(localIdx)) continue;
          if (!obj || typeof obj !== "object") continue;
          const desiredType = String(obj.objectType || "").toLowerCase();
          if (desiredType === "decor") {
            const decorId = String(obj.decorId || "");
            if (!byDecor.has(decorId)) byDecor.set(decorId, []);
            byDecor.get(decorId).push([localIdx, obj]);
          } else {
            others.push([localIdx, obj]);
          }
        }
        const ordered = [];
        Array.from(byDecor.keys()).sort((a, b) => a.localeCompare(b)).forEach((decorId) => {
          ordered.push(...byDecor.get(decorId));
        });
        ordered.push(...others);
        return ordered;
      };
      const MAX_PASSES = 50;
      let finalPass = 0;
      for (let pass = 0; pass < MAX_PASSES; pass += 1) {
        const nextCurrent = await getCurrentGarden();
        if (!nextCurrent) break;
        currentGarden = nextCurrent;
        freeSlotInfo = await resolveInventoryFreeSlots();
        availableSlots = freeSlotInfo?.freeSlots ?? configuredSlots;
        slotsLeft = Number.isFinite(availableSlots) ? availableSlots : 0;
        gardenPlants = collectGardenPlantSlots(currentGarden, aliasMap, ignoredDirt);
        mispositionedGardenPlants = (() => {
          const map = /* @__PURE__ */ new Map();
          for (const [key, obj] of Object.entries(currentGarden.tileObjects || {})) {
            const idx = Number(key);
            if (Number.isFinite(idx) && ignoredDirt.has(idx)) continue;
            if (!obj || typeof obj !== "object") continue;
            const type = String(obj.objectType || "").toLowerCase();
            if (type !== "plant") continue;
            const rawSpecies = String(obj.species || obj.seedKey || "");
            const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
            if (!Number.isFinite(idx) || !species) continue;
            const desired = desiredSpeciesBySlot.get(idx);
            const desiredMutation = desiredMutationBySlot.get(idx) || null;
            if (desired && desired === species) {
              if (!desiredMutation || plantHasMutation(obj, desiredMutation)) continue;
            }
            if (!map.has(species)) map.set(species, []);
            map.get(species).push(idx);
          }
          return map;
        })();
        mispositionedGardenDecors = (() => {
          const map = /* @__PURE__ */ new Map();
          const addSlots = (tileType, entries, desiredMap, ignored) => {
            for (const [key, obj] of Object.entries(entries || {})) {
              const idx = Number(key);
              if (Number.isFinite(idx) && ignored.has(idx)) continue;
              if (!obj || typeof obj !== "object") continue;
              const type = String(obj.objectType || "").toLowerCase();
              if (type !== "decor") continue;
              const decorId = String(obj.decorId || "");
              if (!decorId || !Number.isFinite(idx)) continue;
              const desired = desiredMap.get(idx);
              if (desired && desired === decorId) continue;
              if (!map.has(decorId)) map.set(decorId, []);
              map.get(decorId).push({ tileType, localIdx: idx });
            }
          };
          addSlots("Dirt", currentGarden.tileObjects || {}, desiredDecorBySlotDirt, ignoredDirt);
          addSlots(
            "Boardwalk",
            currentGarden.boardwalkTileObjects || {},
            desiredDecorBySlotBoardwalk,
            ignoredBoardwalk
          );
          return map;
        })();
        const inventory = await getInventoryCounts();
        decorCounts = new Map(inventory.decors);
        if (inventoryDirty) {
          invPlants = await readPlantInventoryBySpecies(aliasMap);
          invPlantsByMutation = await readPlantInventoryBySpeciesWithMutations(aliasMap);
          inventoryDirty = false;
        }
        let passChanges = 0;
        const dirtEntries = groupDirtEntries();
        for (const [localIdx, obj] of dirtEntries) {
          if (blockedSet.size && !blockedSet.has(localIdx) && !getCurrentTileObject(currentGarden, "Dirt", localIdx, dirtCoords)) {
          }
          if (await processTile("Dirt", localIdx, obj)) passChanges += 1;
        }
        const boardEntries = groupBoardEntries();
        for (const [localIdx, obj] of boardEntries) {
          if (await processTile("Boardwalk", localIdx, obj)) passChanges += 1;
        }
        finalPass = pass + 1;
        if (passChanges === 0) break;
        await delay(140);
      }
      try {
        console.log(`[GLC GardenLayout] Attempts ${finalPass}/${MAX_PASSES} finished`);
      } catch {
      }
    } catch (err) {
      if (!opts.allowClientSide) return false;
      return setCurrentGarden(garden);
    }
    return true;
  }
  function getCurrentTileObject(current, tileType, localIdx, coordMap) {
    if (tos.isReady()) {
      const coords = coordMap.get(localIdx);
      if (coords) {
        const info = tos.getTileObject(coords.x, coords.y, { ensureView: true });
        return info?.tileObject ?? null;
      }
    }
    return tileType === "Dirt" ? (current.tileObjects || {})[String(localIdx)] : (current.boardwalkTileObjects || {})[String(localIdx)];
  }
  async function readPlantInventoryBySpecies(aliasMap = getPlantAliasMap()) {
    const map = /* @__PURE__ */ new Map();
    try {
      const inventory = await Store.select("myInventoryAtom");
      const items = extractInventoryItems(inventory);
      for (const entry of items) {
        if (!entry || typeof entry !== "object") continue;
        const source = entry.item && typeof entry.item === "object" ? entry.item : entry;
        if (!source || typeof source !== "object") continue;
        const type = String(source.itemType ?? source.data?.itemType ?? source.type ?? "").toLowerCase();
        if (!type.includes("plant")) continue;
        const rawSpecies = source.species ?? source.plantSpecies ?? source.seedSpecies ?? source.cropSpecies ?? source.baseSpecies ?? source.itemSpecies ?? source.data?.plantSpecies ?? source.data?.species ?? (Array.isArray(source.slots) && source.slots[0]?.species ? source.slots[0].species : "");
        const species = resolvePlantSpeciesKey(String(rawSpecies || ""), aliasMap);
        const id = String(source.id ?? source.plantId ?? source.itemId ?? source.data?.id ?? "");
        if (!species || !id) continue;
        if (!map.has(species)) map.set(species, []);
        map.get(species).push(id);
      }
    } catch {
    }
    return map;
  }
  function getInventoryPlantMutations(source) {
    const out = /* @__PURE__ */ new Set();
    const slots = Array.isArray(source?.slots) ? source.slots : Array.isArray(source?.data?.slots) ? source.data.slots : [];
    for (const slot of slots) {
      const list = normalizeMutationList(slot?.mutations);
      for (const mut of list) out.add(mut);
    }
    if (Array.isArray(source?.mutations)) {
      const list = normalizeMutationList(source.mutations);
      for (const mut of list) out.add(mut);
    }
    return Array.from(out);
  }
  async function readPlantInventoryBySpeciesWithMutations(aliasMap = getPlantAliasMap()) {
    const map = /* @__PURE__ */ new Map();
    try {
      const inventory = await Store.select("myInventoryAtom");
      const items = extractInventoryItems(inventory);
      for (const entry of items) {
        if (!entry || typeof entry !== "object") continue;
        const source = entry.item && typeof entry.item === "object" ? entry.item : entry;
        if (!source || typeof source !== "object") continue;
        const type = String(source.itemType ?? source.data?.itemType ?? source.type ?? "").toLowerCase();
        if (!type.includes("plant")) continue;
        const rawSpecies = source.species ?? source.plantSpecies ?? source.seedSpecies ?? source.cropSpecies ?? source.baseSpecies ?? source.itemSpecies ?? source.data?.plantSpecies ?? source.data?.species ?? (Array.isArray(source.slots) && source.slots[0]?.species ? source.slots[0].species : "");
        const species = resolvePlantSpeciesKey(String(rawSpecies || ""), aliasMap);
        const id = String(source.id ?? source.plantId ?? source.itemId ?? source.data?.id ?? "");
        if (!species || !id) continue;
        const mutations = getInventoryPlantMutations(source);
        if (!map.has(species)) map.set(species, []);
        map.get(species).push({ id, mutations });
      }
    } catch {
    }
    return map;
  }
  async function readPlantInventoryDebugSnapshot() {
    const out = [];
    try {
      const inventory = await Store.select("myInventoryAtom");
      const items = extractInventoryItems(inventory);
      const aliasMap = getPlantAliasMap();
      for (const entry of items) {
        if (!entry || typeof entry !== "object") continue;
        const source = entry.item && typeof entry.item === "object" ? entry.item : entry;
        if (!source || typeof source !== "object") continue;
        const itemType = String(source.itemType ?? source.data?.itemType ?? source.type ?? "");
        const rawSpecies = source.species ?? source.plantSpecies ?? source.seedSpecies ?? source.cropSpecies ?? source.baseSpecies ?? source.itemSpecies ?? source.data?.plantSpecies ?? source.data?.species ?? (Array.isArray(source.slots) && source.slots[0]?.species ? source.slots[0].species : "");
        const species = resolvePlantSpeciesKey(String(rawSpecies || ""), aliasMap);
        const id = String(source.id ?? source.plantId ?? source.itemId ?? source.data?.id ?? "");
        if (!itemType) continue;
        if (!String(itemType).toLowerCase().includes("plant")) continue;
        out.push({
          id,
          species,
          rawSpecies: String(rawSpecies || ""),
          itemType: String(itemType)
        });
      }
    } catch {
    }
    return out;
  }
  function normalizeSpeciesKey(value) {
    return value.toLowerCase().replace(/['’`]/g, "").replace(/\s+/g, "").replace(/-/g, "").replace(/(seed|plant|baby|fruit|crop)$/i, "");
  }
  function buildPlantSpeciesAliasMap() {
    const map = /* @__PURE__ */ new Map();
    const register = (key, species) => {
      if (typeof key !== "string") return;
      const normalized = normalizeSpeciesKey(key.trim());
      if (!normalized) return;
      if (!map.has(normalized)) map.set(normalized, species);
    };
    for (const [species, entry] of Object.entries(plantCatalog)) {
      register(species, species);
      register(entry?.seed?.name, species);
      register(entry?.plant?.name, species);
      register(entry?.crop?.name, species);
    }
    return map;
  }
  var cachedAliasMap = null;
  function getPlantAliasMap() {
    if (!cachedAliasMap) {
      cachedAliasMap = buildPlantSpeciesAliasMap();
    }
    return cachedAliasMap;
  }
  function resolvePlantSpeciesKey(raw, aliasMap) {
    if (!raw) return "";
    if (plantCatalog?.[raw]) return raw;
    const normalized = normalizeSpeciesKey(raw);
    const mapped = aliasMap.get(normalized);
    if (mapped) return mapped;
    for (const key of Object.keys(plantCatalog)) {
      if (normalizeSpeciesKey(key) === normalized) return key;
    }
    return raw;
  }
  var mutationKeys = new Set(Object.keys(mutationCatalog || {}));
  function normalizeMutationTag(value) {
    const raw = typeof value === "string" ? value : value == null ? "" : String(value);
    const trimmed = raw.trim();
    if (!trimmed) return "";
    const collapsed = trimmed.toLowerCase().replace(/[\s_-]+/g, "");
    switch (collapsed) {
      case "gold":
        return "Gold";
      case "rainbow":
        return "Rainbow";
      case "wet":
        return "Wet";
      case "chilled":
        return "Chilled";
      case "frozen":
        return "Frozen";
      case "dawn":
      case "dawnlit":
      case "dawnlight":
        return "Dawnlit";
      case "dawnbound":
      case "dawncharged":
      case "dawnradiant":
        return "Dawncharged";
      case "amberlit":
      case "amberlight":
      case "amberglow":
      case "ambershine":
        return "Amberlit";
      case "amberbound":
      case "ambercharged":
      case "amberradiant":
        return "Ambercharged";
      default: {
        if (mutationKeys.has(trimmed)) return trimmed;
        const normalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
        return mutationKeys.has(normalized) ? normalized : trimmed;
      }
    }
  }
  function normalizeMutationList(raw) {
    if (!Array.isArray(raw)) return [];
    const out = /* @__PURE__ */ new Set();
    for (const entry of raw) {
      const normalized = normalizeMutationTag(entry);
      if (normalized) out.add(normalized);
    }
    return Array.from(out);
  }
  function getPlantMutations(obj) {
    if (!obj || typeof obj !== "object") return [];
    const slots = Array.isArray(obj.slots) ? obj.slots : Array.isArray(obj.data?.slots) ? obj.data.slots : [];
    const out = /* @__PURE__ */ new Set();
    for (const slot of slots) {
      const list = normalizeMutationList(slot?.mutations);
      for (const mut of list) out.add(mut);
    }
    return Array.from(out);
  }
  function getDesiredMutation(obj) {
    const raw = typeof obj?.glcMutation === "string" ? obj.glcMutation : "";
    const normalized = normalizeMutationTag(raw);
    return normalized || null;
  }
  function plantHasMutation(obj, mutation) {
    if (!mutation) return false;
    const muts = getPlantMutations(obj);
    return muts.includes(mutation);
  }
  function mutationKeyFor(species, mutation) {
    return `${species}::${mutation || ""}`;
  }
  function getPlantListBySpecies(map, species) {
    if (!species) return void 0;
    const direct = map.get(species);
    if (direct) return direct;
    const normalized = normalizeSpeciesKey(species);
    for (const [key, value] of map.entries()) {
      if (normalizeSpeciesKey(key) === normalized) return value;
    }
    return void 0;
  }
  function getPlantListByMutation(map, species, mutation) {
    if (!species || !mutation) return void 0;
    const direct = map.get(species) || [];
    const normalized = normalizeSpeciesKey(species);
    const entries = direct.length ? direct : Array.from(map.entries()).filter(([key]) => normalizeSpeciesKey(key) === normalized).flatMap(([, value]) => value);
    if (!entries.length) return void 0;
    const matched = entries.filter((entry) => entry.mutations.includes(mutation)).map((entry) => entry.id);
    return matched.length ? matched : void 0;
  }
  function countGardenPlants(current, aliasMap, ignored = /* @__PURE__ */ new Set()) {
    const map = /* @__PURE__ */ new Map();
    for (const [key, obj] of Object.entries(current.tileObjects || {})) {
      const idx = Number(key);
      if (Number.isFinite(idx) && ignored.has(idx)) continue;
      if (!obj || typeof obj !== "object") continue;
      const type = String(obj.objectType || "").toLowerCase();
      if (type !== "plant") continue;
      const rawSpecies = String(obj.species || obj.seedKey || "");
      const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
      addCount(map, species, 1);
    }
    return map;
  }
  function countGardenPlantsByMutation(current, aliasMap, ignored = /* @__PURE__ */ new Set()) {
    const map = /* @__PURE__ */ new Map();
    for (const [key, obj] of Object.entries(current.tileObjects || {})) {
      const idx = Number(key);
      if (Number.isFinite(idx) && ignored.has(idx)) continue;
      if (!obj || typeof obj !== "object") continue;
      const type = String(obj.objectType || "").toLowerCase();
      if (type !== "plant") continue;
      const rawSpecies = String(obj.species || obj.seedKey || "");
      const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
      const mutations = getPlantMutations(obj);
      for (const mutation of mutations) {
        addCount(map, mutationKeyFor(species, mutation), 1);
      }
    }
    return map;
  }
  function countGardenDecors(current, ignoredDirt = /* @__PURE__ */ new Set(), ignoredBoardwalk = /* @__PURE__ */ new Set()) {
    const map = /* @__PURE__ */ new Map();
    const count = (entries, ignored) => {
      for (const [key, obj] of Object.entries(entries || {})) {
        const idx = Number(key);
        if (Number.isFinite(idx) && ignored.has(idx)) continue;
        if (!obj || typeof obj !== "object") continue;
        const type = String(obj.objectType || "").toLowerCase();
        if (type !== "decor") continue;
        const decorId = String(obj.decorId || "");
        addCount(map, decorId, 1);
      }
    };
    count(current.tileObjects || {}, ignoredDirt);
    count(current.boardwalkTileObjects || {}, ignoredBoardwalk);
    return map;
  }
  function collectGardenPlantSlots(current, aliasMap, ignored = /* @__PURE__ */ new Set()) {
    const map = /* @__PURE__ */ new Map();
    for (const [key, obj] of Object.entries(current.tileObjects || {})) {
      const idx = Number(key);
      if (Number.isFinite(idx) && ignored.has(idx)) continue;
      if (!obj || typeof obj !== "object") continue;
      const type = String(obj.objectType || "").toLowerCase();
      if (type !== "plant") continue;
      const rawSpecies = String(obj.species || obj.seedKey || "");
      const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
      if (!Number.isFinite(idx)) continue;
      if (!map.has(species)) map.set(species, []);
      map.get(species).push(idx);
    }
    return map;
  }
  function removeGardenDecorSlot(map, decorId, tileType, localIdx) {
    const list = map.get(decorId);
    if (!list || !list.length) return;
    const idx = list.findIndex((slot) => slot.tileType === tileType && slot.localIdx === localIdx);
    if (idx >= 0) list.splice(idx, 1);
  }
  function takeGardenDecorSlot(map, decorId, excludeType, excludeIdx) {
    const list = map.get(decorId);
    if (!list || !list.length) return null;
    let idx = list.findIndex((slot) => slot.tileType !== excludeType || slot.localIdx !== excludeIdx);
    if (idx < 0) idx = 0;
    const picked = list.splice(idx, 1)[0];
    return picked || null;
  }
  async function ensureDecorAvailable(counts, slots, decorId, excludeType, excludeIdx) {
    const have = counts.get(decorId) || 0;
    if (have > 0) {
      counts.set(decorId, have - 1);
      return true;
    }
    const picked = takeGardenDecorSlot(slots, decorId, excludeType, excludeIdx);
    if (!picked) return false;
    await PlayerService.pickupDecor(picked.tileType, picked.localIdx);
    addCount(counts, decorId, 1);
    counts.set(decorId, (counts.get(decorId) || 0) - 1);
    await delay(60);
    return true;
  }
  function takeGardenPlantSlot(map, species, excludeIdx) {
    const list = map.get(species);
    if (!list || !list.length) return null;
    let idx = list.findIndex((value) => value !== excludeIdx);
    if (idx < 0) idx = 0;
    const picked = list.splice(idx, 1)[0];
    return Number.isFinite(picked) ? picked : null;
  }
  async function potGardenPlantsBatch(map, species, maxCount, excludeIdx) {
    let count = 0;
    const limit = Math.max(0, Math.floor(maxCount));
    while (count < limit) {
      const sourceIdx = takeGardenPlantSlot(map, species, excludeIdx);
      if (sourceIdx == null) break;
      await PlayerService.potPlant(sourceIdx);
      count += 1;
      await delay(60);
    }
    return count;
  }
  function takeGardenPlantSlotWithMutation(current, map, species, mutation, excludeIdx) {
    const list = map.get(species);
    if (!list || !list.length) return null;
    for (let i = 0; i < list.length; i++) {
      const idx = list[i];
      if (idx === excludeIdx) continue;
      const obj = (current.tileObjects || {})[String(idx)];
      if (obj && plantHasMutation(obj, mutation)) {
        list.splice(i, 1);
        return idx;
      }
    }
    return null;
  }
  async function potGardenPlantsBatchWithMutation(current, map, species, mutation, maxCount, excludeIdx) {
    let count = 0;
    const limit = Math.max(0, Math.floor(maxCount));
    while (count < limit) {
      const sourceIdx = takeGardenPlantSlotWithMutation(current, map, species, mutation, excludeIdx);
      if (sourceIdx == null) break;
      await PlayerService.potPlant(sourceIdx);
      count += 1;
      await delay(60);
    }
    return count;
  }
  function injectTileObjectRaw(tx, ty, obj) {
    try {
      const info = tos.getTileObject(tx, ty, { ensureView: true });
      const tv = info?.tileView;
      if (!tv || typeof tv.onDataChanged !== "function") return false;
      const cloned = (() => {
        try {
          return JSON.parse(JSON.stringify(obj));
        } catch {
          return obj;
        }
      })();
      tv.onDataChanged(cloned);
      const status = tos.getStatus();
      const ctx2 = status.engine?.reusableContext;
      if (ctx2 && typeof tv.update === "function") {
        try {
          tv.update(ctx2);
        } catch {
        }
      }
      return true;
    } catch {
      return false;
    }
  }
  function findPlayerSlot(slots, playerId, opts = {}) {
    if (!slots || typeof slots !== "object") return null;
    const isMatch = (slot) => slot && String(slot.playerId || slot.id || "") === String(playerId);
    if (Array.isArray(slots)) {
      const arr = slots;
      for (let i = 0; i < arr.length; i++) {
        if (isMatch(arr[i])) {
          return { isArray: true, matchSlot: arr[i], matchIndex: i, entries: null, slotsArray: arr };
        }
      }
      return null;
    }
    const entries = Object.entries(slots);
    if (opts.sortObject) entries.sort(([a], [b]) => compareSlotKeys(a, b));
    for (let i = 0; i < entries.length; i++) {
      const [, s] = entries[i];
      if (isMatch(s)) {
        return { isArray: false, matchSlot: s, matchIndex: i, entries, slotsArray: null };
      }
    }
    return null;
  }
  function compareSlotKeys(a, b) {
    const ai = Number(a);
    const bi = Number(b);
    if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi;
    return a.localeCompare(b);
  }
  function slotMatchToIndex(meta) {
    if (meta.isArray) return meta.matchIndex;
    const entry = meta.entries?.[meta.matchIndex];
    const k = entry ? entry[0] : null;
    const n = Number(k);
    return Number.isFinite(n) ? n : 0;
  }
  function rebuildUserSlots(meta, buildSlot) {
    if (meta.isArray) {
      const nextSlots = (meta.slotsArray || []).slice();
      nextSlots[meta.matchIndex] = buildSlot(meta.matchSlot);
      return nextSlots;
    }
    const nextEntries = (meta.entries || []).map(
      ([k, s], idx) => idx === meta.matchIndex ? [k, buildSlot(s)] : [k, s]
    );
    return Object.fromEntries(nextEntries);
  }
  function buildStateWithUserSlots(cur, userSlots) {
    return {
      ...cur || {},
      child: {
        ...cur?.child || {},
        data: {
          ...cur?.child?.data || {},
          userSlots
        }
      }
    };
  }
  function extractInventoryItems(rawInventory) {
    if (!rawInventory) return [];
    if (Array.isArray(rawInventory)) return rawInventory;
    if (Array.isArray(rawInventory.items)) return rawInventory.items;
    if (Array.isArray(rawInventory.inventory)) return rawInventory.inventory;
    if (Array.isArray(rawInventory.inventory?.items)) return rawInventory.inventory.items;
    return [];
  }
  async function getInventoryCounts() {
    const counts = {
      seeds: /* @__PURE__ */ new Map(),
      plants: /* @__PURE__ */ new Map(),
      decors: /* @__PURE__ */ new Map(),
      eggs: /* @__PURE__ */ new Map(),
      tools: /* @__PURE__ */ new Map()
    };
    try {
      const inventory = await Store.select("myInventoryAtom");
      const items = extractInventoryItems(inventory);
      const aliasMap = getPlantAliasMap();
      for (const entry of items) {
        if (!entry || typeof entry !== "object") continue;
        const source = entry.item && typeof entry.item === "object" ? entry.item : entry;
        if (!source || typeof source !== "object") continue;
        const type = String(source.itemType ?? source.data?.itemType ?? "").toLowerCase();
        const quantity = Number(source.quantity ?? source.count ?? 1);
        if (type === "seed") {
          const rawSpecies = String(source.species ?? source.seedSpecies ?? source.data?.species ?? "");
          const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
          if (species) addCount(counts.seeds, species, quantity);
        } else if (type === "plant") {
          const rawSpecies = String(
            source.species ?? source.plantSpecies ?? source.seedSpecies ?? source.cropSpecies ?? source.baseSpecies ?? source.data?.species ?? ""
          );
          const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
          if (species) addCount(counts.plants, species, quantity);
        } else if (type === "decor") {
          const decorId = String(source.decorId ?? source.data?.decorId ?? "");
          if (decorId) addCount(counts.decors, decorId, quantity);
        } else if (type === "egg") {
          const eggId = String(source.eggId ?? source.data?.eggId ?? "");
          if (eggId) addCount(counts.eggs, eggId, quantity);
        } else if (type === "tool" || type === "item") {
          const itemName = String(source.name ?? source.itemName ?? source.data?.name ?? "");
          if (itemName) addCount(counts.tools, itemName, quantity);
        }
      }
    } catch {
    }
    return counts;
  }
  async function getInventoryPlantMutationCounts(aliasMap) {
    const counts = /* @__PURE__ */ new Map();
    const bySpecies = await readPlantInventoryBySpeciesWithMutations(aliasMap);
    for (const [species, items] of bySpecies.entries()) {
      for (const entry of items) {
        for (const mutation of entry.mutations) {
          addCount(counts, mutationKeyFor(species, mutation), 1);
        }
      }
    }
    return counts;
  }
  function addCount(map, key, qty) {
    if (!key) return;
    const q = Number.isFinite(qty) && qty > 0 ? qty : 1;
    map.set(key, (map.get(key) || 0) + q);
  }
  async function buildMissingItems(garden, inventory, current) {
    const requiredPlants = /* @__PURE__ */ new Map();
    const requiredDecors = /* @__PURE__ */ new Map();
    const requiredEggs = /* @__PURE__ */ new Map();
    const aliasMap = getPlantAliasMap();
    const registerPlant = (id, mutation) => {
      if (!id) return;
      const key = mutationKeyFor(id, mutation);
      const entry = requiredPlants.get(key);
      if (entry) {
        entry.needed += 1;
      } else {
        requiredPlants.set(key, { id, mutation: mutation || void 0, needed: 1 });
      }
    };
    const register = (map, id) => {
      if (!id) return;
      map.set(id, (map.get(id) || 0) + 1);
    };
    const mapEntries = [
      ["Dirt", garden?.tileObjects || {}],
      ["Boardwalk", garden?.boardwalkTileObjects || {}]
    ];
    for (const [tileType, map] of mapEntries) {
      const ignored = getIgnoredSet(garden, tileType);
      for (const [key, obj] of Object.entries(map)) {
        const idx = Number(key);
        if (Number.isFinite(idx) && ignored.has(idx)) continue;
        if (!obj || typeof obj !== "object") continue;
        const type = String(obj.objectType || "").toLowerCase();
        if (type === "plant") {
          const rawSpecies = String(obj.species || obj.seedKey || "");
          const species = resolvePlantSpeciesKey(rawSpecies, aliasMap);
          const mutation = getDesiredMutation(obj);
          registerPlant(species || null, mutation);
        } else if (type === "decor") {
          const decorId = String(obj.decorId || obj.id || "");
          register(requiredDecors, decorId || null);
        } else if (type === "egg") {
          const eggId = String(obj.eggId || obj.id || "");
          register(requiredEggs, eggId || null);
        }
      }
    }
    const missing = [];
    const gardenPlantCounts = current ? countGardenPlants(current, aliasMap, getIgnoredSet(garden, "Dirt")) : /* @__PURE__ */ new Map();
    const gardenPlantMutations = current ? countGardenPlantsByMutation(current, aliasMap, getIgnoredSet(garden, "Dirt")) : /* @__PURE__ */ new Map();
    const inventoryMutationCounts = await getInventoryPlantMutationCounts(aliasMap);
    const gardenDecorCounts = current ? countGardenDecors(
      current,
      getIgnoredSet(garden, "Dirt"),
      getIgnoredSet(garden, "Boardwalk")
    ) : /* @__PURE__ */ new Map();
    for (const entry of requiredPlants.values()) {
      const id = entry.id;
      const mutation = entry.mutation;
      const key = mutationKeyFor(id, mutation);
      const have = mutation ? (inventoryMutationCounts.get(key) || 0) + (gardenPlantMutations.get(key) || 0) : (inventory.plants.get(id) || 0) + (gardenPlantCounts.get(id) || 0);
      if (have < entry.needed) {
        missing.push({ type: "plant", id, mutation: mutation || void 0, needed: entry.needed, have });
      }
    }
    for (const [id, needed] of requiredDecors) {
      const have = (inventory.decors.get(id) || 0) + (gardenDecorCounts.get(id) || 0);
      if (have < needed) missing.push({ type: "decor", id, needed, have });
    }
    for (const [id, needed] of requiredEggs) {
      const have = inventory.eggs.get(id) || 0;
      if (have < needed) missing.push({ type: "egg", id, needed, have });
    }
    return missing;
  }
  function formatMissingSummary(missing) {
    const lines = missing.slice(0, 6).map((m) => {
      const mutation = m.mutation ? ` (${m.mutation})` : "";
      return `${m.id}${mutation} (${m.have}/${m.needed})`;
    });
    if (missing.length > 6) lines.push(`+${missing.length - 6} more`);
    return lines.join(", ");
  }

  // src/services/editor.ts
  var keybindsInstalled = false;
  var shouldIgnoreKeydown = (ev) => {
    const el2 = ev.target;
    if (!el2) return false;
    const tag = el2.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el2.isContentEditable) return true;
    return false;
  };
  function installEditorKeybindsOnce() {
    if (keybindsInstalled || typeof window === "undefined") return;
    keybindsInstalled = true;
    window.addEventListener("keydown", (ev) => {
      if (shouldIgnoreKeydown(ev)) return;
      if (eventMatchesKeybind("gui.toggle-layout-creator", ev)) {
        ev.preventDefault();
        ev.stopPropagation();
        const launchBtn = document.querySelector(
          '.glc-launch .glc-launch-item[data-id="editor"] .btn'
        );
        launchBtn?.click();
      }
    });
  }
  var EditorService = {
    init() {
      installEditorKeybindsOnce();
      shareGlobal("glcEditorPreviewFriendGarden", async (garden) => {
        return await GardenLayoutService.previewGarden(garden);
      });
      shareGlobal("glcEditorClearFriendGardenPreview", async () => {
        return await GardenLayoutService.clearPreview();
      });
      shareGlobal("glcGetInventorySlots", async () => {
        const inventory = await Store.select("myInventoryAtom");
        const items = Array.isArray(inventory?.items) ? inventory.items : Array.isArray(inventory?.inventory) ? inventory.inventory : Array.isArray(inventory?.inventory?.items) ? inventory.inventory.items : Array.isArray(inventory) ? inventory : [];
        const usedSlots = items.length;
        const capacity = inventory?.capacity ?? inventory?.maxSlots ?? inventory?.maxSize ?? inventory?.inventory?.capacity ?? inventory?.inventory?.maxSlots ?? inventory?.inventory?.maxSize ?? inventory?.data?.capacity ?? inventory?.data?.maxSlots ?? inventory?.data?.maxSize ?? 100;
        const freeSlots = Number.isFinite(capacity) ? Math.max(0, capacity - usedSlots) : null;
        const isFull = await Store.select("isMyInventoryAtMaxLengthAtom");
        return {
          usedSlots,
          capacity,
          freeSlots,
          isFull,
          rawInventory: inventory
        };
      });
      shareGlobal("glcReadInventoryFreeSlots", async () => {
        return await GardenLayoutService.getInventoryFreeSlots();
      });
    },
    isEnabled() {
      return false;
    }
  };

  // src/ui/spriteIconCache.ts
  var SPRITE_PRELOAD_CATEGORIES = [
    "plant",
    "tallplant",
    "crop",
    "decor",
    "pet",
    "mutation",
    "mutation-overlay"
  ];
  var spriteDataUrlCache = /* @__PURE__ */ new Map();
  var spriteWarmupQueued = false;
  var spriteWarmupStarted = false;
  var warmupState = { total: 0, done: 0, completed: false };
  var prefetchedWarmupKeys = [];
  var warmupCompletedKeys = /* @__PURE__ */ new Set();
  var WARMUP_RETRY_MS = 100;
  var WARMUP_DELAY_MS = 8;
  var WARMUP_BATCH = 3;
  var warmupListeners = /* @__PURE__ */ new Set();
  function notifyWarmup(state2) {
    warmupState = state2;
    warmupListeners.forEach((listener) => {
      try {
        listener(warmupState);
      } catch {
      }
    });
  }
  function primeWarmupKeys(keys) {
    prefetchedWarmupKeys.push(...keys);
  }
  function primeSpriteData(category, spriteId, dataUrl) {
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
  var normalizeSpriteId = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  var CUSTOM_MUTATION_ICONS = {
    gold: "data:image/png;base64,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",
    rainbow: "data:image/png;base64,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"
  };
  var CUSTOM_SEED_ICONS = {
    starweaver: "data:image/png;base64,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",
    dawncelestial: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAALaklEQVR4AexZWWxc5RX+7p19xjOexfY4dhzbIYtxm4SyFVpADkI89IXwUFWqWhHaPtCqi6m6IFVVES/loSp5oA99aUSFqBAUHCqxBEhCAyFqCCTBTmzGyyT2jGc8+3Znvff2P//1jCeBFnlmQowyozn/vpzznfOf//wzIq7zTxuA69wA0LaAtgVc5wi0j8B1bgBtJ9g+Au0jcJ0j0D4C17kBfDlvgZHefft/+qPXxg4eVJ3NKvBLcQR+ufvN8fHdhxOP7n5D/dMdYfXnN7xw0Hd05uiTj+37aL0AXDl+QwEwftPLQ+M3Hd7/t4dULiwJTKRCeUqA6txqvxux4hx8mSMYtd2IHY6vDzFrePxKodZT/8IB4ELuev2p8T2vL5Bw9SQo1oXR/rsOLoTPOT2jO1FPN9x6M3Q3FqBY1Zp82yy3gNX+UGtooHDVAXjmSekXv91z/GhV0E2m2xd0et24pdM5ZB/oh3tke03Qvj03oWu3Cf1bRtDjHIDN3FkTqc/VhXg2DZpTa2QFUdSztPHvVQPgvqHfcaHPPHf8wHDv7WOOoQEuaN/tbmzatQc2bzd0jHeve5AL28ME7vV0IV8EqkLZzA7Qx6DXIyllqfgpMuqtn2pbT0PLAdjpfeDoz3a9ou5y3DNm9ri40D1fNcLh8nJBrR0m+KaOYHH+FIJLkzh96oUav2azgJykVWP+j1Ep5Xmlz+lBMBHj5SsTUdBd2bSuessAGBra5/xa//fVb3l/MqYXTHBt38q03MOZ0VsAu8WJgX4Ry6HP1iQNZIqmjJOjdyv0Rgsv20xmnlNSllYRogqjqrWwYkPflgAw/sj7Q93KVxJjnu9xJlQTkFxe5GWdqENZVkHCFYoqjCYbb68mO0bGqkU2RqiVDWYbiuU8yPwDddovRVOw6t0wiBZOd975m9qcRgotAeDsm4GFu5z38P3LSgGVcgklKcfrI8P9SKRUbGHaj0SZz2att9z2bVTJbu9mLWDCA4MjwGbvGghpKYahLi9S7PwTEKP9g7CUnHw8gUD0wYd/GeYNDSZig/Nq03ZseiCxz3t/rW502CEyrfeO7AJp394hQFGATE4T3sHq9UJWJ/ZuEpCNqdDXHWlVVWHQ6bkVEBDnAxeRKF2CoosjXQ6wmMCPk9MH/NU1GsmbAmCkd9/++zw/cKZKQb43nXv3lq3o2THK6w6bA7GEgk6HgFhcA8DtABfSaedDeLLJKyKfBfxzKi6FtHGFUg509sn8t3v74QsFIIVW+HiGC88jsnbMeKXBRGxwHp/GWD3YoXdBVsu8LhoMPK8m2wYcSKUBq1WzAmpPZlQobGIyAxiNwNZBEeGIglhCRTKZB1kLjUtLcfS5POhxdII0T235eIIyFEsAgRCqLB7iDU0kDQNA2t/LnF5ZycMgWkBXXpWPTHKZF4tFnl2WkOCf+LQrbfMmEfMXFS50YmkGqeAsYuz6q04g849lM/C6rbCYWNBQ7VjNC0r6wGqx4axhAJgSD1p0dr5xp6GvduVRQzh4AZWShGhCQ6BUYqOpg5GqyMhFA6wEVCo844lSYWrlJYDM32m18RpFf70MgBu8Vl6vT07OPn2svt5IuWEAOg2a96ZNyQIor9K20Xvh6vQglonzpkRSRbdH8+4Cc5CeoV28XV+nVPeWUVicPaA+zfy7+LmngZPzMbzz+ikq1mi5Ml8rN1MQG5lM5j9o1YSg+YH8Geaw2OVPlVUyG4yoyGUMeGU4mDJtzA+sdtWy6nmnBgLG6vRy7RsYMmW5wuIHzURkcho0qI4i8NbVGi82BICqqg+5jb21XbPlFQx2rdWpg84vMV6RS8hIMvyLCnd41Fclig/EOg5UVQFpn6488vo0LhryYfr0q1SskUE0w6Drr9X/X+Hz+uq2/7yhdf2CMGYVOusawD31zk0Dl7VR5exsFMuxINcsgTA0sLZlTlJBltHbJaDbLSOSCtAUlJj2eYElyfgi5FIZpYoWAltZFKgzjiAuPdP0DcCWxxo3VGuSIpkUbKbLj0Jflw17tnVBEHIIMWHOz0XR1yMyz19hgZKMlXgEAiToxRLffXtvPy5GwrxMiSIrEAURTvNmbLffiw59D47EnqC2A9TfLDUMQFGVUCxkkcvEuDAqO9DksTe7tQcQnWFirtupPWi6nNqDJstC5EvBBBQ5C7vBwI5HHtl8mZOBnf1csUDTYDdbMODuxjdcP8Q3+x+BSezgvwStFKZ5fytuAFqoYQDicgiVsnbN5XMpZBY189WJ2pJ0/kVWpiMQikuYC6RoP04EVK/TXfPy1EdEER/5jpG+ASgs0vGHg5hJH+aCUwhMk6cKJyhrGWncrnM5VVCTwdI8DAZTbWa5+pBfbVHYfa8TteXDDIDV5loWSiXAbB/VzyB79CjMCV6MhjEdXARZQtL36asuJUfhdu1JVuc1m2scrnMVAcIzBSUHo7njspkJxnCupJlwWZZh1Olq/Rd9JzB7/ggURQubyQrcNi2Q6rY7IbF5JHh1QjG5ZjHU1mnsA0w3o9OyDyU1/DC1tYIaAqBowuPFShZppg2b3QNrh5vz0qPfienz53nZxOKAfFkTNi8lUC5rwPh97/N+SszsMUDCG9gTMJJeE1hl/iQbDNEQTjsd94Oe2SfijyMh/RNvn/79BO9oQdIQAH7/RLJQSmNy9TwKggCHoQ86QQ8pEkU+EkM3e8QoTBDi0WJ1UcbJ6V67Km1GM3tIKbWfu2QGWOjCOcSnfXwsJSQ8+YFzubepinRu2c8LLUoaAoDvrarHVOaoyAoGbLfCrHMgIJ3hXRIDIfKR5iB5A0u2sfCYyN09jD6XB+To6JVHR4F18285k4WS165DatjOrj36D4DKK5VFKKoMQRD2Ur1V1DAAM+FDe2V5J4LiKBe8ej0RY/QHhi92HLHzM0gwvyAzzXo67Fxo+lVHYledP7Jm4oVYnI/Nsfe+yWyHy7gFpPm57L+Z0BV8mH+LlmVRYgjToYkNYgGMpWzhyLFo7q94N/sSq2nfbvMIDIKFC0BCDJnvgGHRiNlTZ/DeW2/hvWNHsTzlQ2aG/bgxV4FhQQ9nph9kRUQ0P1uJ8OtPUSugR09BkVAoZyAATf38pXF4edqwBdAyZAVpSdPkuVIAWzvuZj9TzXLm6dwSzWeOI8KCFxKG5uSSEUj5DNKFFTZ2DqH8FLegUH4SOtUCI4vzQf/3sMEUbC0UJ5kVyCgUU/5Wa59tgaYAoAWKZrgKRRtU0Ypnw79mzGovOHzGR2U+Q2HxwZVdXeqd0Oe9mApP4JPw27CWN6O34x5Mlpb4UAKZgd1y7dPiTQPg908kLfrh4eXEC7QeTuRewQpzWLxyRSIIAujarDbTw6ZPvR+LuTcQLX1YbcYUW+Ol8K8YmDLkym147I8vr10jtVGtKTQNALFx0v9jv6rKw8lcgKqYLX70P4EQ2VVZdXJWnQu+7D+YoGU+T1IziMoBXNLNguKMSOqo/4OL+4WHHxZaFvnxjeqSlgBA69H5fOLPLz9YKHn8qjIMq/E2BFU9zpSX8QkLmBSdEU7m3V3GQVSdXIj5hhxSiMvLXPAkVrCkXwABmS+kHm3E7ImX9VDLAKBNv/NdYeLs4hPD6fy7w8HEBKKZwyzEPYUoC5hOpl/Eq4mn8a/4U3gn8zy3kP9Ir2FWnMSiYR4LwgX4CqeRygWOzYQmhJnwxAFa82pTSwGoMkvWQEJk9JIrLS1NkEaJsgUWJZZS/EqTigmk82Gu7WR2yZ8vxvfSnBkWX1TX+SLyqwJAlXFykBeWDz3IBWNanQo8L5xbfFY4e+nvwsdLzwkXgi8KvC98aJiB1vQvvNV915NfVQDWw8i1GtsG4Fohv1H2bVvARtHEteKjbQHXCvmNsm/bAjaKJq4VH20LuFbIb5R92xawUTTRKB/NzvsvAAAA//+GGewnAAAABklEQVQDAPhP5b0Yr1dDAAAAAElFTkSuQmCC",
    mooncelestial: "data:image/png;base64,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"
  };
  var getCustomMutationDataUrl = (categories, id) => {
    if (!categories.map((category) => category.toLowerCase()).includes("mutation")) return null;
    const normalized = normalizeSpriteId(id);
    return CUSTOM_MUTATION_ICONS[normalized] || null;
  };
  var getCustomSeedDataUrl = (categories, id) => {
    if (!categories.map((category) => category.toLowerCase()).includes("seed")) return null;
    const normalized = normalizeSpriteId(id);
    return CUSTOM_SEED_ICONS[normalized] || null;
  };
  var baseNameFromKey = (key) => {
    const parts = key.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? key;
  };
  var normalizeMutationList2 = (mutations) => {
    const list = Array.from(
      new Set((mutations ?? []).map((value) => String(value ?? "").trim()).filter(Boolean))
    );
    if (!list.length) {
      return { list, key: "" };
    }
    const key = list.map((val) => normalizeSpriteId(val)).filter(Boolean).sort().join(",");
    return { list, key: key ? `|m=${key}` : "" };
  };
  var cacheKeyFor = (category, spriteId, mutationKey) => `${category}:${normalizeSpriteId(spriteId)}${mutationKey ?? ""}`;
  var scheduleNonBlocking = (cb) => {
    return new Promise((resolve) => {
      const runner = () => {
        Promise.resolve().then(cb).then(resolve).catch(() => resolve(cb()));
      };
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(runner, { timeout: 50 });
      } else if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(runner);
      } else {
        setTimeout(runner, 0);
      }
    });
  };
  function getSpriteService() {
    const win = pageWindow ?? globalThis;
    return win?.__MG_SPRITE_SERVICE__ ?? win?.unsafeWindow?.__MG_SPRITE_SERVICE__ ?? null;
  }
  var parseKeyToCategoryId = (key) => {
    const parts = key.split("/").filter(Boolean);
    if (!parts.length) return null;
    const start2 = parts[0] === "sprite" || parts[0] === "sprites" ? 1 : 0;
    const category = parts[start2] ?? "";
    const id = parts.slice(start2 + 1).join("/") || parts[parts.length - 1] || "";
    if (!category || !id) return null;
    return { category, id };
  };
  function whenServiceReady(handle) {
    if (!handle || !handle.ready || typeof handle.ready.then !== "function") {
      return Promise.resolve();
    }
    return handle.ready.then(
      () => {
      },
      () => {
      }
    );
  }
  async function ensureSpriteDataCached(service, category, spriteId, logTag, options) {
    if (!service?.renderToCanvas) {
      return null;
    }
    const { list: mutationList, key: mutationKey } = normalizeMutationList2(options?.mutations);
    const cacheKey = cacheKeyFor(category, spriteId, mutationKey);
    let promise = spriteDataUrlCache.get(cacheKey);
    if (!promise) {
      promise = scheduleNonBlocking(async () => {
        try {
          const canvas = service.renderToCanvas?.({
            category,
            id: spriteId,
            mutations: mutationList
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
  var spriteMatchCache = /* @__PURE__ */ new Map();
  function getMatchCacheKey(categories, id) {
    const normalizedCategories = categories.map((category) => category.toLowerCase()).join("|");
    return `${normalizedCategories}|${normalizeSpriteId(id)}`;
  }
  function findSpriteMatch(service, categories, id) {
    if (!service.list) return null;
    const cacheKey = getMatchCacheKey(categories, id);
    if (spriteMatchCache.has(cacheKey)) {
      return spriteMatchCache.get(cacheKey) ?? null;
    }
    const normalizedTarget = normalizeSpriteId(id);
    const categoryLists = categories.map((category) => ({
      category,
      items: service.list?.(category) ?? []
    }));
    let matched = null;
    const tryMatch = (category, base) => {
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
        if (normalizedTarget.includes(normBase) || normBase.includes(normalizedTarget) || normBase.startsWith(normalizedTarget) || normalizedTarget.startsWith(normBase)) {
          matched = { category, spriteId: base };
          spriteMatchCache.set(cacheKey, matched);
          return matched;
        }
      }
    }
    spriteMatchCache.set(cacheKey, null);
    return null;
  }
  function attachSpriteIcon(target, categories, id, size, logTag, options) {
    const candidateIds = Array.isArray(id) ? id.map((value) => String(value ?? "").trim()).filter(Boolean) : [String(id ?? "").trim()].filter(Boolean);
    if (!candidateIds.length) return;
    for (const candidate of candidateIds) {
      const seedDataUrl = getCustomSeedDataUrl(categories, candidate);
      if (seedDataUrl) {
        const spriteKey2 = `seed:${normalizeSpriteId(candidate)}|custom`;
        const existingImg2 = target.querySelector("img[data-sprite-key]");
        if (existingImg2 && existingImg2.dataset.spriteKey === spriteKey2) {
          return;
        }
        const img2 = document.createElement("img");
        img2.src = seedDataUrl;
        img2.width = size;
        img2.height = size;
        img2.alt = "";
        img2.decoding = "async";
        img2.loading = "lazy";
        img2.draggable = false;
        img2.style.width = `${size}px`;
        img2.style.height = `${size}px`;
        img2.style.objectFit = "contain";
        img2.style.imageRendering = "auto";
        img2.style.display = "block";
        img2.dataset.spriteKey = spriteKey2;
        img2.dataset.spriteCategory = "seed";
        img2.dataset.spriteId = candidate;
        requestAnimationFrame(() => {
          target.replaceChildren(img2);
          options?.onSpriteApplied?.(img2, {
            category: "seed",
            spriteId: candidate,
            candidate
          });
        });
        return;
      }
      const dataUrl = getCustomMutationDataUrl(categories, candidate);
      if (!dataUrl) continue;
      const spriteKey = `mutation:${normalizeSpriteId(candidate)}|custom`;
      const existingImg = target.querySelector("img[data-sprite-key]");
      if (existingImg && existingImg.dataset.spriteKey === spriteKey) {
        return;
      }
      const img = document.createElement("img");
      img.src = dataUrl;
      img.width = size;
      img.height = size;
      img.alt = "";
      img.decoding = "async";
      img.loading = "lazy";
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
          candidate
        });
      });
      return;
    }
    const service = getSpriteService();
    if (!service?.renderToCanvas) return;
    void whenServiceReady(service).then(
      () => scheduleNonBlocking(async () => {
        let selected = null;
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
        const { key: mutationKey } = normalizeMutationList2(options?.mutations);
        const spriteKey = `${resolved.match.category}:${resolved.match.spriteId}${mutationKey}`;
        const existingImg = target.querySelector("img[data-sprite-key]");
        if (existingImg && existingImg.dataset.spriteKey === spriteKey) {
          return;
        }
        const dataUrl = await ensureSpriteDataCached(
          service,
          resolved.match.category,
          resolved.match.spriteId,
          logTag,
          {
            mutations: options?.mutations
          }
        );
        if (!dataUrl) return;
        const img = document.createElement("img");
        img.src = dataUrl;
        img.width = size;
        img.height = size;
        img.alt = "";
        img.decoding = "async";
        img.loading = "lazy";
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
            candidate: resolved.candidate
          });
        });
      })
    );
  }
  function warmupSpriteCache() {
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
    const tasks = [];
    const seen = new Set(warmupCompletedKeys);
    const listFn = service?.list;
    if (listFn) {
      SPRITE_PRELOAD_CATEGORIES.forEach((category) => {
        const items = listFn(category) ?? [];
        items.forEach((item) => {
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
      prefetchedWarmupKeys.forEach((key) => {
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
          totalCached: spriteDataUrlCache.size
        });
        notifyWarmup({ total, done: warmupState.done, completed: true });
        return;
      }
      let processed = 0;
      const batch = tasks.splice(0, WARMUP_BATCH);
      batch.forEach((entry) => {
        ensureSpriteDataCached(service, entry.category, entry.id, "warmup").then((result) => {
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
        }).finally(() => {
          processed += 1;
          if (processed >= batch.length) {
            setTimeout(processNext, WARMUP_DELAY_MS);
          }
        });
      });
    };
    processNext();
  }

  // src/utils/api.ts
  function detectEnvironment() {
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
    const parentLooksDiscord = isInIframe && !!refHost && /(^|\.)discord(app)?\.com$/i.test(refHost);
    return {
      surface: parentLooksDiscord ? "discord" : "web",
      host: location.hostname,
      origin: location.origin,
      isInIframe
    };
  }
  function isDiscordSurface() {
    return detectEnvironment().surface === "discord";
  }

  // src/utils/version.ts
  var REPO_OWNER = "Hyrulien";
  var REPO_NAME = "GardenLayoutCreator";
  var REPO_BRANCH = "main";
  var SCRIPT_FILE_PATH = "dist/LayoutCreator.user.js";
  var SCRIPT_NAME = "GLC - Garden Layout Creator";
  var SCRIPT_NAMESPACE = "GLC";
  var RAW_BASE_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}`;
  var COMMITS_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits/${REPO_BRANCH}`;
  async function fetchTextWithFetch(url, options) {
    const response = await fetch(url, { cache: "no-store", ...options });
    if (!response.ok) {
      throw new Error(`Failed to load remote resource: ${response.status} ${response.statusText}`);
    }
    return await response.text();
  }
  async function fetchTextWithGM(url, options) {
    return new Promise((resolve, reject) => {
      const xhr = typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest : typeof GM !== "undefined" && typeof GM.xmlHttpRequest === "function" ? GM.xmlHttpRequest : null;
      if (!xhr) return reject(new Error("GM_xmlhttpRequest not available"));
      xhr({
        method: "GET",
        url,
        headers: options?.headers,
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) resolve(res.responseText);
          else reject(new Error(`GM_xhr failed: ${res.status}`));
        },
        onerror: (e) => reject(e)
      });
    });
  }
  async function fetchText(url, options) {
    const preferGM = isDiscordSurface();
    const hasGM = typeof GM_xmlhttpRequest === "function" || typeof GM !== "undefined" && typeof GM.xmlHttpRequest === "function";
    if (preferGM && hasGM) {
      return await fetchTextWithGM(url, options);
    }
    try {
      return await fetchTextWithFetch(url, options);
    } catch (error) {
      if (hasGM) {
        return await fetchTextWithGM(url, options);
      }
      throw error;
    }
  }
  async function fetchLatestCommitSha() {
    try {
      const responseText = await fetchText(COMMITS_API_URL, {
        headers: { Accept: "application/vnd.github+json" }
      });
      const data = JSON.parse(responseText);
      if (data && typeof data.sha === "string" && data.sha.trim().length > 0) {
        return data.sha.trim();
      }
    } catch (error) {
      console.warn("[GLC] Failed to resolve latest commit SHA:", error);
    }
    return null;
  }
  async function fetchScriptSource() {
    const commitSha = await fetchLatestCommitSha();
    const scriptUrl = commitSha ? `${RAW_BASE_URL}/${commitSha}/${SCRIPT_FILE_PATH}` : `${RAW_BASE_URL}/refs/heads/${REPO_BRANCH}/${SCRIPT_FILE_PATH}?t=${Date.now()}`;
    return await fetchText(scriptUrl);
  }
  async function fetchRemoteVersion() {
    try {
      const scriptSource = await fetchScriptSource();
      const meta = extractUserscriptMetadata(scriptSource);
      if (!meta) {
        throw new Error("Metadata block not found in remote script");
      }
      const version = meta.get("version")?.[0];
      const download = meta.get("downloadurl")?.[0] ?? meta.get("updateurl")?.[0];
      return {
        version,
        download
      };
    } catch (error) {
      console.error("[GLC] Unable to retrieve remote version:", error);
      return null;
    }
  }
  function extractUserscriptMetadata(source) {
    const headerMatch = source.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
    if (!headerMatch) {
      return null;
    }
    const metaBlock = headerMatch[1];
    const entries = metaBlock.matchAll(/^\/\/\s*@([^\s]+)\s+(.+)$/gm);
    const meta = /* @__PURE__ */ new Map();
    for (const [, rawKey, rawValue] of entries) {
      const key = rawKey.trim().toLowerCase();
      const value = rawValue.trim();
      if (!key) continue;
      const current = meta.get(key);
      if (current) {
        current.push(value);
      } else {
        meta.set(key, [value]);
      }
    }
    return meta;
  }
  function getLocalVersionFromGM() {
    if (typeof GM_info === "undefined" || !GM_info?.script) return void 0;
    const script = GM_info.script;
    const isSelf = script.name === SCRIPT_NAME || script.namespace === SCRIPT_NAMESPACE;
    if (!isSelf) return void 0;
    return script.version || void 0;
  }
  function getLocalVersionFromSource(source) {
    if (!source) return void 0;
    const meta = extractUserscriptMetadata(source);
    const version = meta?.get("version")?.[0];
    return version?.trim() || void 0;
  }
  function getLocalVersionFromDocument() {
    if (typeof document === "undefined") return void 0;
    const current = document.currentScript;
    const currentVersion = getLocalVersionFromSource(current?.textContent || "");
    if (currentVersion) return currentVersion;
    const scripts = Array.from(document.scripts || []);
    for (const script of scripts) {
      const text = script?.textContent || "";
      if (!text) continue;
      if (!text.includes(SCRIPT_NAME) && !text.includes(`@namespace    ${SCRIPT_NAMESPACE}`)) continue;
      const version = getLocalVersionFromSource(text);
      if (version) return version;
    }
    return void 0;
  }
  function resolveLocalVersion() {
    return getLocalVersionFromGM() || getLocalVersionFromDocument();
  }
  var LOCAL_VERSION = resolveLocalVersion();
  function getLocalVersion() {
    return LOCAL_VERSION;
  }

  // src/ui/menus/editor.ts
  function renderEditorMenu(container) {
    const ui = new Menu({ id: "editor", compact: true });
    ui.mount(container);
    const createActionButton = (label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.style.borderRadius = "6px";
      button.style.border = "1px solid rgba(255,255,255,0.2)";
      button.style.background = "rgba(255,255,255,0.04)";
      button.style.color = "inherit";
      button.style.fontWeight = "600";
      button.style.fontSize = "13px";
      button.style.padding = "6px 12px";
      button.style.cursor = "pointer";
      button.addEventListener("mouseenter", () => button.style.background = "rgba(255,255,255,0.08)");
      button.addEventListener("mouseleave", () => button.style.background = "rgba(255,255,255,0.04)");
      return button;
    };
    const createStatusLine = () => {
      const line = document.createElement("div");
      line.style.fontSize = "13px";
      line.style.minHeight = "18px";
      line.style.opacity = "0.9";
      return line;
    };
    const showStatus = (line, ok, message) => {
      line.textContent = message;
      line.style.color = ok ? "#8bf1b5" : "#ff9c9c";
    };
    const downloadJSONFile = (filename, payload) => {
      const win = pageWindow || window;
      try {
        const safePayload = JSON.stringify(payload);
        const safeFilename = JSON.stringify(filename);
        const script = `(function(){try{const data=${safePayload};const name=${safeFilename};const blob=new Blob([data],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.style.display="none";const parent=document.body||document.documentElement||document;parent.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}catch(e){console.error("[GLC] download:",e)}})();`;
        win.eval(script);
        return;
      } catch {
      }
      try {
        const doc = win.document || document;
        const root = doc.body || doc.documentElement || document.body;
        const blob = new Blob([payload], { type: "application/json" });
        const url = (win.URL || URL).createObjectURL(blob);
        const a = doc.createElement("a");
        a.href = url;
        a.download = filename;
        a.style.display = "none";
        if (root) root.appendChild(a);
        a.click();
        if (root) root.removeChild(a);
        (win.URL || URL).revokeObjectURL(url);
      } catch {
      }
    };
    const view = ui.root.querySelector(".qmm-views");
    view.innerHTML = "";
    view.style.display = "flex";
    view.style.flexDirection = "column";
    view.style.gap = "12px";
    view.style.justifyContent = "flex-start";
    view.style.alignItems = "stretch";
    view.style.height = "100%";
    view.style.minHeight = "0";
    view.style.overflow = "hidden";
    view.style.flex = "1";
    ui.root.style.display = "flex";
    ui.root.style.flexDirection = "column";
    ui.root.style.height = "100%";
    ui.root.style.maxHeight = "100%";
    ui.root.style.minHeight = "0";
    ui.root.style.overflow = "hidden";
    ui.root.style.flex = "1 1 auto";
    let cleanup = null;
    view.__cleanup__ = () => {
      try {
        cleanup?.();
      } catch {
      }
      cleanup = null;
    };
    const sectionCard = (title, content) => {
      const card = ui.card(title, { tone: "muted", align: "center" });
      card.root.style.maxWidth = "960px";
      card.root.style.alignSelf = "stretch";
      card.body.style.display = "grid";
      card.body.style.gap = "16px";
      card.body.style.width = "100%";
      card.body.style.minHeight = "0";
      card.body.append(content);
      return card;
    };
    const layoutWrap = document.createElement("div");
    layoutWrap.style.display = "grid";
    layoutWrap.style.gap = "14px";
    layoutWrap.style.width = "100%";
    layoutWrap.style.minHeight = "0";
    const layoutStatus = document.createElement("div");
    layoutStatus.style.fontSize = "14px";
    layoutStatus.style.opacity = "0.7";
    layoutStatus.style.minHeight = "18px";
    const headerRow = document.createElement("div");
    headerRow.style.display = "flex";
    headerRow.style.justifyContent = "flex-end";
    headerRow.style.gap = "12px";
    headerRow.style.alignItems = "start";
    const requirementsWrap = document.createElement("div");
    requirementsWrap.style.display = "flex";
    requirementsWrap.style.flexDirection = "column";
    requirementsWrap.style.alignItems = "flex-start";
    requirementsWrap.style.gap = "6px";
    requirementsWrap.style.maxHeight = "140px";
    requirementsWrap.style.overflow = "auto";
    requirementsWrap.style.padding = "6px 8px";
    requirementsWrap.style.fontSize = "12px";
    const PLANT_DISPLAY_NAME_OVERRIDES2 = {
      DawnCelestial: "Dawnbinder",
      MoonCelestial: "Moonbinder",
      Starweaver: "Starweaver",
      Lychee: "Lychee",
      Cacao: "Cacao"
    };
    const SEED_ICON_PLANTS = /* @__PURE__ */ new Set(["Starweaver", "DawnCelestial", "MoonCelestial"]);
    const SEED_ICON_SIZE = 30;
    const settingsPanel = document.createElement("div");
    settingsPanel.style.display = "none";
    settingsPanel.style.position = "absolute";
    settingsPanel.style.top = "0";
    settingsPanel.style.right = "0";
    settingsPanel.style.padding = "10px 12px";
    settingsPanel.style.borderRadius = "10px";
    settingsPanel.style.border = "1px solid #2b3441";
    settingsPanel.style.background = "rgba(16,21,28,0.92)";
    settingsPanel.style.boxShadow = "0 8px 16px rgba(0,0,0,0.35)";
    settingsPanel.style.zIndex = "9999";
    settingsPanel.style.minWidth = "220px";
    const tabsRow = document.createElement("div");
    tabsRow.style.display = "flex";
    tabsRow.style.gap = "10px";
    const tabDirt = ui.btn("Dirt", { size: "md" });
    const tabBoard = ui.btn("Boardwalk", { size: "md", variant: "secondary" });
    tabsRow.append(tabDirt, tabBoard);
    const selectionRow = document.createElement("div");
    selectionRow.style.display = "flex";
    selectionRow.style.gap = "12px";
    selectionRow.style.alignItems = "center";
    const selectionCount = document.createElement("div");
    selectionCount.style.fontSize = "14px";
    selectionCount.style.opacity = "0.7";
    selectionCount.textContent = "0 tiles selected";
    selectionRow.append(selectionCount);
    const pickerRow = document.createElement("div");
    pickerRow.style.display = "grid";
    pickerRow.style.gridTemplateColumns = "1fr 1fr";
    pickerRow.style.gap = "12px";
    const typeSelect = document.createElement("select");
    typeSelect.innerHTML = `
    <option value="plant">Plant</option>
    <option value="decor">Decor</option>
  `;
    typeSelect.style.width = "100%";
    typeSelect.style.borderRadius = "8px";
    typeSelect.style.border = "1px solid #2b3441";
    typeSelect.style.background = "rgba(16,21,28,0.9)";
    typeSelect.style.color = "#e7eef7";
    typeSelect.style.padding = "8px 10px";
    typeSelect.style.fontSize = "14px";
    const plantSelect = document.createElement("select");
    const decorSelect = document.createElement("select");
    const mutationSelect = document.createElement("select");
    const plantPreview = document.createElement("div");
    const decorPreview = document.createElement("div");
    const mutationPreview = document.createElement("div");
    const setupPreview = (el2) => {
      el2.style.width = "30px";
      el2.style.height = "30px";
      el2.style.borderRadius = "6px";
      el2.style.border = "1px solid #2b3441";
      el2.style.background = "rgba(16,21,28,0.9)";
      el2.style.display = "flex";
      el2.style.alignItems = "center";
      el2.style.justifyContent = "center";
    };
    setupPreview(plantPreview);
    setupPreview(decorPreview);
    setupPreview(mutationPreview);
    const getPlantDisplayName = (id) => PLANT_DISPLAY_NAME_OVERRIDES2[id] || plantCatalog[id]?.crop?.name || plantCatalog[id]?.plant?.name || id;
    const getDecorDisplayName = (id) => decorCatalog[id]?.name || id;
    const getPlantIconCategories = (id) => SEED_ICON_PLANTS.has(id) ? ["seed"] : ["tallplant", "plant", "crop", "plants"];
    const getMutationDisplayName = (id) => mutationCatalog[id]?.name || id;
    const MUTATION_OUTLINES = {
      Gold: { border: "#f5d44b", shadow: "0 0 0 2px rgba(245,212,75,0.6) inset" },
      Rainbow: { border: "transparent", shadow: "0 0 0 2px rgba(255,255,255,0.3) inset" },
      Frozen: { border: "#8fd9ff", shadow: "0 0 0 2px rgba(143,217,255,0.6) inset" },
      Chilled: { border: "#f0f4ff", shadow: "0 0 0 2px rgba(240,244,255,0.7) inset" },
      Wet: { border: "#5aa9ff", shadow: "0 0 0 2px rgba(90,169,255,0.6) inset" },
      Dawnlit: { border: "#a78bfa", shadow: "0 0 0 2px rgba(167,139,250,0.6) inset" },
      Amberlit: { border: "#ff9f4a", shadow: "0 0 0 2px rgba(255,159,74,0.6) inset" },
      Dawncharged: { border: "#8b5cf6", shadow: "0 0 0 2px rgba(139,92,246,0.6) inset" },
      Ambercharged: { border: "#ff7b2e", shadow: "0 0 0 2px rgba(255,123,46,0.6) inset" }
    };
    const fillSelect = (el2, items, label, getLabel) => {
      el2.innerHTML = "";
      const first = document.createElement("option");
      first.value = "";
      first.textContent = label;
      el2.appendChild(first);
      for (const id of items) {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = getLabel(id);
        el2.appendChild(opt);
      }
      el2.style.width = "100%";
      el2.style.borderRadius = "8px";
      el2.style.border = "1px solid #2b3441";
      el2.style.background = "rgba(16,21,28,0.9)";
      el2.style.color = "#e7eef7";
      el2.style.padding = "8px 10px";
      el2.style.fontSize = "14px";
    };
    fillSelect(plantSelect, GardenLayoutService.listPlantIds(), "Plant species", getPlantDisplayName);
    fillSelect(decorSelect, GardenLayoutService.listDecorIds(), "Decor ID", getDecorDisplayName);
    fillSelect(mutationSelect, Object.keys(mutationCatalog || {}), "Mutation", getMutationDisplayName);
    const plantPickerBtn = ui.btn("Pick plant", { size: "md", variant: "secondary" });
    plantPickerBtn.style.width = "100%";
    const plantPickerWrap = document.createElement("div");
    plantPickerWrap.style.display = "grid";
    plantPickerWrap.style.gridTemplateColumns = "1fr 36px";
    plantPickerWrap.style.gap = "8px";
    plantPickerWrap.style.alignItems = "center";
    plantPickerWrap.append(plantPickerBtn, plantPreview);
    const plantPickerGrid = document.createElement("div");
    plantPickerGrid.style.display = "none";
    plantPickerGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(40px, 1fr))";
    plantPickerGrid.style.gap = "6px";
    plantPickerGrid.style.maxHeight = "220px";
    plantPickerGrid.style.overflow = "auto";
    plantPickerGrid.style.padding = "8px";
    plantPickerGrid.style.borderRadius = "8px";
    plantPickerGrid.style.border = "1px solid #2b3441";
    plantPickerGrid.style.background = "rgba(16,21,28,0.9)";
    const decorPickerBtn = ui.btn("Pick decor", { size: "md", variant: "secondary" });
    decorPickerBtn.style.width = "100%";
    const decorPickerWrap = document.createElement("div");
    decorPickerWrap.style.display = "grid";
    decorPickerWrap.style.gridTemplateColumns = "1fr 36px";
    decorPickerWrap.style.gap = "8px";
    decorPickerWrap.style.alignItems = "center";
    decorPickerWrap.append(decorPickerBtn, decorPreview);
    const decorPickerGrid = document.createElement("div");
    decorPickerGrid.style.display = "none";
    decorPickerGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(40px, 1fr))";
    decorPickerGrid.style.gap = "6px";
    decorPickerGrid.style.maxHeight = "220px";
    decorPickerGrid.style.overflow = "auto";
    decorPickerGrid.style.padding = "8px";
    decorPickerGrid.style.borderRadius = "8px";
    decorPickerGrid.style.border = "1px solid #2b3441";
    decorPickerGrid.style.background = "rgba(16,21,28,0.9)";
    const mutationPickerBtn = ui.btn("Pick mutation", { size: "md", variant: "secondary" });
    mutationPickerBtn.style.width = "100%";
    const mutationPickerWrap = document.createElement("div");
    mutationPickerWrap.style.display = "grid";
    mutationPickerWrap.style.gridTemplateColumns = "1fr 36px";
    mutationPickerWrap.style.gap = "8px";
    mutationPickerWrap.style.alignItems = "center";
    mutationPickerWrap.append(mutationPickerBtn, mutationPreview);
    const mutationPickerGrid = document.createElement("div");
    mutationPickerGrid.style.display = "none";
    mutationPickerGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(40px, 1fr))";
    mutationPickerGrid.style.gap = "6px";
    mutationPickerGrid.style.maxHeight = "220px";
    mutationPickerGrid.style.overflow = "auto";
    mutationPickerGrid.style.padding = "8px";
    mutationPickerGrid.style.borderRadius = "8px";
    mutationPickerGrid.style.border = "1px solid #2b3441";
    mutationPickerGrid.style.background = "rgba(16,21,28,0.9)";
    pickerRow.append(typeSelect, plantPickerWrap);
    const gridWrap = document.createElement("div");
    gridWrap.style.display = "grid";
    gridWrap.style.gap = "8px";
    gridWrap.style.alignItems = "start";
    const tilesWrap = document.createElement("div");
    tilesWrap.style.display = "grid";
    tilesWrap.style.gap = "4px";
    tilesWrap.style.padding = "12px";
    tilesWrap.style.borderRadius = "10px";
    tilesWrap.style.border = "1px solid #2b3441";
    tilesWrap.style.background = "rgba(16,21,28,0.9)";
    tilesWrap.style.maxHeight = "560px";
    tilesWrap.style.overflow = "auto";
    tilesWrap.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });
    gridWrap.append(tilesWrap);
    const layoutActionsRow = document.createElement("div");
    layoutActionsRow.style.display = "flex";
    layoutActionsRow.style.gap = "12px";
    layoutActionsRow.style.flexWrap = "wrap";
    layoutActionsRow.style.alignItems = "center";
    const saveLayoutBtn = ui.btn("New Layout", {
      variant: "secondary",
      fullWidth: false
    });
    const applyLayoutBtn = ui.btn("Apply Layout", {
      variant: "primary",
      fullWidth: false
    });
    const invertLayoutBtn = ui.btn("Invert", {
      variant: "secondary",
      fullWidth: false
    });
    saveLayoutBtn.style.width = "auto";
    applyLayoutBtn.style.width = "auto";
    invertLayoutBtn.style.width = "auto";
    const clearLeftWrap = document.createElement("div");
    clearLeftWrap.style.display = "flex";
    clearLeftWrap.style.alignItems = "center";
    clearLeftWrap.style.gap = "6px";
    clearLeftWrap.style.marginLeft = "auto";
    const clearLeftToggle = ui.switch(false);
    const clearLeftLabel = document.createElement("div");
    clearLeftLabel.textContent = "Clear Left";
    clearLeftLabel.style.fontSize = "12px";
    clearLeftLabel.style.opacity = "0.8";
    clearLeftWrap.append(clearLeftLabel, clearLeftToggle);
    layoutActionsRow.append(saveLayoutBtn, applyLayoutBtn, invertLayoutBtn, clearLeftWrap);
    const layoutHotkeyRow = document.createElement("div");
    layoutHotkeyRow.style.display = "flex";
    layoutHotkeyRow.style.gap = "8px";
    layoutHotkeyRow.style.alignItems = "center";
    const layoutHotkeyLabel = document.createElement("div");
    layoutHotkeyLabel.textContent = "Toggle Layout Creator";
    layoutHotkeyLabel.style.fontSize = "14px";
    layoutHotkeyLabel.style.opacity = "0.7";
    const layoutHotkeyButton = ui.hotkeyButton(
      getKeybind("gui.toggle-layout-creator"),
      (hk) => setKeybind("gui.toggle-layout-creator", hk),
      {
        emptyLabel: "Unassigned",
        listeningLabel: "Press a key\u2026",
        clearable: true
      }
    );
    layoutHotkeyButton.style.width = "auto";
    layoutHotkeyButton.style.padding = "4px 6px";
    layoutHotkeyButton.style.fontSize = "12px";
    layoutHotkeyButton.style.lineHeight = "1";
    layoutHotkeyButton.style.minHeight = "24px";
    layoutHotkeyButton.style.minWidth = "46px";
    layoutHotkeyButton.style.flexShrink = "0";
    layoutHotkeyRow.append(layoutHotkeyLabel, layoutHotkeyButton);
    const keybindMap = readAriesPath("keybinds.bindings") || {};
    if (!Object.prototype.hasOwnProperty.call(keybindMap, "gui.toggle-layout-creator")) {
      setKeybind("gui.toggle-layout-creator", { code: "KeyL" });
      layoutHotkeyButton.refreshHotkey(getKeybind("gui.toggle-layout-creator"));
    }
    const stopLayoutHotkey = onKeybindChange("gui.toggle-layout-creator", (hk) => {
      layoutHotkeyButton.refreshHotkey(hk);
    });
    ui.on("unmounted", stopLayoutHotkey);
    const inventoryRow = document.createElement("div");
    inventoryRow.style.display = "flex";
    inventoryRow.style.gap = "8px";
    inventoryRow.style.alignItems = "center";
    const inventoryLabel = document.createElement("div");
    inventoryLabel.textContent = "Free inventory slots";
    inventoryLabel.style.fontSize = "14px";
    inventoryLabel.style.opacity = "0.7";
    const inventoryInput = document.createElement("input");
    inventoryInput.type = "number";
    inventoryInput.min = "1";
    inventoryInput.step = "1";
    const INVENTORY_SLOTS_PATH = "glc.settings.inventorySlots";
    const INVENTORY_SLOTS_KEY = "glc.settings.inventorySlots";
    const storedSlots = Number(readAriesPath(INVENTORY_SLOTS_PATH));
    let initialSlots = Number.isFinite(storedSlots) && storedSlots >= 0 ? Math.floor(storedSlots) : NaN;
    if (!Number.isFinite(initialSlots)) {
      try {
        const raw = window.localStorage?.getItem(INVENTORY_SLOTS_KEY);
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed >= 0) initialSlots = Math.floor(parsed);
      } catch {
      }
    }
    if (!Number.isFinite(initialSlots)) initialSlots = 10;
    inventoryInput.value = String(initialSlots);
    inventoryInput.style.width = "40px";
    inventoryInput.style.borderRadius = "8px";
    inventoryInput.style.border = "1px solid #2b3441";
    inventoryInput.style.background = "rgba(16,21,28,0.9)";
    inventoryInput.style.color = "#e7eef7";
    inventoryInput.style.padding = "6px 8px";
    inventoryInput.style.fontSize = "14px";
    blockGameInput(inventoryInput);
    const normalizeInventorySlots = (value) => {
      if (!Number.isFinite(value) || value < 1) return 10;
      return Math.floor(value);
    };
    inventoryInput.addEventListener("change", () => {
      const raw = Number(inventoryInput.value);
      const next = normalizeInventorySlots(raw);
      inventoryInput.value = String(next);
      writeAriesPath(INVENTORY_SLOTS_PATH, next);
      try {
        window.localStorage?.setItem(INVENTORY_SLOTS_KEY, String(next));
      } catch {
      }
    });
    inventoryRow.append(inventoryLabel, inventoryInput);
    const previewAllRow = document.createElement("div");
    previewAllRow.style.display = "flex";
    previewAllRow.style.alignItems = "center";
    previewAllRow.style.gap = "8px";
    const previewAllLabel = document.createElement("div");
    previewAllLabel.textContent = "Preview ALL";
    previewAllLabel.style.fontSize = "14px";
    previewAllLabel.style.opacity = "0.7";
    const previewAllToggle = ui.switch(false);
    previewAllRow.append(previewAllLabel, previewAllToggle);
    const hideMenuRow = document.createElement("div");
    hideMenuRow.style.display = "flex";
    hideMenuRow.style.alignItems = "center";
    hideMenuRow.style.gap = "8px";
    const hideMenuLabel = document.createElement("div");
    hideMenuLabel.textContent = "Hide Menu";
    hideMenuLabel.style.fontSize = "14px";
    hideMenuLabel.style.opacity = "0.7";
    const hideMenuToggle = ui.switch(false);
    hideMenuRow.append(hideMenuLabel, hideMenuToggle);
    settingsPanel.append(layoutHotkeyRow, previewAllRow, hideMenuRow, inventoryRow);
    const HIDE_MENU_PATH = "glc.settings.hideMenu";
    const getLauncherEl = () => document.querySelector(".glc-launch");
    const getLaunchItemEl = () => document.querySelector('.glc-launch .glc-launch-item[data-id="editor"]');
    const setLauncherHidden = (hidden) => {
      const launcher = getLauncherEl();
      const item = getLaunchItemEl();
      if (item) item.style.display = hidden ? "none" : "";
      if (launcher) {
        const anyVisible = Array.from(launcher.querySelectorAll(".glc-launch-item")).some(
          (el2) => el2.style.display !== "none"
        );
        launcher.style.display = anyVisible ? "" : "none";
      }
    };
    const initialHideMenu = !!readGlcPath(HIDE_MENU_PATH);
    hideMenuToggle.checked = initialHideMenu;
    setLauncherHidden(initialHideMenu);
    hideMenuToggle.addEventListener("change", () => {
      const hidden = hideMenuToggle.checked;
      writeGlcPath(HIDE_MENU_PATH, hidden);
      setLauncherHidden(hidden);
    });
    const draftActionsRow = document.createElement("div");
    draftActionsRow.style.display = "flex";
    draftActionsRow.style.gap = "12px";
    draftActionsRow.style.flexWrap = "wrap";
    const resetDraftBtn = ui.btn("Reset draft", {
      variant: "secondary",
      fullWidth: false
    });
    const previewLayoutBtn = ui.btn("Preview Layout", {
      variant: "secondary",
      fullWidth: false
    });
    const loadFromGardenBtn = ui.btn("Load from garden", {
      variant: "secondary",
      fullWidth: false
    });
    resetDraftBtn.style.width = "auto";
    previewLayoutBtn.style.width = "auto";
    loadFromGardenBtn.style.width = "auto";
    const clearRightWrap = document.createElement("div");
    clearRightWrap.style.display = "flex";
    clearRightWrap.style.alignItems = "center";
    clearRightWrap.style.gap = "6px";
    clearRightWrap.style.marginLeft = "auto";
    const clearRightToggle = ui.switch(false);
    const clearRightLabel = document.createElement("div");
    clearRightLabel.textContent = "Clear Right";
    clearRightLabel.style.fontSize = "12px";
    clearRightLabel.style.opacity = "0.8";
    clearRightWrap.append(clearRightLabel, clearRightToggle);
    draftActionsRow.append(resetDraftBtn, previewLayoutBtn, loadFromGardenBtn, clearRightWrap);
    const savedLayoutsWrap = document.createElement("div");
    savedLayoutsWrap.style.display = "flex";
    savedLayoutsWrap.style.flexDirection = "column";
    savedLayoutsWrap.style.gap = "12px";
    savedLayoutsWrap.style.maxHeight = "none";
    savedLayoutsWrap.style.overflow = "visible";
    const ioCard = ui.card("Import / Export", {
      description: "Import or export Layout Creator layouts directly through JSON files."
    });
    ioCard.body.style.display = "flex";
    ioCard.body.style.flexDirection = "column";
    ioCard.body.style.gap = "10px";
    const ioStatus = createStatusLine();
    const exportButton = createActionButton("Export Layouts");
    exportButton.style.width = "100%";
    exportButton.style.boxSizing = "border-box";
    exportButton.addEventListener("click", () => {
      const payload = GardenLayoutService.exportLoadouts();
      const filename = `GLC-Layouts-${Date.now()}.json`;
      downloadJSONFile(filename, payload);
      showStatus(ioStatus, true, "Layouts exported as JSON file.");
    });
    const importWrapper = document.createElement("div");
    importWrapper.style.display = "flex";
    importWrapper.style.flexDirection = "column";
    importWrapper.style.gap = "8px";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json,application/json,text/plain";
    fileInput.style.display = "none";
    const fileCard = document.createElement("div");
    Object.assign(fileCard.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      padding: "18px 22px",
      width: "100%",
      minHeight: "110px",
      borderRadius: "14px",
      border: "1px dashed #5d6a7d",
      background: "linear-gradient(180deg, #0b141c, #091018)",
      transition: "border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease",
      cursor: "pointer",
      textAlign: "center"
    });
    fileCard.tabIndex = 0;
    fileCard.setAttribute("role", "button");
    fileCard.setAttribute("aria-label", "Import layouts JSON");
    const fileCardTitle = document.createElement("div");
    fileCardTitle.textContent = "Import layouts";
    Object.assign(fileCardTitle.style, {
      fontWeight: "600",
      fontSize: "14px",
      letterSpacing: "0.02em"
    });
    const fileStatus = document.createElement("div");
    const defaultStatusText = "Drop a JSON file or click to browse.";
    fileStatus.textContent = defaultStatusText;
    Object.assign(fileStatus.style, {
      fontSize: "12px",
      opacity: "0.75"
    });
    fileCard.append(fileCardTitle, fileStatus);
    const setFileCardActive = (active) => {
      if (active) {
        fileCard.style.borderColor = "#6fc3ff";
        fileCard.style.boxShadow = "0 0 0 3px #6fc3ff22";
        fileCard.style.background = "linear-gradient(180deg, #102030, #0b1826)";
      } else {
        fileCard.style.borderColor = "#5d6a7d";
        fileCard.style.boxShadow = "none";
        fileCard.style.background = "linear-gradient(180deg, #0b141c, #091018)";
      }
    };
    const triggerFileSelect = () => fileInput.click();
    const displaySelection = (files) => {
      if (!files || !files.length) {
        fileStatus.textContent = defaultStatusText;
        return;
      }
      fileStatus.textContent = files.length === 1 ? files[0].name : `${files.length} files selected`;
    };
    fileCard.addEventListener("mouseenter", () => setFileCardActive(true));
    fileCard.addEventListener("mouseleave", () => setFileCardActive(document.activeElement === fileCard));
    fileCard.addEventListener("focus", () => setFileCardActive(true));
    fileCard.addEventListener("blur", () => setFileCardActive(false));
    fileCard.addEventListener("click", triggerFileSelect);
    fileCard.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        triggerFileSelect();
      }
    });
    fileCard.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      setFileCardActive(true);
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = "copy";
    });
    fileCard.addEventListener("dragleave", () => setFileCardActive(document.activeElement === fileCard));
    fileCard.addEventListener("drop", (ev) => {
      ev.preventDefault();
      setFileCardActive(false);
      const files = ev.dataTransfer?.files;
      if (!files || !files.length) return;
      fileInput.files = files;
      displaySelection(files);
      void handleImport(files);
    });
    const handleImport = async (files) => {
      const f = files?.[0];
      if (!f) return;
      try {
        const text = await f.text();
        const result = GardenLayoutService.importLoadouts(text);
        showStatus(ioStatus, result.success, result.message);
        if (result.success) {
          renderSavedLayouts();
        }
      } catch {
        showStatus(ioStatus, false, "Failed to import JSON file.");
      } finally {
        fileInput.value = "";
      }
    };
    fileInput.addEventListener("change", () => {
      const files = fileInput.files;
      displaySelection(files);
      void handleImport(files);
    });
    importWrapper.append(fileInput, fileCard);
    ioCard.body.append(importWrapper, ioStatus, exportButton);
    const loadoutsSection = document.createElement("div");
    loadoutsSection.style.display = "grid";
    loadoutsSection.style.gap = "12px";
    loadoutsSection.style.transition = "opacity 160ms ease, max-height 160ms ease";
    loadoutsSection.style.overflow = "hidden";
    loadoutsSection.append(savedLayoutsWrap, ioCard.root);
    layoutWrap.append(
      headerRow,
      selectionRow,
      pickerRow,
      plantPickerGrid,
      decorPickerGrid,
      mutationPickerGrid,
      gridWrap,
      layoutActionsRow,
      draftActionsRow,
      layoutStatus,
      loadoutsSection
    );
    const layoutCard = sectionCard("", layoutWrap);
    layoutCard.root.style.alignSelf = "stretch";
    layoutCard.root.style.flex = "0 0 auto";
    layoutCard.root.style.flexShrink = "0";
    layoutCard.root.style.position = "relative";
    layoutCard.header.style.display = "flex";
    layoutCard.header.style.alignItems = "center";
    layoutCard.header.style.gap = "12px";
    layoutCard.header.style.paddingBottom = "0";
    const titleEl = layoutCard.header.querySelector(".qmm-card__title");
    if (titleEl) {
      titleEl.textContent = "";
      titleEl.style.display = "none";
    }
    layoutCard.header.appendChild(tabsRow);
    const windowEl = ui.root.closest(".glc-win");
    const windowBody = windowEl?.querySelector(".w-body") ?? null;
    const windowHead = windowEl?.querySelector(".w-head") ?? null;
    const minBtn = windowHead?.querySelector('[data-act="min"]') ?? null;
    let loadoutsHidden = false;
    let layoutsNaturalHeight = 0;
    const measureNaturalHeight = () => {
      if (layoutsNaturalHeight === 0 && loadoutsSection.offsetHeight > 0) {
        layoutsNaturalHeight = loadoutsSection.scrollHeight;
        loadoutsSection.style.maxHeight = `${layoutsNaturalHeight}px`;
      }
    };
    const applyHalfState = () => {
      if (!loadoutsHidden) {
        measureNaturalHeight();
        loadoutsSection.style.maxHeight = layoutsNaturalHeight > 0 ? `${layoutsNaturalHeight}px` : "none";
        loadoutsSection.style.display = "grid";
        loadoutsSection.style.visibility = "visible";
        loadoutsSection.style.pointerEvents = "auto";
        loadoutsSection.style.opacity = "1";
      } else {
        if (layoutsNaturalHeight === 0) {
          layoutsNaturalHeight = loadoutsSection.scrollHeight;
        }
        loadoutsSection.style.maxHeight = "0px";
        loadoutsSection.style.visibility = "hidden";
        loadoutsSection.style.pointerEvents = "none";
        loadoutsSection.style.opacity = "0";
      }
    };
    const updateLoadoutsHeight = () => {
      layoutsNaturalHeight = loadoutsSection.scrollHeight;
      loadoutsSection.style.maxHeight = `${layoutsNaturalHeight}px`;
    };
    if (windowHead) {
      const headTitle = windowHead.querySelector(".w-title");
      if (headTitle) headTitle.textContent = "\u{1F9F1} Garden Layout Creator";
      const existing = windowHead.querySelector('[data-act="settings"]');
      if (existing) existing.remove();
      const gearButton = document.createElement("button");
      gearButton.className = "w-btn";
      gearButton.dataset.act = "settings";
      gearButton.title = "Settings";
      gearButton.textContent = "\u2699";
      gearButton.addEventListener("click", () => {
        settingsPanel.style.display = settingsPanel.style.display === "none" ? "block" : "none";
      });
      const versionBadge = document.createElement("span");
      versionBadge.id = "glc-version-layout";
      versionBadge.className = "pill warn";
      versionBadge.style.padding = "4px 8px";
      versionBadge.style.borderRadius = "999px";
      versionBadge.style.border = "1px solid rgba(255,255,255,0.15)";
      versionBadge.style.background = "rgba(255,255,255,0.06)";
      versionBadge.style.color = "#e7eef7";
      versionBadge.style.fontSize = "12px";
      versionBadge.style.lineHeight = "1.2";
      versionBadge.style.whiteSpace = "nowrap";
      const downloadUrl = "https://raw.githubusercontent.com/Hyrulien/GardenLayoutCreator/main/dist/LayoutCreator.user.js";
      const setBadge = (text, cls) => {
        versionBadge.textContent = text;
        versionBadge.classList.remove("ok", "warn", "bad");
        versionBadge.classList.add(cls);
        if (cls === "ok") {
          versionBadge.style.background = "rgba(36, 161, 72, 0.20)";
          versionBadge.style.borderColor = "#48d17066";
        } else if (cls === "warn") {
          versionBadge.style.background = "rgba(241, 194, 27, 0.18)";
          versionBadge.style.borderColor = "#ffd65c66";
        } else {
          versionBadge.style.background = "rgba(218, 30, 40, 0.20)";
          versionBadge.style.borderColor = "#ff7c8666";
        }
      };
      const setDownloadTarget = (url) => {
        if (url) {
          versionBadge.dataset.download = url;
          versionBadge.style.cursor = "pointer";
          versionBadge.title = "Download the new version";
        } else {
          delete versionBadge.dataset.download;
          versionBadge.style.removeProperty("cursor");
          versionBadge.removeAttribute("title");
        }
      };
      const openDownloadLink = (url) => {
        const shouldUseGM = isDiscordSurface();
        const gmOpen = typeof globalThis.GM_openInTab === "function" ? globalThis.GM_openInTab : typeof globalThis?.GM?.openInTab === "function" ? globalThis.GM.openInTab.bind(globalThis.GM) : null;
        if (shouldUseGM && gmOpen) {
          try {
            gmOpen(url, { active: true, setParent: true });
            return;
          } catch (error) {
            console.warn("[GLC] GM_openInTab failed, falling back to window.open", error);
          }
        }
        window.open(url, "_blank", "noopener,noreferrer");
      };
      versionBadge.addEventListener("click", () => {
        const url = versionBadge.dataset.download;
        if (url) {
          openDownloadLink(url);
        }
      });
      setBadge("checking\u2026", "warn");
      setDownloadTarget(null);
      (async () => {
        const localVersion = getLocalVersion();
        try {
          const remoteData = await fetchRemoteVersion();
          const remoteVersion = remoteData?.version?.trim();
          if (!remoteVersion) {
            setBadge(localVersion || "Unknown", "warn");
            return;
          }
          if (!localVersion) {
            setBadge(remoteVersion, "warn");
            setDownloadTarget(downloadUrl);
            return;
          }
          if (localVersion === remoteVersion) {
            setBadge(localVersion, "ok");
            setDownloadTarget(null);
            return;
          }
          setBadge(`${localVersion} \u2192 ${remoteVersion}`, "warn");
          setDownloadTarget(downloadUrl);
        } catch (error) {
          console.error("[GLC] Failed to check version:", error);
          setBadge(localVersion || "Unknown", "warn");
        }
      })();
      const applyHeaderBtn = document.createElement("button");
      applyHeaderBtn.className = "w-btn";
      applyHeaderBtn.dataset.act = "apply";
      applyHeaderBtn.title = "Apply current layout";
      applyHeaderBtn.textContent = "\u25B6";
      applyHeaderBtn.addEventListener("click", async () => {
        const slotsAvailable = normalizeInventorySlots(Number(inventoryInput.value));
        inventoryInput.value = String(slotsAvailable);
        const ok = await GardenLayoutService.applyGarden(draft, {
          ignoreInventory: EditorService.isEnabled(),
          clearTargetTiles: true,
          inventorySlotsAvailable: Number.isFinite(slotsAvailable) ? Math.max(0, Math.floor(slotsAvailable)) : 0
        });
        if (!ok) return;
        if (!clearLeftToggle.checked && !clearRightToggle.checked) return;
        const slotsLimit = Number.isFinite(slotsAvailable) ? Math.max(0, Math.floor(slotsAvailable)) : 0;
        if (slotsLimit <= 0) return;
        const { tasks, blocked } = await GardenLayoutService.getClearSideTasks(draft, {
          clearLeft: clearLeftToggle.checked,
          clearRight: clearRightToggle.checked
        });
        if (!tasks.length) return;
        if (tasks.length > slotsLimit) {
          const proceed = window.confirm(
            `Clearing ${tasks.length} items needs ${slotsLimit} free slots. Only ${slotsLimit} items will be picked up. Continue?`
          );
          if (!proceed) return;
        }
        await GardenLayoutService.clearSideTasks(tasks, slotsLimit);
      });
      const halfButton = document.createElement("button");
      halfButton.className = "w-btn";
      halfButton.dataset.act = "half";
      halfButton.title = "Toggle layouts";
      halfButton.textContent = "\u25AD";
      const lockWindowPosition = () => {
        if (!windowEl) return;
        const rect = windowEl.getBoundingClientRect();
        windowEl.style.top = `${rect.top}px`;
        windowEl.style.left = `${rect.left}px`;
        windowEl.style.right = "auto";
        windowEl.style.bottom = "auto";
      };
      const clampWindowPosition = () => {
        if (!windowEl) return;
        const margin = 8;
        const rect = windowEl.getBoundingClientRect();
        const maxX = window.innerWidth - windowEl.offsetWidth - margin;
        const maxY = window.innerHeight - windowEl.offsetHeight - margin;
        const nextLeft = Math.max(margin, Math.min(maxX, rect.left));
        const nextTop = Math.max(margin, Math.min(maxY, rect.top));
        windowEl.style.left = `${nextLeft}px`;
        windowEl.style.top = `${nextTop}px`;
        windowEl.style.right = "auto";
        windowEl.style.bottom = "auto";
      };
      halfButton.addEventListener("click", () => {
        if (windowEl && windowBody && windowBody.style.display !== "none") {
          lockWindowPosition();
          loadoutsHidden = !loadoutsHidden;
          applyHalfState();
          const transitionMs = 160;
          window.setTimeout(() => {
            clampWindowPosition();
          }, transitionMs + 60);
        } else {
          loadoutsHidden = !loadoutsHidden;
          applyHalfState();
          clampWindowPosition();
        }
      });
      requestAnimationFrame(() => {
        if (layoutsNaturalHeight === 0) {
          layoutsNaturalHeight = loadoutsSection.scrollHeight;
          if (layoutsNaturalHeight > 0) {
            loadoutsSection.style.maxHeight = `${layoutsNaturalHeight}px`;
          }
        }
        applyHalfState();
      });
      if (minBtn) {
        windowHead.insertBefore(versionBadge, minBtn);
        windowHead.insertBefore(gearButton, minBtn);
        windowHead.insertBefore(applyHeaderBtn, minBtn);
        windowHead.insertBefore(halfButton, minBtn);
      } else {
        windowHead.append(versionBadge, gearButton, applyHeaderBtn, halfButton);
      }
    }
    layoutCard.root.append(settingsPanel);
    const requirementsWin = document.createElement("div");
    requirementsWin.className = "glc-win";
    requirementsWin.style.position = "fixed";
    requirementsWin.style.width = "max-content";
    requirementsWin.style.maxWidth = "max-content";
    requirementsWin.style.minHeight = "120px";
    requirementsWin.style.zIndex = "9999";
    requirementsWin.innerHTML = `
    <div class="w-head">
      <div class="w-title">Requirements</div>
      <div class="sp"></div>
    </div>
    <div class="w-body"></div>
  `;
    const reqBody = requirementsWin.querySelector(".w-body");
    reqBody.appendChild(requirementsWrap);
    (document.documentElement || document.body).appendChild(requirementsWin);
    const positionRequirements = () => {
      if (!windowEl) return;
      const minimized = windowBody?.style.display === "none";
      const hidden = windowEl.classList.contains("is-hidden") || windowEl.style.display === "none" || minimized;
      requirementsWin.style.display = hidden ? "none" : "";
      if (hidden) return;
      const rect = windowEl.getBoundingClientRect();
      requirementsWin.style.top = `${rect.top}px`;
      requirementsWin.style.left = `${rect.right + 8}px`;
    };
    let reqRaf = 0;
    const tickRequirements = () => {
      positionRequirements();
      reqRaf = window.requestAnimationFrame(tickRequirements);
    };
    tickRequirements();
    view.append(layoutCard.root);
    let currentKind = "Dirt";
    let lastDirtType = "plant";
    let selectedTile = null;
    let draft = GardenLayoutService.getEmptyGarden();
    let currentGarden = GardenLayoutService.getEmptyGarden();
    let currentTiles = [];
    const tileCells = /* @__PURE__ */ new Map();
    let missingPlantTiles = /* @__PURE__ */ new Set();
    let missingDecorTiles = /* @__PURE__ */ new Set();
    let blockedTiles = /* @__PURE__ */ new Set();
    let liveEggTiles = {
      Dirt: /* @__PURE__ */ new Set(),
      Boardwalk: /* @__PURE__ */ new Set()
    };
    let clearMarkedTiles = {
      Dirt: /* @__PURE__ */ new Set(),
      Boardwalk: /* @__PURE__ */ new Set()
    };
    let isDragging = false;
    let dragMode = "apply";
    let clearDragActive = false;
    let previewActive2 = false;
    const ignoredTilesByType = {
      Dirt: /* @__PURE__ */ new Set(),
      Boardwalk: /* @__PURE__ */ new Set()
    };
    const syncIgnoredFromDraft = () => {
      const dirt = Array.isArray(draft.ignoredTiles?.dirt) ? draft.ignoredTiles.dirt : [];
      const board = Array.isArray(draft.ignoredTiles?.boardwalk) ? draft.ignoredTiles.boardwalk : [];
      ignoredTilesByType.Dirt = new Set(dirt.filter((n) => Number.isFinite(n)));
      ignoredTilesByType.Boardwalk = new Set(board.filter((n) => Number.isFinite(n)));
    };
    const writeIgnoredToDraft = () => {
      draft.ignoredTiles = {
        dirt: Array.from(ignoredTilesByType.Dirt.values()),
        boardwalk: Array.from(ignoredTilesByType.Boardwalk.values())
      };
    };
    const isIgnoredTile = (idx) => ignoredTilesByType[currentKind].has(idx);
    const isEggTile = (idx) => liveEggTiles[currentKind].has(idx);
    syncIgnoredFromDraft();
    const updateClearMarkers = async () => {
      if (!clearLeftToggle.checked && !clearRightToggle.checked) {
        clearMarkedTiles.Dirt.clear();
        clearMarkedTiles.Boardwalk.clear();
        for (const idx of tileCells.keys()) {
          updateTileCell(idx);
        }
        return;
      }
      try {
        const { tasks } = await GardenLayoutService.getClearSideTasks(draft, {
          clearLeft: clearLeftToggle.checked,
          clearRight: clearRightToggle.checked
        });
        const dirtSet = /* @__PURE__ */ new Set();
        const boardSet = /* @__PURE__ */ new Set();
        for (const task of tasks) {
          if (task.tileType === "Dirt") {
            dirtSet.add(task.localIdx);
          } else {
            boardSet.add(task.localIdx);
          }
        }
        clearMarkedTiles.Dirt = dirtSet;
        clearMarkedTiles.Boardwalk = boardSet;
        for (const idx of tileCells.keys()) {
          updateTileCell(idx);
        }
      } catch {
      }
    };
    const setLayoutStatus = (msg) => {
      layoutStatus.textContent = msg;
    };
    const updateSelectionLabel = () => {
      selectionCount.textContent = `${selectedTile == null ? 0 : 1} tiles selected`;
    };
    const hasDraftTiles = () => Object.keys(draft.tileObjects || {}).length > 0 || Object.keys(draft.boardwalkTileObjects || {}).length > 0;
    const saveNewLayout = () => {
      if (!hasDraftTiles()) {
        console.log("[GLC GardenLayout] save skipped (empty draft)");
        return;
      }
      const saved = GardenLayoutService.saveLayout("Untitled", draft);
      renderSavedLayouts();
    };
    const refreshRequirementInfo = async () => {
      const [list, availability, mutationAvailability, decorAvailability, liveGarden] = await Promise.all([
        GardenLayoutService.getRequirementSummary(draft),
        GardenLayoutService.getPlantAvailabilityCounts(draft.ignoredTiles),
        GardenLayoutService.getPlantAvailabilityMutationCounts(draft.ignoredTiles),
        GardenLayoutService.getDecorAvailabilityCounts(draft.ignoredTiles),
        GardenLayoutService.getCurrentGarden()
      ]);
      currentGarden = liveGarden || GardenLayoutService.getEmptyGarden();
      const nextEggs = {
        Dirt: /* @__PURE__ */ new Set(),
        Boardwalk: /* @__PURE__ */ new Set()
      };
      for (const [key, obj] of Object.entries(currentGarden.tileObjects || {})) {
        if (!obj || typeof obj !== "object") continue;
        const type = String(obj.objectType ?? obj.type ?? "").toLowerCase();
        if (type !== "egg") continue;
        const idx = Number(key);
        if (Number.isFinite(idx)) nextEggs.Dirt.add(idx);
      }
      for (const [key, obj] of Object.entries(currentGarden.boardwalkTileObjects || {})) {
        if (!obj || typeof obj !== "object") continue;
        const type = String(obj.objectType ?? obj.type ?? "").toLowerCase();
        if (type !== "egg") continue;
        const idx = Number(key);
        if (Number.isFinite(idx)) nextEggs.Boardwalk.add(idx);
      }
      liveEggTiles = nextEggs;
      const ignoredDirt = ignoredTilesByType.Dirt;
      const ignoredBoard = ignoredTilesByType.Boardwalk;
      const nextMissing = /* @__PURE__ */ new Set();
      const plantCounts = /* @__PURE__ */ new Map();
      const plantMutationCounts = /* @__PURE__ */ new Map();
      const entries = Object.entries(draft.tileObjects || {}).sort(([a], [b]) => Number(a) - Number(b));
      for (const [key, obj] of entries) {
        const idx = Number(key);
        if (Number.isFinite(idx) && ignoredDirt.has(idx)) continue;
        if (!obj || typeof obj !== "object") continue;
        const type = String(obj.objectType || "").toLowerCase();
        if (type !== "plant") continue;
        const rawSpecies = String(obj.species || obj.seedKey || "");
        const species = GardenLayoutService.resolvePlantSpecies(rawSpecies);
        if (!species) continue;
        const mutation = typeof obj.glcMutation === "string" ? GardenLayoutService.normalizeMutation(String(obj.glcMutation)) : "";
        if (mutation) {
          const key2 = `${species}::${mutation}`;
          const used = (plantMutationCounts.get(key2) || 0) + 1;
          plantMutationCounts.set(key2, used);
          const have = mutationAvailability.get(key2) || 0;
          if (used > have && Number.isFinite(idx)) nextMissing.add(idx);
        } else {
          const used = (plantCounts.get(species) || 0) + 1;
          plantCounts.set(species, used);
          const have = availability.get(species) || 0;
          if (used > have && Number.isFinite(idx)) nextMissing.add(idx);
        }
      }
      missingPlantTiles = nextMissing;
      const nextMissingDecor = /* @__PURE__ */ new Set();
      const decorCounts = /* @__PURE__ */ new Map();
      const addDecorEntries = (tileType, map, ignoredSet) => {
        for (const [key, obj] of Object.entries(map || {})) {
          const idx = Number(key);
          if (Number.isFinite(idx) && ignoredSet.has(idx)) continue;
          if (!obj || typeof obj !== "object") continue;
          const type = String(obj.objectType || "").toLowerCase();
          if (type !== "decor") continue;
          const decorId = String(obj.decorId || "");
          if (!decorId) continue;
          const used = (decorCounts.get(decorId) || 0) + 1;
          decorCounts.set(decorId, used);
          const have = decorAvailability.get(decorId) || 0;
          if (used > have) {
            nextMissingDecor.add(`${tileType}:${key}`);
          }
        }
      };
      addDecorEntries("Dirt", draft.tileObjects || {}, ignoredDirt);
      addDecorEntries("Boardwalk", draft.boardwalkTileObjects || {}, ignoredBoard);
      missingDecorTiles = nextMissingDecor;
      const nextBlocked = /* @__PURE__ */ new Set();
      const draftMap = currentKind === "Dirt" ? draft.tileObjects : draft.boardwalkTileObjects;
      const currentMap = currentKind === "Dirt" ? currentGarden.tileObjects : currentGarden.boardwalkTileObjects;
      const ignoredCurrent = currentKind === "Dirt" ? ignoredDirt : ignoredBoard;
      for (const [key, obj] of Object.entries(draftMap || {})) {
        const idx = Number(key);
        if (Number.isFinite(idx) && ignoredCurrent.has(idx)) continue;
        if (!obj || typeof obj !== "object") continue;
        const curObj = (currentMap || {})[key];
        if (!curObj || typeof curObj !== "object") continue;
        const curType = String(curObj.objectType ?? curObj.type ?? "").toLowerCase();
        if (curType !== "egg") continue;
        const nextType = String(obj.objectType ?? obj.type ?? "").toLowerCase();
        const sameEgg = nextType === "egg" && String(obj.eggId ?? "") === String(curObj.eggId ?? "");
        if (!sameEgg) nextBlocked.add(Number(key));
      }
      blockedTiles = nextBlocked;
      requirementsWrap.replaceChildren();
      if (!list.length) {
        const empty = document.createElement("div");
        empty.textContent = "No requirements";
        empty.style.opacity = "0.7";
        requirementsWrap.appendChild(empty);
      } else {
        for (const item of list) {
          const row = document.createElement("div");
          row.style.display = "flex";
          row.style.alignItems = "center";
          row.style.gap = "6px";
          row.style.whiteSpace = "nowrap";
          row.style.color = item.have >= item.needed ? "#58d38a" : "#ff6b6b";
          const icon = document.createElement("div");
          icon.style.width = "16px";
          icon.style.height = "16px";
          if (item.type === "plant") {
            const size = SEED_ICON_PLANTS.has(item.id) ? 18 : 14;
            attachSpriteIcon(icon, getPlantIconCategories(item.id), item.id, size, "editor-req-plant");
          } else {
            attachSpriteIcon(icon, ["decor"], item.id, 14, "editor-req-decor");
          }
          const label = document.createElement("div");
          const displayName = item.type === "plant" ? getPlantDisplayName(item.id) : getDecorDisplayName(item.id);
          const mutationLabel = item.type === "plant" && item.mutation ? ` (${getMutationDisplayName(item.mutation)})` : "";
          label.textContent = `${displayName}${mutationLabel} ${item.have}/${item.needed}`;
          row.append(icon, label);
          requirementsWrap.appendChild(row);
        }
      }
      for (const idx of tileCells.keys()) {
        updateTileCell(idx);
      }
    };
    let reqRefreshBusy = false;
    let reqRefreshTimer = 0;
    const scheduleRequirementRefresh = () => {
      if (reqRefreshBusy) return;
      reqRefreshBusy = true;
      refreshRequirementInfo().finally(() => {
        reqRefreshBusy = false;
      });
    };
    const syncTypeOptions = () => {
      if (currentKind === "Boardwalk") {
        typeSelect.innerHTML = `<option value="decor">Decor</option>`;
        typeSelect.value = "decor";
      } else {
        typeSelect.innerHTML = `
        <option value="plant">Plant</option>
        <option value="decor">Decor</option>
        <option value="mutation">Mutation</option>
      `;
        typeSelect.value = lastDirtType || "plant";
      }
      updatePickerVisibility();
      updatePickerPreview();
    };
    const updatePickerVisibility = () => {
      const type = typeSelect.value;
      pickerRow.innerHTML = "";
      pickerRow.append(typeSelect);
      if (type === "plant") pickerRow.append(plantPickerWrap);
      else if (type === "decor") pickerRow.append(decorPickerWrap);
      else if (type === "mutation") pickerRow.append(mutationPickerWrap);
      if (type !== "plant") plantPickerGrid.style.display = "none";
      if (type !== "decor") decorPickerGrid.style.display = "none";
      if (type !== "mutation") mutationPickerGrid.style.display = "none";
    };
    const updatePickerPreview = () => {
      const type = typeSelect.value;
      if (type === "plant") {
        const id = plantSelect.value;
        plantPreview.replaceChildren();
        if (id) {
          const size = SEED_ICON_PLANTS.has(id) ? SEED_ICON_SIZE : 20;
          plantPreview.style.width = `${size}px`;
          plantPreview.style.height = `${size}px`;
          attachSpriteIcon(plantPreview, getPlantIconCategories(id), id, size, "editor-plant");
        }
        plantPickerBtn.textContent = id ? getPlantDisplayName(id) : "Pick plant";
      } else if (type === "decor") {
        const id = decorSelect.value;
        plantPreview.style.width = "30px";
        plantPreview.style.height = "30px";
        decorPreview.replaceChildren();
        if (id) attachSpriteIcon(decorPreview, ["decor"], id, 20, "editor-decor");
        decorPickerBtn.textContent = id ? getDecorDisplayName(id) : "Pick decor";
      } else if (type === "mutation") {
        const id = mutationSelect.value;
        plantPreview.style.width = "30px";
        plantPreview.style.height = "30px";
        mutationPreview.replaceChildren();
        if (id) attachSpriteIcon(mutationPreview, ["mutation"], id, 20, "editor-mutation");
        mutationPickerBtn.textContent = id ? getMutationDisplayName(id) : "Pick mutation";
      }
    };
    const clearTileByIdx = (idx) => {
      if (isIgnoredTile(idx)) return;
      if (isEggTile(idx)) return;
      const map = currentKind === "Dirt" ? draft.tileObjects : draft.boardwalkTileObjects;
      if (map[String(idx)]) {
        delete map[String(idx)];
        updateTileCell(idx);
        void refreshRequirementInfo();
      }
    };
    const clearMutationByIdx = (idx) => {
      if (isIgnoredTile(idx)) return;
      if (isEggTile(idx)) return;
      const map = currentKind === "Dirt" ? draft.tileObjects : draft.boardwalkTileObjects;
      const obj = map[String(idx)];
      if (!obj || typeof obj !== "object") return;
      const type = String(obj.objectType || "").toLowerCase();
      if (type !== "plant") return;
      if (!obj.glcMutation) return;
      delete obj.glcMutation;
      map[String(idx)] = obj;
      updateTileCell(idx);
      void refreshRequirementInfo();
    };
    const renderGrid = () => {
      tilesWrap.innerHTML = "";
      tileCells.clear();
      if (!currentTiles.length) {
        const empty = document.createElement("div");
        empty.textContent = "Garden tiles not ready.";
        empty.style.fontSize = "12px";
        empty.style.opacity = "0.7";
        tilesWrap.appendChild(empty);
        return;
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      const byPos = /* @__PURE__ */ new Map();
      for (const t of currentTiles) {
        minX = Math.min(minX, t.x);
        minY = Math.min(minY, t.y);
        maxX = Math.max(maxX, t.x);
        maxY = Math.max(maxY, t.y);
        byPos.set(`${t.x},${t.y}`, t);
      }
      const cols = maxX - minX + 1;
      const rows = maxY - minY + 1;
      tilesWrap.style.gridTemplateColumns = `repeat(${cols}, 30px)`;
      tilesWrap.style.gridTemplateRows = `repeat(${rows}, 30px)`;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const tile = byPos.get(`${x},${y}`);
          const cell = document.createElement("button");
          cell.type = "button";
          cell.style.width = "30px";
          cell.style.height = "30px";
          cell.style.padding = "0";
          cell.style.borderRadius = "8px";
          cell.style.border = "1px solid rgba(255,255,255,0.12)";
          cell.style.background = tile ? "rgba(48, 58, 72, 0.9)" : "transparent";
          cell.style.color = "#e7eef7";
          cell.style.fontSize = "11px";
          cell.style.cursor = tile ? "pointer" : "default";
          cell.style.display = "flex";
          cell.style.alignItems = "center";
          cell.style.justifyContent = "center";
          cell.style.position = "relative";
          if (!tile) {
            cell.disabled = true;
            tilesWrap.appendChild(cell);
            continue;
          }
          cell.dataset.localIdx = String(tile.localIdx);
          const icon = document.createElement("div");
          icon.className = "glc-tile-icon";
          icon.style.width = "20px";
          icon.style.height = "20px";
          icon.style.display = "flex";
          icon.style.alignItems = "center";
          icon.style.justifyContent = "center";
          cell.appendChild(icon);
          const eggIcon = document.createElement("div");
          eggIcon.className = "glc-tile-egg";
          eggIcon.style.position = "absolute";
          eggIcon.style.top = "50%";
          eggIcon.style.left = "50%";
          eggIcon.style.transform = "translate(-50%, -50%)";
          eggIcon.style.width = "18px";
          eggIcon.style.height = "18px";
          eggIcon.style.display = "none";
          eggIcon.style.alignItems = "center";
          eggIcon.style.justifyContent = "center";
          cell.appendChild(eggIcon);
          const clearIcon = document.createElement("div");
          clearIcon.className = "glc-tile-clear";
          clearIcon.style.position = "absolute";
          clearIcon.style.top = "0";
          clearIcon.style.left = "0";
          clearIcon.style.width = "100%";
          clearIcon.style.height = "100%";
          clearIcon.style.display = "none";
          clearIcon.style.alignItems = "center";
          clearIcon.style.justifyContent = "center";
          clearIcon.style.background = "rgba(255,50,50,0.3)";
          clearIcon.style.borderRadius = "8px";
          clearIcon.style.fontSize = "16px";
          clearIcon.style.fontWeight = "bold";
          clearIcon.style.color = "#ff3030";
          clearIcon.style.pointerEvents = "none";
          clearIcon.style.zIndex = "2";
          clearIcon.textContent = "\u2715";
          cell.appendChild(clearIcon);
          tileCells.set(tile.localIdx, cell);
          const applySelectedItemToTile = () => {
            const type = typeSelect.value;
            if (currentKind === "Boardwalk" && type !== "decor") return;
            if (type !== "mutation" && isIgnoredTile(tile.localIdx)) return;
            if (isEggTile(tile.localIdx)) return;
            const map = currentKind === "Dirt" ? draft.tileObjects : draft.boardwalkTileObjects;
            if (type === "mutation") {
              const obj2 = map[String(tile.localIdx)];
              if (!obj2 || typeof obj2 !== "object") return;
              const objType = String(obj2.objectType || "").toLowerCase();
              if (objType !== "plant") return;
              const selected = GardenLayoutService.normalizeMutation(mutationSelect.value);
              if (!selected) delete obj2.glcMutation;
              else obj2.glcMutation = selected;
              map[String(tile.localIdx)] = obj2;
              void refreshRequirementInfo();
              return;
            }
            const id = type === "plant" ? plantSelect.value : type === "decor" ? decorSelect.value : null;
            if (!id) return;
            const obj = GardenLayoutService.buildTileObject(type, id);
            if (!obj) {
              delete map[String(tile.localIdx)];
            } else {
              const prev = map[String(tile.localIdx)];
              if (obj.objectType === "plant" && prev && typeof prev === "object" && prev.glcMutation) {
                obj.glcMutation = prev.glcMutation;
              }
              map[String(tile.localIdx)] = obj;
            }
            void refreshRequirementInfo();
          };
          const applySelectionToTile = () => {
            const prev = selectedTile;
            selectedTile = tile.localIdx;
            applySelectedItemToTile();
            updateSelectionLabel();
            updateTileCell(tile.localIdx);
            if (prev != null && prev !== tile.localIdx) {
              updateTileCell(prev);
            }
          };
          const clearTileAt = () => {
            clearTileByIdx(tile.localIdx);
          };
          const applyIgnoreToTile = (remove) => {
            const set2 = ignoredTilesByType[currentKind];
            const had = set2.has(tile.localIdx);
            if (remove) {
              if (!had) return;
              set2.delete(tile.localIdx);
            } else {
              if (had) return;
              set2.add(tile.localIdx);
            }
            writeIgnoredToDraft();
            updateTileCell(tile.localIdx);
            void refreshRequirementInfo();
          };
          cell.addEventListener("contextmenu", (event) => {
            event.preventDefault();
          });
          cell.addEventListener("mousedown", (event) => {
            event.preventDefault();
            if (isEggTile(tile.localIdx)) return;
            const btn = event.button;
            if (btn === 2) {
              if (typeSelect.value === "mutation") {
                isDragging = true;
                dragMode = "mutation-clear";
                clearDragActive = false;
                clearMutationByIdx(tile.localIdx);
                if (selectedTile != null) {
                  const prev = selectedTile;
                  selectedTile = null;
                  updateSelectionLabel();
                  updateTileCell(prev);
                }
                return;
              }
              isDragging = true;
              dragMode = "clear";
              clearDragActive = true;
              clearTileAt();
              if (selectedTile != null) {
                const prev = selectedTile;
                selectedTile = null;
                updateSelectionLabel();
                updateTileCell(prev);
              }
              return;
            }
            if (btn !== 0) return;
            isDragging = true;
            clearDragActive = false;
            if (event.shiftKey) {
              const removing = isIgnoredTile(tile.localIdx);
              dragMode = removing ? "ignore-remove" : "ignore-add";
              applyIgnoreToTile(removing);
              return;
            }
            dragMode = "apply";
            applySelectionToTile();
          });
          cell.addEventListener("mouseenter", () => {
            if (!isDragging) return;
            if (dragMode === "clear") {
              clearTileAt();
              return;
            }
            if (dragMode === "mutation-clear") {
              clearMutationByIdx(tile.localIdx);
              return;
            }
            if (dragMode === "ignore-add" || dragMode === "ignore-remove") {
              applyIgnoreToTile(dragMode === "ignore-remove");
              return;
            }
            if (dragMode !== "apply") {
              isDragging = false;
              return;
            }
            applySelectionToTile();
          });
          tilesWrap.appendChild(cell);
          updateTileCell(tile.localIdx);
        }
      }
    };
    tilesWrap.addEventListener("mousemove", (event) => {
      if (!isDragging || dragMode !== "clear" || !clearDragActive) return;
      const el2 = document.elementFromPoint(event.clientX, event.clientY);
      const btn = el2?.closest?.("button[data-local-idx]");
      const idx = btn ? Number(btn.dataset.localIdx) : NaN;
      if (Number.isFinite(idx)) {
        clearTileByIdx(idx);
      }
    });
    const updateTileCell = (idx) => {
      const cell = tileCells.get(idx);
      if (!cell) return;
      const map = currentKind === "Dirt" ? draft.tileObjects : draft.boardwalkTileObjects;
      const obj = map[String(idx)];
      const label = GardenLayoutService.formatTileLabel(obj);
      cell.title = label || `Tile ${idx}`;
      const icon = cell.querySelector(".glc-tile-icon");
      const eggIcon = cell.querySelector(".glc-tile-egg");
      if (icon) {
        if (obj && typeof obj === "object") {
          const type = String(obj.objectType || "").toLowerCase();
          if (type === "plant") {
            const species = obj.species;
            const size = SEED_ICON_PLANTS.has(species) ? SEED_ICON_SIZE : 18;
            icon.style.width = `${size}px`;
            icon.style.height = `${size}px`;
            attachSpriteIcon(icon, getPlantIconCategories(species), species, size, "editor-tile-plant");
          } else if (type === "decor") {
            icon.style.width = "20px";
            icon.style.height = "20px";
            attachSpriteIcon(icon, ["decor"], obj.decorId, 18, "editor-tile-decor");
          } else {
            icon.style.width = "20px";
            icon.style.height = "20px";
            icon.replaceChildren();
          }
        } else {
          icon.style.width = "20px";
          icon.style.height = "20px";
          icon.replaceChildren();
        }
      }
      if (eggIcon) {
        if (!isEggTile(idx)) {
          eggIcon.style.display = "none";
          eggIcon.replaceChildren();
        } else {
          eggIcon.style.display = "flex";
          const liveMap = currentKind === "Dirt" ? currentGarden.tileObjects : currentGarden.boardwalkTileObjects;
          const curObj = liveMap[String(idx)];
          const eggId = curObj && typeof curObj === "object" ? String(curObj.eggId || "") : "";
          if (eggId) {
            const tileRef = eggCatalog?.[eggId]?.tileRef;
            const candidates = [eggId, `egg/${eggId}`, `pet/${eggId}`];
            if (Number.isFinite(tileRef)) candidates.push(String(tileRef));
            attachSpriteIcon(eggIcon, ["pet"], candidates, 18, "editor-tile-egg");
          }
        }
      }
      const clearIcon = cell.querySelector(".glc-tile-clear");
      if (clearIcon) {
        const isMarkedForClear = clearMarkedTiles[currentKind].has(idx);
        clearIcon.style.display = isMarkedForClear ? "flex" : "none";
      }
      const occupied = !!obj;
      const mutation = obj && typeof obj === "object" && typeof obj.glcMutation === "string" ? GardenLayoutService.normalizeMutation(String(obj.glcMutation)) : "";
      const isMissing = missingPlantTiles.has(idx) || missingDecorTiles.has(`${currentKind}:${idx}`);
      cell.style.borderImage = "none";
      cell.style.borderImageSlice = "";
      if (isIgnoredTile(idx)) {
        cell.style.borderColor = "#b266ff";
        cell.style.boxShadow = "0 0 0 2px rgba(178,102,255,0.7) inset";
      } else if (isEggTile(idx)) {
        cell.style.borderColor = "#f5c542";
        cell.style.boxShadow = "0 0 0 2px rgba(245,197,66,0.7) inset";
      } else if (selectedTile === idx) {
        cell.style.borderColor = "#3cd17a";
        cell.style.boxShadow = "0 0 0 2px rgba(60,209,122,0.7) inset";
      } else if (blockedTiles.has(idx)) {
        cell.style.borderColor = "#f5c542";
        cell.style.boxShadow = "0 0 0 2px rgba(245,197,66,0.7) inset";
      } else if (mutation && MUTATION_OUTLINES[mutation]) {
        const outline = MUTATION_OUTLINES[mutation];
        cell.style.borderColor = outline.border;
        if (isMissing) {
          cell.style.boxShadow = `${outline.shadow}, 0 0 8px 2px rgba(255,107,107,0.8)`;
        } else {
          cell.style.boxShadow = outline.shadow;
        }
        if (mutation === "Rainbow") {
          cell.style.border = "2px solid transparent";
          cell.style.borderRadius = "8px";
          cell.style.backgroundImage = "linear-gradient(rgba(48, 58, 72, 0.9), rgba(48, 58, 72, 0.9)), linear-gradient(90deg,#ff5a5a,#ffb347,#ffe97b,#8dff8d,#6ecbff,#b28dff)";
          cell.style.backgroundOrigin = "border-box";
          cell.style.backgroundClip = "padding-box, border-box";
        }
      } else if (isMissing) {
        cell.style.borderColor = "#ff6b6b";
        cell.style.boxShadow = "0 0 0 2px rgba(255,107,107,0.7) inset";
      } else if (occupied) {
        cell.style.borderColor = "#4a7dff";
        cell.style.boxShadow = "0 0 0 1px rgba(74,125,255,0.6) inset";
      } else {
        cell.style.borderColor = "rgba(255,255,255,0.12)";
        cell.style.boxShadow = "none";
      }
    };
    const refreshTiles = async () => {
      currentTiles = await GardenLayoutService.getTileGrid(currentKind);
      renderGrid();
    };
    const resetDraft = () => {
      draft = GardenLayoutService.getEmptyGarden();
      syncIgnoredFromDraft();
      selectedTile = null;
      updateSelectionLabel();
      renderGrid();
      void refreshRequirementInfo();
    };
    const stripEggs = (garden) => {
      const next = GardenLayoutService.getEmptyGarden();
      const copyMap = (source) => {
        const out = {};
        for (const [key, obj] of Object.entries(source || {})) {
          if (!obj || typeof obj !== "object") continue;
          const type = String(obj.objectType ?? obj.type ?? "").toLowerCase();
          if (type === "egg") continue;
          out[key] = obj;
        }
        return out;
      };
      next.tileObjects = copyMap(garden?.tileObjects || {});
      next.boardwalkTileObjects = copyMap(garden?.boardwalkTileObjects || {});
      const ignored = garden?.ignoredTiles;
      if (ignored && typeof ignored === "object") {
        next.ignoredTiles = {
          dirt: Array.isArray(ignored.dirt) ? ignored.dirt.filter((n) => Number.isFinite(n)) : [],
          boardwalk: Array.isArray(ignored.boardwalk) ? ignored.boardwalk.filter((n) => Number.isFinite(n)) : []
        };
      }
      return next;
    };
    const loadFromCurrentGarden = async () => {
      const current = await GardenLayoutService.getCurrentGarden();
      if (current && typeof current === "object") {
        draft = stripEggs(current);
        syncIgnoredFromDraft();
        renderGrid();
        void refreshRequirementInfo();
      } else {
      }
    };
    const maturePreviewObject = (obj) => {
      if (!obj || typeof obj !== "object") return obj;
      const type = String(obj.objectType ?? obj.type ?? "").toLowerCase();
      if (type !== "plant") return obj;
      const now = Date.now();
      const matureTs = now - 1e3;
      const mutation = typeof obj.glcMutation === "string" ? GardenLayoutService.normalizeMutation(String(obj.glcMutation)) : "";
      const clone = { ...obj };
      clone.plantedAt = matureTs;
      clone.maturedAt = matureTs;
      if (Array.isArray(clone.slots)) {
        clone.slots = clone.slots.map((slot) => ({
          ...slot,
          startTime: matureTs,
          endTime: matureTs,
          targetScale: slot?.targetScale ?? 1,
          mutations: mutation ? [mutation] : Array.isArray(slot?.mutations) ? slot.mutations : []
        }));
      }
      return clone;
    };
    const buildPreviewGarden = () => {
      const preview = {
        tileObjects: {},
        boardwalkTileObjects: {}
      };
      const addEggs = (currentMap, targetMap) => {
        for (const [key, obj] of Object.entries(currentMap || {})) {
          if (!obj || typeof obj !== "object") continue;
          const type = String(obj.objectType ?? obj.type ?? "").toLowerCase();
          if (type !== "egg") continue;
          targetMap[key] = obj;
        }
      };
      const applyDraft = (tileType, draftMap, currentMap, targetMap) => {
        const ignoredSet = tileType === "Dirt" ? ignoredTilesByType.Dirt : ignoredTilesByType.Boardwalk;
        for (const [key, obj] of Object.entries(draftMap || {})) {
          if (!obj || typeof obj !== "object") continue;
          const curObj = (currentMap || {})[key];
          const idx = Number(key);
          if (Number.isFinite(idx) && ignoredSet.has(idx)) {
            if (curObj) targetMap[key] = curObj;
            continue;
          }
          const curType = String(curObj?.objectType ?? curObj?.type ?? "").toLowerCase();
          const nextType = String(obj.objectType ?? obj.type ?? "").toLowerCase();
          if (curType === "egg") {
            const sameEgg = nextType === "egg" && String(obj.eggId ?? "") === String(curObj.eggId ?? "");
            if (!sameEgg) {
              if (curObj) {
                targetMap[key] = curObj;
              }
              continue;
            }
          }
          if (!previewAllToggle.checked && nextType === "plant" && Number.isFinite(idx) && missingPlantTiles.has(idx)) {
            if (curObj) {
              targetMap[key] = curObj;
            }
            continue;
          }
          if (!previewAllToggle.checked && nextType === "decor" && missingDecorTiles.has(`${tileType}:${key}`)) {
            if (curObj) {
              targetMap[key] = curObj;
            }
            continue;
          }
          targetMap[key] = maturePreviewObject(obj);
        }
      };
      addEggs(currentGarden.tileObjects || {}, preview.tileObjects);
      addEggs(currentGarden.boardwalkTileObjects || {}, preview.boardwalkTileObjects);
      applyDraft("Dirt", draft.tileObjects || {}, currentGarden.tileObjects || {}, preview.tileObjects);
      applyDraft(
        "Boardwalk",
        draft.boardwalkTileObjects || {},
        currentGarden.boardwalkTileObjects || {},
        preview.boardwalkTileObjects
      );
      return preview;
    };
    const previewLayout = async () => {
      if (previewActive2) return;
      await refreshRequirementInfo();
      const previewGarden = buildPreviewGarden();
      const previewFn = window?.glcEditorPreviewFriendGarden;
      const clearFn = window?.glcEditorClearFriendGardenPreview;
      if (typeof previewFn !== "function" || typeof clearFn !== "function") {
        return;
      }
      previewActive2 = true;
      await previewFn(previewGarden);
      const cleanup2 = () => {
        if (!previewActive2) return;
        previewActive2 = false;
        void clearFn();
        document.removeEventListener("keydown", onEsc, true);
        if (previewTimer) window.clearTimeout(previewTimer);
      };
      const onEsc = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cleanup2();
        }
      };
      document.addEventListener("keydown", onEsc, true);
      const previewTimer = window.setTimeout(() => {
        cleanup2();
      }, 5e3);
    };
    const renderSavedLayouts = () => {
      savedLayoutsWrap.innerHTML = "";
      const list = GardenLayoutService.listLayouts();
      if (!list.length) {
        const empty = document.createElement("div");
        empty.textContent = "No saved layouts yet.";
        empty.style.opacity = "0.7";
        empty.style.fontSize = "12px";
        savedLayoutsWrap.appendChild(empty);
        layoutsNaturalHeight = 0;
        requestAnimationFrame(() => {
          if (!loadoutsHidden) {
            updateLoadoutsHeight();
          }
        });
        return;
      }
      for (const g of list) {
        const row = document.createElement("div");
        row.style.display = "grid";
        row.style.gridTemplateColumns = "1fr auto auto auto auto";
        row.style.gap = "10px";
        row.style.alignItems = "center";
        row.style.padding = "10px";
        row.style.borderRadius = "10px";
        row.style.border = "1px solid #2b3441";
        row.style.background = "rgba(16,21,28,0.9)";
        const name = document.createElement("div");
        name.textContent = g.name || "Untitled";
        name.style.fontWeight = "700";
        name.style.fontSize = "15px";
        name.style.overflow = "hidden";
        name.style.textOverflow = "ellipsis";
        name.style.whiteSpace = "nowrap";
        name.style.cursor = "text";
        name.style.textAlign = "center";
        name.style.width = "100%";
        const nameInput = ui.inputText("", g.name || "Untitled");
        nameInput.style.display = "none";
        nameInput.style.width = "100%";
        nameInput.style.borderRadius = "8px";
        nameInput.style.border = "1px solid #2b3441";
        nameInput.style.background = "rgba(16,21,28,0.9)";
        nameInput.style.color = "#e7eef7";
        nameInput.style.padding = "6px 8px";
        nameInput.style.fontSize = "14px";
        nameInput.style.textAlign = "center";
        blockGameInput(nameInput);
        const beginEdit = () => {
          name.style.display = "none";
          nameInput.style.display = "block";
          nameInput.focus();
          nameInput.select();
        };
        const finishEdit = () => {
          const nextName = nameInput.value.trim() || "Untitled";
          if (GardenLayoutService.renameLayout(g.id, nextName)) {
            name.textContent = nextName;
          }
          nameInput.style.display = "none";
          name.style.display = "block";
          renderSavedLayouts();
        };
        name.addEventListener("click", beginEdit);
        nameInput.addEventListener("blur", finishEdit);
        nameInput.addEventListener("input", () => {
          const nextName = nameInput.value.trim() || "Untitled";
          if (GardenLayoutService.renameLayout(g.id, nextName)) {
            name.textContent = nextName;
          }
        });
        nameInput.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
            finishEdit();
          }
          if (event.key === "Escape") {
            nameInput.value = g.name || "Untitled";
            nameInput.style.display = "none";
            name.style.display = "block";
          }
        });
        const edit = ui.btn("Edit", {
          size: "md",
          onClick: () => {
            draft = g.garden;
            syncIgnoredFromDraft();
            renderGrid();
            void refreshRequirementInfo();
          }
        });
        const save = ui.btn("Save", {
          size: "md",
          onClick: () => {
            if (GardenLayoutService.updateLayout(g.id, draft)) {
              renderSavedLayouts();
            }
          }
        });
        const del = ui.btn("Delete", {
          size: "md",
          variant: "danger",
          onClick: () => {
            if (GardenLayoutService.deleteLayout(g.id)) {
              renderSavedLayouts();
            }
          }
        });
        const nameWrap = document.createElement("div");
        nameWrap.style.display = "grid";
        nameWrap.style.gridTemplateColumns = "1fr";
        nameWrap.style.justifyItems = "center";
        nameWrap.style.textAlign = "center";
        nameWrap.append(name, nameInput);
        row.append(nameWrap, edit, save, del);
        savedLayoutsWrap.appendChild(row);
      }
      layoutsNaturalHeight = 0;
      requestAnimationFrame(() => {
        if (!loadoutsHidden) {
          updateLoadoutsHeight();
        }
      });
    };
    const setActiveTab = (kind) => {
      if (currentKind === "Dirt") {
        lastDirtType = typeSelect.value;
      }
      currentKind = kind;
      const isDirt = kind === "Dirt";
      tabDirt.style.background = isDirt ? "#4a6fb8" : "";
      tabDirt.style.borderColor = isDirt ? "#4a6fb8" : "";
      tabBoard.style.background = !isDirt ? "#4a6fb8" : "";
      tabBoard.style.borderColor = !isDirt ? "#4a6fb8" : "";
      syncTypeOptions();
      scheduleRequirementRefresh();
    };
    tabDirt.addEventListener("click", () => {
      setActiveTab("Dirt");
      selectedTile = null;
      updateSelectionLabel();
      refreshTiles();
    });
    tabBoard.addEventListener("click", () => {
      setActiveTab("Boardwalk");
      selectedTile = null;
      updateSelectionLabel();
      refreshTiles();
    });
    const onMouseUp = () => {
      isDragging = false;
      clearDragActive = false;
    };
    document.addEventListener("mouseup", onMouseUp);
    cleanup = () => {
      document.removeEventListener("mouseup", onMouseUp);
      if (reqRaf) window.cancelAnimationFrame(reqRaf);
      if (reqRefreshTimer) window.clearInterval(reqRefreshTimer);
      requirementsWin.remove();
    };
    resetDraftBtn.addEventListener("click", () => {
      const proceed = window.confirm("Reset the current draft?");
      if (!proceed) return;
      resetDraft();
    });
    previewLayoutBtn.addEventListener("click", () => {
      void previewLayout();
    });
    loadFromGardenBtn.addEventListener("click", () => {
      void loadFromCurrentGarden();
    });
    saveLayoutBtn.addEventListener("click", () => {
      saveNewLayout();
    });
    applyLayoutBtn.addEventListener("click", async () => {
      const slotsAvailable = normalizeInventorySlots(Number(inventoryInput.value));
      inventoryInput.value = String(slotsAvailable);
      const ok = await GardenLayoutService.applyGarden(draft, {
        ignoreInventory: EditorService.isEnabled(),
        clearTargetTiles: true,
        inventorySlotsAvailable: Number.isFinite(slotsAvailable) ? Math.max(0, Math.floor(slotsAvailable)) : 0
      });
      if (!ok) return;
      if (!clearLeftToggle.checked && !clearRightToggle.checked) return;
      const slotsLimit = Number.isFinite(slotsAvailable) ? Math.max(0, Math.floor(slotsAvailable)) : 0;
      if (slotsLimit <= 0) {
        return;
      }
      const { tasks, blocked } = await GardenLayoutService.getClearSideTasks(draft, {
        clearLeft: clearLeftToggle.checked,
        clearRight: clearRightToggle.checked
      });
      if (!tasks.length) {
        if (blocked > 0) {
        }
        return;
      }
      if (tasks.length > slotsLimit) {
        const proceed = window.confirm(
          `Clearing ${tasks.length} items needs ${slotsLimit} free slots. Only ${slotsLimit} items will be picked up. Continue?`
        );
        if (!proceed) return;
      }
      const result = await GardenLayoutService.clearSideTasks(tasks, slotsLimit);
      const sideLabel = clearLeftToggle.checked && clearRightToggle.checked ? "left/right sides" : clearLeftToggle.checked ? "left side" : "right side";
      const skippedNote = result.skipped ? ` ${result.skipped} skipped (inventory limit).` : "";
      const blockedNote = blocked ? ` ${blocked} blocked (eggs/items).` : "";
    });
    invertLayoutBtn.addEventListener("click", async () => {
      draft = await GardenLayoutService.invertLayout(draft, currentKind);
      selectedTile = null;
      updateSelectionLabel();
      renderGrid();
      void refreshRequirementInfo();
    });
    typeSelect.addEventListener("change", () => {
      if (currentKind === "Dirt") {
        lastDirtType = typeSelect.value;
      }
      updatePickerVisibility();
      updatePickerPreview();
    });
    plantSelect.addEventListener("change", updatePickerPreview);
    decorSelect.addEventListener("change", updatePickerPreview);
    mutationSelect.addEventListener("change", updatePickerPreview);
    syncTypeOptions();
    scheduleRequirementRefresh();
    reqRefreshTimer = window.setInterval(() => {
      if (document.hidden) return;
      scheduleRequirementRefresh();
    }, 2e3);
    const renderPlantPickerGrid = () => {
      plantPickerGrid.replaceChildren();
      const list = GardenLayoutService.listPlantIds();
      for (const id of list) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.style.width = "36px";
        btn.style.height = "36px";
        btn.style.borderRadius = "8px";
        btn.style.border = "1px solid rgba(255,255,255,0.12)";
        btn.style.background = "rgba(48,58,72,0.9)";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";
        btn.style.cursor = "pointer";
        btn.title = getPlantDisplayName(id);
        const size = SEED_ICON_PLANTS.has(id) ? SEED_ICON_SIZE : 22;
        attachSpriteIcon(btn, getPlantIconCategories(id), id, size, "editor-plant-picker");
        btn.addEventListener("click", () => {
          plantSelect.value = id;
          updatePickerPreview();
          plantPickerGrid.style.display = "none";
        });
        plantPickerGrid.appendChild(btn);
      }
    };
    renderPlantPickerGrid();
    plantPickerBtn.addEventListener("click", () => {
      plantPickerGrid.style.display = plantPickerGrid.style.display === "none" ? "grid" : "none";
    });
    const renderDecorPickerGrid = () => {
      decorPickerGrid.replaceChildren();
      const list = GardenLayoutService.listDecorIds();
      for (const id of list) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.style.width = "36px";
        btn.style.height = "36px";
        btn.style.borderRadius = "8px";
        btn.style.border = "1px solid rgba(255,255,255,0.12)";
        btn.style.background = "rgba(48,58,72,0.9)";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";
        btn.style.cursor = "pointer";
        btn.title = getDecorDisplayName(id);
        attachSpriteIcon(btn, ["decor"], id, 22, "editor-decor-picker");
        btn.addEventListener("click", () => {
          decorSelect.value = id;
          updatePickerPreview();
          decorPickerGrid.style.display = "none";
        });
        decorPickerGrid.appendChild(btn);
      }
    };
    renderDecorPickerGrid();
    decorPickerBtn.addEventListener("click", () => {
      decorPickerGrid.style.display = decorPickerGrid.style.display === "none" ? "grid" : "none";
    });
    const renderMutationPickerGrid = () => {
      mutationPickerGrid.replaceChildren();
      const list = Object.keys(mutationCatalog || {});
      for (const id of list) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.style.width = "36px";
        btn.style.height = "36px";
        btn.style.borderRadius = "8px";
        btn.style.border = "1px solid rgba(255,255,255,0.12)";
        btn.style.background = "rgba(48,58,72,0.9)";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";
        btn.style.cursor = "pointer";
        btn.title = getMutationDisplayName(id);
        attachSpriteIcon(btn, ["mutation"], id, 22, "editor-mutation-picker");
        btn.addEventListener("click", () => {
          mutationSelect.value = id;
          updatePickerPreview();
          mutationPickerGrid.style.display = "none";
        });
        mutationPickerGrid.appendChild(btn);
      }
    };
    renderMutationPickerGrid();
    mutationPickerBtn.addEventListener("click", () => {
      mutationPickerGrid.style.display = mutationPickerGrid.style.display === "none" ? "grid" : "none";
    });
    clearLeftToggle.addEventListener("change", () => {
      void updateClearMarkers();
    });
    clearRightToggle.addEventListener("change", () => {
      void updateClearMarkers();
    });
    setActiveTab("Dirt");
    updateSelectionLabel();
    renderSavedLayouts();
    void refreshTiles();
  }
  function blockGameInput(el2) {
    const handler = (e) => {
      e.stopPropagation();
    };
    ["keydown", "keypress", "keyup", "mousedown"].forEach((type) => {
      el2.addEventListener(type, handler);
    });
  }

  // src/sprite/state.ts
  init_settings();
  function createInitialState() {
    return {
      started: false,
      open: false,
      loaded: false,
      version: null,
      base: null,
      ctors: null,
      app: null,
      renderer: null,
      cat: "__all__",
      q: "",
      f: "",
      mutOn: false,
      mutations: [],
      scroll: 0,
      items: [],
      filtered: [],
      cats: /* @__PURE__ */ new Map(),
      tex: /* @__PURE__ */ new Map(),
      lru: /* @__PURE__ */ new Map(),
      cost: 0,
      jobs: [],
      jobMap: /* @__PURE__ */ new Set(),
      srcCan: /* @__PURE__ */ new Map(),
      atlasBases: /* @__PURE__ */ new Set(),
      dbgCount: {},
      sig: "",
      changedAt: 0,
      needsLayout: false,
      overlay: null,
      bg: null,
      grid: null,
      dom: null,
      selCat: null,
      count: null,
      pool: [],
      active: /* @__PURE__ */ new Map(),
      anim: /* @__PURE__ */ new Set()
    };
  }
  function createSpriteContext() {
    return {
      cfg: { ...DEFAULT_CFG },
      state: createInitialState()
    };
  }

  // src/sprite/utils/async.ts
  var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function waitWithTimeout(p, ms, label) {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      const result = await Promise.race([p, sleep(50).then(() => null)]);
      if (result !== null) return result;
    }
    throw new Error(`${label} timeout`);
  }

  // src/sprite/pixi/hooks.ts
  function createPixiHooks() {
    let appResolver;
    let rdrResolver;
    const appReady = new Promise((resolve) => appResolver = resolve);
    const rendererReady = new Promise((resolve) => rdrResolver = resolve);
    let APP = null;
    let RDR = null;
    let PIXI_VER = null;
    const hook = (name, cb) => {
      const root = globalThis.unsafeWindow || globalThis;
      const prev = root[name];
      root[name] = function() {
        try {
          cb.apply(this, arguments);
        } finally {
          if (typeof prev === "function") {
            try {
              prev.apply(this, arguments);
            } catch {
            }
          }
        }
      };
    };
    hook("__PIXI_APP_INIT__", (a, v) => {
      if (!APP) {
        APP = a;
        PIXI_VER = v;
        appResolver(a);
      }
    });
    hook("__PIXI_RENDERER_INIT__", (r, v) => {
      if (!RDR) {
        RDR = r;
        PIXI_VER = v;
        rdrResolver(r);
      }
    });
    const tryResolveExisting = () => {
      const root = globalThis.unsafeWindow || globalThis;
      if (!APP) {
        const maybeApp = root.__PIXI_APP__ || root.PIXI_APP || root.app;
        if (maybeApp) {
          APP = maybeApp;
          appResolver(APP);
        }
      }
      if (!RDR) {
        const maybeRdr = root.__PIXI_RENDERER__ || root.PIXI_RENDERER__ || root.renderer || APP?.renderer;
        if (maybeRdr) {
          RDR = maybeRdr;
          rdrResolver(RDR);
        }
      }
    };
    tryResolveExisting();
    let fallbackPolls = 0;
    const fallbackInterval = setInterval(() => {
      if (APP && RDR) {
        clearInterval(fallbackInterval);
        return;
      }
      tryResolveExisting();
      fallbackPolls += 1;
      if (fallbackPolls >= 50) {
        clearInterval(fallbackInterval);
      }
    }, 100);
    return {
      get app() {
        return APP;
      },
      get renderer() {
        return RDR;
      },
      get pixiVersion() {
        return PIXI_VER;
      },
      appReady,
      rendererReady
    };
  }
  async function waitForPixi(handles, timeoutMs = 15e3) {
    const app = await waitWithTimeout(handles.appReady, timeoutMs, "PIXI app");
    const renderer = await waitWithTimeout(handles.rendererReady, timeoutMs, "PIXI renderer");
    return { app, renderer, version: handles.pixiVersion };
  }

  // src/sprite/utils/pixi.ts
  function findAny(root, pred, lim = 25e3) {
    const stack = [root];
    const seen = /* @__PURE__ */ new Set();
    let n = 0;
    while (stack.length && n++ < lim) {
      const node = stack.pop();
      if (!node || seen.has(node)) continue;
      seen.add(node);
      if (pred(node)) return node;
      const children = node.children;
      if (Array.isArray(children)) {
        for (let i = children.length - 1; i >= 0; i -= 1) stack.push(children[i]);
      }
    }
    return null;
  }
  function getCtors(app) {
    const P = globalThis.PIXI || globalThis.unsafeWindow?.PIXI;
    if (P?.Texture && P?.Sprite && P?.Container && P?.Rectangle) {
      return { Container: P.Container, Sprite: P.Sprite, Texture: P.Texture, Rectangle: P.Rectangle, Text: P.Text || null };
    }
    const stage = app?.stage;
    const anySpr = findAny(stage, (x) => x?.texture?.frame && x?.constructor && x?.texture?.constructor && x?.texture?.frame?.constructor);
    if (!anySpr) throw new Error("No Sprite found (ctors).");
    const anyTxt = findAny(stage, (x) => (typeof x?.text === "string" || typeof x?.text === "number") && x?.style);
    return {
      Container: stage.constructor,
      Sprite: anySpr.constructor,
      Texture: anySpr.texture.constructor,
      Rectangle: anySpr.texture.frame.constructor,
      Text: anyTxt?.constructor || null
    };
  }
  var baseTexOf = (tex) => tex?.baseTexture ?? tex?.source?.baseTexture ?? tex?.source ?? tex?._baseTexture ?? null;
  function rememberBaseTex(tex, atlasBases) {
    const base = baseTexOf(tex);
    if (base) atlasBases.add(base);
  }

  // src/sprite/utils/path.ts
  var splitKey = (key) => String(key || "").split("/").filter(Boolean);
  var joinPath = (base, path) => base.replace(/\/?$/, "/") + String(path || "").replace(/^\//, "");
  var dirOf = (path) => path.lastIndexOf("/") >= 0 ? path.slice(0, path.lastIndexOf("/") + 1) : "";
  var relPath = (base, path) => typeof path === "string" ? path.startsWith("/") ? path.slice(1) : dirOf(base) + path : path;
  function categoryOf(key, cfg) {
    const parts = splitKey(key);
    const start2 = parts[0] === "sprite" || parts[0] === "sprites" ? 1 : 0;
    const width = Math.max(1, cfg.catLevels | 0);
    return parts.slice(start2, start2 + width).join("/") || "misc";
  }
  function animParse(key) {
    const parts = splitKey(key);
    const last = parts[parts.length - 1];
    const match = last && last.match(/^(.*?)(?:[_-])(\d{1,6})(\.[a-z0-9]+)?$/i);
    if (!match) return null;
    const baseName = (match[1] || "") + (match[3] || "");
    const idx = Number(match[2]);
    if (!baseName || !Number.isFinite(idx)) return null;
    return { baseKey: parts.slice(0, -1).concat(baseName).join("/"), idx, frameKey: key };
  }

  // src/sprite/data/assetFetcher.ts
  function fetchFallback(url, type) {
    return fetch(url).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
      if (type === "blob") return { status: res.status, response: await res.blob(), responseText: "" };
      const text = await res.text();
      return {
        status: res.status,
        response: type === "json" ? JSON.parse(text) : text,
        responseText: text
      };
    }).catch((err) => {
      throw new Error(`Network (${url}): ${err instanceof Error ? err.message : String(err)}`);
    });
  }
  function gm(url, type = "text") {
    if (typeof GM_xmlhttpRequest === "function") {
      return new Promise(
        (resolve, reject) => GM_xmlhttpRequest({
          method: "GET",
          url,
          responseType: type,
          onload: (r) => r.status >= 200 && r.status < 300 ? resolve(r) : reject(new Error(`HTTP ${r.status} (${url})`)),
          onerror: () => reject(new Error(`Network (${url})`)),
          ontimeout: () => reject(new Error(`Timeout (${url})`))
        })
      );
    }
    return fetchFallback(url, type);
  }
  var getJSON = async (url) => JSON.parse((await gm(url, "text")).responseText);
  var getBlob = async (url) => (await gm(url, "blob")).response;
  function blobToImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("decode fail"));
      };
      img.src = url;
    });
  }
  function extractAtlasJsons(manifest) {
    const jsons = /* @__PURE__ */ new Set();
    for (const bundle of manifest.bundles || []) {
      for (const asset of bundle.assets || []) {
        for (const src of asset.src || []) {
          if (typeof src !== "string") continue;
          if (!src.endsWith(".json")) continue;
          if (src === "manifest.json") continue;
          if (src.startsWith("audio/")) continue;
          jsons.add(src);
        }
      }
    }
    return jsons;
  }
  async function loadAtlasJsons(base, manifest) {
    const jsons = extractAtlasJsons(manifest);
    const seen = /* @__PURE__ */ new Set();
    const data = {};
    const loadOne = async (path) => {
      if (seen.has(path)) return;
      seen.add(path);
      const json = await getJSON(joinPath(base, path));
      data[path] = json;
      if (json?.meta?.related_multi_packs) {
        for (const rel of json.meta.related_multi_packs) {
          await loadOne(relPath(path, rel));
        }
      }
    };
    for (const p of jsons) {
      await loadOne(p);
    }
    return data;
  }

  // src/sprite/pixi/atlasToTextures.ts
  var isAtlas = (j) => j && typeof j === "object" && j.frames && j.meta && typeof j.meta.image === "string";
  function mkRect(Rectangle, x, y, w, h) {
    return new Rectangle(x, y, w, h);
  }
  function mkSubTex(Texture, baseTex, frame, orig, trim, rotate, anchor) {
    let t;
    try {
      t = new Texture({ source: baseTex.source, frame, orig, trim: trim || void 0, rotate: rotate || 0 });
    } catch {
      t = new Texture(baseTex.baseTexture ?? baseTex, frame, orig, trim || void 0, rotate || 0);
    }
    try {
      if (t && !t.label) t.label = frame?.width && frame?.height ? `sub:${frame.width}x${frame.height}` : "subtex";
    } catch {
    }
    if (anchor) {
      const target = t;
      if (target.defaultAnchor?.set) {
        try {
          target.defaultAnchor.set(anchor.x, anchor.y);
        } catch {
        }
      }
      if (target.defaultAnchor && !target.defaultAnchor.set) {
        target.defaultAnchor.x = anchor.x;
        target.defaultAnchor.y = anchor.y;
      }
      if (!target.defaultAnchor) {
        target.defaultAnchor = { x: anchor.x, y: anchor.y };
      }
    }
    try {
      t?.updateUvs?.();
    } catch {
    }
    return t;
  }
  function buildAtlasTextures(data, baseTex, texMap, atlasBases, ctors, opts) {
    const { Texture, Rectangle } = ctors;
    try {
      if (baseTex && !baseTex.label) baseTex.label = data?.meta?.image || "atlasBase";
    } catch {
    }
    rememberBaseTex(baseTex, atlasBases);
    for (const [k, fd] of Object.entries(data.frames)) {
      if (opts?.allowKey && !opts.allowKey(k)) continue;
      const fr = fd.frame;
      const rot = fd.rotated ? 2 : 0;
      const w = fd.rotated ? fr.h : fr.w;
      const h = fd.rotated ? fr.w : fr.h;
      const frame = mkRect(Rectangle, fr.x, fr.y, w, h);
      const ss = fd.sourceSize || { w: fr.w, h: fr.h };
      const orig = mkRect(Rectangle, 0, 0, ss.w, ss.h);
      let trim = null;
      if (fd.trimmed && fd.spriteSourceSize) {
        const s = fd.spriteSourceSize;
        trim = mkRect(Rectangle, s.x, s.y, s.w, s.h);
      }
      const t = mkSubTex(Texture, baseTex, frame, orig, trim, rot, fd.anchor || null);
      try {
        t.label = k;
      } catch {
      }
      rememberBaseTex(t, atlasBases);
      texMap.set(k, t);
    }
  }

  // src/sprite/data/catalogIndexer.ts
  function buildItemsFromTextures(tex, cfg) {
    const keys = [...tex.keys()].sort((a, b) => a.localeCompare(b));
    const used = /* @__PURE__ */ new Set();
    const items = [];
    const cats = /* @__PURE__ */ new Map();
    const addToCat = (key, item) => {
      const cat = categoryOf(key, cfg);
      if (!cats.has(cat)) cats.set(cat, []);
      cats.get(cat).push(item);
    };
    for (const key of keys) {
      const texEntry = tex.get(key);
      if (!texEntry || used.has(key)) continue;
      const anim = animParse(key);
      if (!anim) {
        const item = { key, isAnim: false, first: texEntry };
        items.push(item);
        addToCat(key, item);
        continue;
      }
      const frames = [];
      for (const candidate of keys) {
        const maybe = animParse(candidate);
        if (!maybe || maybe.baseKey !== anim.baseKey) continue;
        const t = tex.get(candidate);
        if (!t) continue;
        frames.push({ idx: maybe.idx, tex: t });
        used.add(candidate);
      }
      frames.sort((a, b) => a.idx - b.idx);
      const ordered = frames.map((f) => f.tex);
      if (ordered.length === 1) {
        const item = { key: anim.baseKey, isAnim: false, first: ordered[0] };
        items.push(item);
        addToCat(anim.baseKey, item);
      } else if (ordered.length > 1) {
        const item = {
          key: anim.baseKey,
          isAnim: true,
          frames: ordered,
          first: ordered[0],
          count: ordered.length
        };
        items.push(item);
        addToCat(anim.baseKey, item);
      }
    }
    return { items, cats };
  }

  // src/sprite/api/expose.ts
  init_variantBuilder();
  function exposeApi(state2, hud) {
    const root = globalThis.unsafeWindow || globalThis;
    const api = {
      open() {
        hud.root?.style && (hud.root.style.display = "block");
        state2.open = true;
      },
      close() {
        hud.root?.style && (hud.root.style.display = "none");
        state2.open = false;
      },
      toggle() {
        state2.open ? api.close() : api.open();
      },
      setCategory(cat) {
        state2.cat = cat || "__all__";
      },
      setFilterText(text) {
        state2.q = String(text || "").trim();
      },
      setSpriteFilter(name) {
        state2.f = name;
        state2.mutOn = false;
      },
      setMutation(on, ...muts) {
        state2.mutOn = !!on;
        state2.f = "";
        state2.mutations = state2.mutOn ? muts.filter(Boolean).map((name) => name) : [];
      },
      filters() {
        return [];
      },
      categories() {
        return [...state2.cats.keys()].sort((a, b) => a.localeCompare(b));
      },
      cacheStats() {
        return { entries: state2.lru.size, cost: state2.cost };
      },
      clearCache() {
        clearVariantCache(state2);
      },
      curVariant: () => curVariant(state2)
    };
    root.MGSpriteCatalog = api;
    return api;
  }

  // src/sprite/index.ts
  init_variantBuilder();

  // src/utils/gameVersion.ts
  var gameVersion = null;
  function initGameVersion(doc) {
    if (gameVersion !== null) {
      return;
    }
    const d = doc ?? (typeof document !== "undefined" ? document : null);
    if (!d) {
      return;
    }
    const scripts = d.scripts;
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts.item(i);
      if (!script) continue;
      const src = script.src;
      if (!src) continue;
      const match = src.match(/\/(?:r\/\d+\/)?version\/([^/]+)/);
      if (match && match[1]) {
        gameVersion = match[1];
        return;
      }
    }
  }

  // src/sprite/index.ts
  var ctx = createSpriteContext();
  var hooks = createPixiHooks();
  var parseFrameCategory = (key) => {
    const parts = String(key || "").split("/").filter(Boolean);
    if (!parts.length) return null;
    const start2 = parts[0] === "sprite" || parts[0] === "sprites" ? 1 : 0;
    const category = parts[start2] ?? "";
    const id = parts.slice(start2 + 1).join("/") || parts[parts.length - 1] || "";
    if (!category || !id) return null;
    return { category, id };
  };
  var normalizeSpriteId2 = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  var ALLOWED_SPRITE_CATEGORIES = new Set([
    "plant",
    "tallplant",
    "crop",
    "decor",
    "pet",
    "pets",
    "pet-egg",
    "petegg",
    "mutation",
    "mutation-overlay"
  ].map(normalizeSpriteId2));
  var isAllowedSpriteKey = (key) => {
    const parsed = parseFrameCategory(key);
    if (!parsed) return false;
    const category = normalizeSpriteId2(parsed.category);
    if (!ALLOWED_SPRITE_CATEGORIES.has(category)) return false;
    return true;
  };
  var yieldToBrowser = () => {
    return new Promise((resolve) => {
      const win = typeof window !== "undefined" ? window : null;
      if (win?.requestIdleCallback) {
        win.requestIdleCallback(() => resolve(), { timeout: 32 });
      } else if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => resolve());
      } else {
        setTimeout(resolve, 0);
      }
    });
  };
  var delay2 = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function warmupSpritesFromAtlases(atlasJsons, blobs) {
    const FRAME_YIELD_EVERY = 6;
    const MAX_CHUNK_MS = 10;
    let framesSinceYield = 0;
    let chunkStart = typeof performance !== "undefined" ? performance.now() : Date.now();
    const resetChunk = () => {
      chunkStart = typeof performance !== "undefined" ? performance.now() : Date.now();
    };
    const yieldIfNeeded = async () => {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const elapsed = now - chunkStart;
      if (framesSinceYield >= FRAME_YIELD_EVERY || elapsed >= MAX_CHUNK_MS) {
        framesSinceYield = 0;
        await yieldToBrowser();
        resetChunk();
      }
    };
    for (const [path, data] of Object.entries(atlasJsons)) {
      if (!isAtlas(data)) continue;
      const frames = data.frames || {};
      if (!frames || !Object.keys(frames).length) continue;
      const imgPath = relPath(path, data.meta.image);
      const blob = blobs.get(imgPath);
      if (!blob) continue;
      let img;
      try {
        img = await blobToImage(blob);
      } catch (error) {
        console.warn("[GLC Sprites] warmup decode failed", { imgPath, error });
        continue;
      }
      for (const [frameKey, frameData] of Object.entries(frames)) {
        if (!isAllowedSpriteKey(frameKey)) continue;
        const parsed = parseFrameCategory(frameKey);
        if (!parsed) continue;
        try {
          const dataUrl = drawFrameToDataURL(img, frameKey, frameData);
          if (!dataUrl) continue;
          primeSpriteData(parsed.category, parsed.id, dataUrl);
        } catch (error) {
          console.warn("[GLC Sprites] warmup frame failed", { frameKey, error });
        }
        framesSinceYield += 1;
        await yieldIfNeeded();
      }
      framesSinceYield = 0;
      await yieldToBrowser();
      resetChunk();
    }
  }
  var prefetchPromise = null;
  var loggedSpriteCats = false;
  function detectGameVersion() {
    try {
      initGameVersion();
      if (gameVersion) return gameVersion;
    } catch {
    }
    const root = globalThis.unsafeWindow || globalThis;
    const gv = root.gameVersion || root.MG_gameVersion || root.__MG_GAME_VERSION__;
    if (gv) {
      if (typeof gv.getVersion === "function") return gv.getVersion();
      if (typeof gv.get === "function") return gv.get();
      if (typeof gv === "string") return gv;
    }
    const scriptUrls = Array.from(document.scripts || []).map((s) => s.src).filter(Boolean);
    const linkUrls = Array.from(document.querySelectorAll("link[href]") || []).map(
      (l) => l.href
    );
    const urls = [...scriptUrls, ...linkUrls];
    for (const u of urls) {
      const m = u.match(/\/version\/([^/]+)\//);
      if (m?.[1]) return m[1];
    }
    throw new Error("Version not found.");
  }
  async function resolveGameVersionWithRetry(timeoutMs = 6e3) {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;
    while (Date.now() < deadline) {
      try {
        const v = detectGameVersion();
        if (v) return v;
      } catch (err) {
        lastError = err;
      }
      await delay2(120);
    }
    throw lastError ?? new Error("Version not found.");
  }
  function drawFrameToDataURL(img, frameKey, data) {
    try {
      const fr = data.frame;
      const trimmed = data.trimmed && data.spriteSourceSize;
      const sourceSize = data.sourceSize || { w: fr.w, h: fr.h };
      const canvas = document.createElement("canvas");
      canvas.width = sourceSize.w;
      canvas.height = sourceSize.h;
      const ctx2 = canvas.getContext("2d");
      if (!ctx2) return null;
      ctx2.imageSmoothingEnabled = false;
      if (data.rotated) {
        ctx2.save();
        ctx2.translate(sourceSize.w / 2, sourceSize.h / 2);
        ctx2.rotate(-Math.PI / 2);
        ctx2.drawImage(
          img,
          fr.x,
          fr.y,
          fr.h,
          fr.w,
          -fr.h / 2,
          -fr.w / 2,
          fr.h,
          fr.w
        );
        ctx2.restore();
      } else {
        const dx = trimmed ? data.spriteSourceSize.x : 0;
        const dy = trimmed ? data.spriteSourceSize.y : 0;
        ctx2.drawImage(img, fr.x, fr.y, fr.w, fr.h, dx, dy, fr.w, fr.h);
      }
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  }
  async function prefetchAtlas(base) {
    try {
      const manifest = await getJSON(joinPath(base, "manifest.json"));
      const atlasJsons = await loadAtlasJsons(base, manifest);
      const blobs = /* @__PURE__ */ new Map();
      for (const [path, data] of Object.entries(atlasJsons)) {
        if (!isAtlas(data)) continue;
        const imgPath = relPath(path, data.meta.image);
        try {
          const blob = await getBlob(joinPath(base, imgPath));
          blobs.set(imgPath, blob);
        } catch {
        }
      }
      const warmupKeys = [];
      Object.entries(atlasJsons).forEach(([, data]) => {
        if (!isAtlas(data)) return;
        Object.keys(data.frames || {}).forEach((frameKey) => {
          if (isAllowedSpriteKey(frameKey)) warmupKeys.push(frameKey);
        });
      });
      if (warmupKeys.length) {
        try {
          primeWarmupKeys(warmupKeys);
        } catch {
        }
      }
      try {
        warmupSpriteCache();
      } catch {
      }
      if (warmupKeys.length) {
        warmupSpritesFromAtlases(atlasJsons, blobs).catch(() => {
        });
      }
      return { base, atlasJsons, blobs };
    } catch {
      return null;
    }
  }
  async function loadTextures(base, prefetched) {
    const usePrefetched = prefetched && prefetched.base === base ? prefetched : null;
    const atlasJsons = usePrefetched?.atlasJsons ?? await loadAtlasJsons(base, await getJSON(joinPath(base, "manifest.json")));
    const ctors = ctx.state.ctors;
    if (!ctors?.Texture || !ctors?.Rectangle) throw new Error("PIXI constructors missing");
    for (const [path, data] of Object.entries(atlasJsons)) {
      if (!isAtlas(data)) continue;
      const imgPath = relPath(path, data.meta.image);
      const blob = usePrefetched?.blobs.get(imgPath) ?? usePrefetched?.blobs.get(relPath(path, data.meta.image)) ?? await getBlob(joinPath(base, imgPath));
      const img = await blobToImage(blob);
      const baseTex = ctors.Texture.from(img);
      buildAtlasTextures(
        data,
        baseTex,
        ctx.state.tex,
        ctx.state.atlasBases,
        {
          Texture: ctors.Texture,
          Rectangle: ctors.Rectangle
        },
        { allowKey: isAllowedSpriteKey }
      );
    }
    const { items, cats } = buildItemsFromTextures(ctx.state.tex, ctx.cfg);
    ctx.state.items = items;
    ctx.state.filtered = items.slice();
    ctx.state.cats = cats;
    ctx.state.loaded = true;
    if (!loggedSpriteCats) {
      loggedSpriteCats = true;
      try {
        const catList = Array.from(cats.keys()).sort((a, b) => a.localeCompare(b));
        console.log("[GLC Sprites] categories", { count: catList.length, cats: catList });
      } catch {
      }
    }
  }
  function ensureDocumentReady() {
    if (document.readyState !== "loading") return Promise.resolve();
    return new Promise((resolve) => {
      const onReady = () => {
        document.removeEventListener("DOMContentLoaded", onReady);
        resolve();
      };
      document.addEventListener("DOMContentLoaded", onReady);
    });
  }
  async function resolvePixiFast() {
    const root = globalThis.unsafeWindow || globalThis;
    const check = () => {
      const app = root.__PIXI_APP__ || root.PIXI_APP || root.app || null;
      const renderer = root.__PIXI_RENDERER__ || root.PIXI_RENDERER__ || root.renderer || app?.renderer || null;
      if (app && renderer) {
        return { app, renderer, version: root.__PIXI_VERSION__ || null };
      }
      return null;
    };
    const hit = check();
    if (hit) return hit;
    const maxMs = 5e3;
    const start2 = performance.now();
    while (performance.now() - start2 < maxMs) {
      await new Promise((r) => setTimeout(r, 50));
      const retry = check();
      if (retry) return retry;
    }
    const waited = await waitForPixi(hooks);
    return { app: waited.app, renderer: waited.renderer, version: waited.version };
  }
  async function start() {
    if (ctx.state.started) return;
    ctx.state.started = true;
    let version;
    const retryDeadline = typeof performance !== "undefined" ? performance.now() + 8e3 : Date.now() + 8e3;
    for (; ; ) {
      try {
        version = await resolveGameVersionWithRetry();
        console.info("[GLC Sprites] game version resolved", version);
        break;
      } catch (err) {
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (now >= retryDeadline) {
          console.error("[GLC Sprites] failed to resolve game version", err);
          throw err;
        }
        console.warn("[GLC Sprites] retrying game version detection...");
        await delay2(200);
      }
    }
    const base = `${ctx.cfg.origin.replace(/\/$/, "")}/version/${version}/assets/`;
    if (!prefetchPromise) {
      prefetchPromise = prefetchAtlas(base);
    }
    const { app, renderer: _renderer, version: pixiVersion } = await resolvePixiFast();
    await ensureDocumentReady();
    ctx.state.ctors = getCtors(app);
    const renderer = _renderer || app?.renderer || app?.render || null;
    ctx.state.app = app;
    ctx.state.renderer = renderer;
    ctx.state.version = pixiVersion || version || version === "" ? pixiVersion ?? version : detectGameVersion();
    ctx.state.base = base;
    ctx.state.sig = curVariant(ctx.state).sig;
    const prefetched = await (prefetchPromise ?? Promise.resolve(null));
    await loadTextures(ctx.state.base, prefetched);
    const hud = {
      open() {
        ctx.state.open = true;
      },
      close() {
        ctx.state.open = false;
      },
      toggle() {
        ctx.state.open ? this.close() : this.open();
      },
      layout() {
      },
      root: void 0
    };
    ctx.state.open = true;
    app.ticker?.add?.(() => {
      processJobs(ctx.state, ctx.cfg);
    });
    exposeApi(ctx.state, hud);
    const g = globalThis;
    const uw = g.unsafeWindow || g;
    const spriteApi = await Promise.resolve().then(() => (init_spriteApi(), spriteApi_exports));
    const ensureOverlayHost = () => {
      const id = "mg-sprite-overlay";
      let host = document.getElementById(id);
      if (!host) {
        host = document.createElement("div");
        host.id = id;
        host.style.cssText = "position:fixed;top:8px;left:8px;z-index:2147480000;display:flex;flex-wrap:wrap;gap:8px;pointer-events:auto;background:transparent;align-items:flex-start;";
        document.body.appendChild(host);
      }
      return host;
    };
    const getSpriteDim = (tex, key) => {
      const sources = [
        tex?.orig,
        tex?._orig,
        tex?.frame,
        tex?._frame,
        tex
      ];
      for (const src of sources) {
        const value = src?.[key];
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
          return value;
        }
      }
      return null;
    };
    const padCanvasToSpriteBounds = (source, tex) => {
      const rawW = source.width || 1;
      const rawH = source.height || 1;
      const baseW = Math.max(rawW, Math.round(getSpriteDim(tex, "width") ?? rawW) || rawW);
      const baseH = Math.max(rawH, Math.round(getSpriteDim(tex, "height") ?? rawH) || rawH);
      const trim = tex?.trim ?? tex?._trim ?? null;
      let offsetX = trim && typeof trim.x === "number" ? Math.round(trim.x) : Math.round((baseW - rawW) / 2);
      let offsetY = trim && typeof trim.y === "number" ? Math.round(trim.y) : Math.round((baseH - rawH) / 2);
      offsetX = Math.max(0, Math.min(baseW - rawW, offsetX));
      offsetY = Math.max(0, Math.min(baseH - rawH, offsetY));
      if (baseW === rawW && baseH === rawH && offsetX === 0 && offsetY === 0) {
        return source;
      }
      const canvas = document.createElement("canvas");
      canvas.width = baseW;
      canvas.height = baseH;
      const ctx2 = canvas.getContext("2d");
      if (!ctx2) return source;
      ctx2.imageSmoothingEnabled = false;
      ctx2.clearRect(0, 0, baseW, baseH);
      ctx2.drawImage(source, offsetX, offsetY);
      return canvas;
    };
    const renderTextureToCanvas = (tex) => {
      try {
        const spr = new ctx.state.ctors.Sprite(tex);
        const extracted = ctx.state.renderer.extract.canvas(spr, { resolution: 1 });
        spr.destroy?.({ children: true, texture: false, baseTexture: false });
        return padCanvasToSpriteBounds(extracted, tex);
      } catch {
        return null;
      }
    };
    const service = {
      ready: Promise.resolve(),
      // overwritten below
      state: ctx.state,
      cfg: ctx.cfg,
      list(category = "any") {
        return spriteApi.listItemsByCategory(ctx.state, category);
      },
      getBaseSprite(params) {
        return spriteApi.getBaseSprite(params, ctx.state);
      },
      getSpriteWithMutations(params) {
        return spriteApi.getSpriteWithMutations(params, ctx.state, ctx.cfg);
      },
      buildVariant(mutations) {
        return spriteApi.buildVariant(mutations);
      },
      renderToCanvas(arg) {
        const tex = arg?.isTexture || arg?.frame ? arg : service.getSpriteWithMutations(arg);
        if (!tex) return null;
        return renderTextureToCanvas(tex);
      },
      async renderToDataURL(arg, type = "image/png", quality) {
        const c = service.renderToCanvas(arg);
        if (!c) return null;
        return c.toDataURL(type, quality);
      },
      // Render and append to a fixed overlay; each sprite gets its own wrapper.
      renderOnCanvas(arg, opts = {}) {
        const c = service.renderToCanvas(arg);
        if (!c) return null;
        c.style.background = "transparent";
        c.style.display = "block";
        let mutW = c.width || c.clientWidth;
        let mutH = c.height || c.clientHeight;
        let baseW = mutW;
        let baseH = mutH;
        if (arg && !arg.isTexture && !arg.frame) {
          const baseTex = service.getBaseSprite(arg);
          if (baseTex) {
            baseW = baseTex?.orig?.width ?? baseTex?._orig?.width ?? baseTex?.frame?.width ?? baseTex?._frame?.width ?? baseTex?.width ?? baseW;
            baseH = baseTex?.orig?.height ?? baseTex?._orig?.height ?? baseTex?.frame?.height ?? baseTex?._frame?.height ?? baseTex?.height ?? baseH;
          }
        }
        const scaleToBase = Math.min(baseW / mutW, baseH / mutH, 1);
        let logicalW = mutW * scaleToBase;
        let logicalH = mutH * scaleToBase;
        const { maxWidth, maxHeight, allowScaleUp } = opts;
        if (maxWidth || maxHeight) {
          const scaleW = maxWidth ? maxWidth / logicalW : 1;
          const scaleH = maxHeight ? maxHeight / logicalH : 1;
          let scale = Math.min(scaleW || 1, scaleH || 1);
          if (!allowScaleUp) scale = Math.min(scale, 1);
          logicalW = Math.floor(logicalW * scale);
          logicalH = Math.floor(logicalH * scale);
        }
        if (logicalW) c.style.width = `${logicalW}px`;
        if (logicalH) c.style.height = `${logicalH}px`;
        const wrap = document.createElement("div");
        wrap.style.cssText = "display:inline-flex;align-items:flex-start;justify-content:flex-start;padding:0;margin:0;background:transparent;border:none;flex:0 0 auto;";
        wrap.appendChild(c);
        ensureOverlayHost().appendChild(wrap);
        return { wrap, canvas: c };
      },
      clearOverlay() {
        const host = document.getElementById("mg-sprite-overlay");
        if (host) host.remove();
      },
      renderAnimToCanvases(params) {
        const item = ctx.state.items.find((it) => it.key === `sprite/${params.category}/${params.id}` || it.key === params.id);
        if (!item) return [];
        if (item.isAnim && item.frames?.length) {
          const texes = params?.mutations?.length ? [service.getSpriteWithMutations(params)] : item.frames;
          return texes.map((t2) => renderTextureToCanvas(t2)).filter(Boolean);
        }
        const t = service.getSpriteWithMutations(params);
        return t ? [renderTextureToCanvas(t)] : [];
      }
    };
    service.ready = Promise.resolve();
    uw.__MG_SPRITE_STATE__ = ctx.state;
    uw.__MG_SPRITE_CFG__ = ctx.cfg;
    uw.__MG_SPRITE_API__ = spriteApi;
    uw.__MG_SPRITE_SERVICE__ = service;
    uw.getSpriteWithMutations = service.getSpriteWithMutations;
    uw.getBaseSprite = service.getBaseSprite;
    uw.buildSpriteVariant = service.buildVariant;
    uw.listSpritesByCategory = service.list;
    uw.renderSpriteToCanvas = service.renderToCanvas;
    uw.renderSpriteToDataURL = service.renderToDataURL;
    uw.MG_SPRITE_HELPERS = service;
    console.log("[GLC Sprites] ready", {
      version: ctx.state.version,
      pixi: version,
      textures: ctx.state.tex.size,
      items: ctx.state.items.length,
      cats: ctx.state.cats.size
    });
  }
  var __mg_ready = start();
  __mg_ready.catch((err) => console.error("[GLC Sprites] failed", err));

  // src/main.ts
  (async function() {
    "use strict";
    installPageWebSocketHook();
    try {
      tos.init();
    } catch {
    }
    EditorService.init();
    mountHUD({
      onRegister(register) {
        register("editor", "\u{1F9F1} Garden Layout Creator", renderEditorMenu);
      }
    });
  })();
})();
