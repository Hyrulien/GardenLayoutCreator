import { i18n } from "../utils/i18n";
import { readAriesPath, readGlcPath, writeAriesPath, writeGlcPath } from "../utils/localStorage";

export type PanelRender = (root: HTMLElement) => void;
export interface HUDOptions {
  onRegister?: (register: (id: string, title: string, render: PanelRender) => void) => void;
}

export function mountHUD(opts?: HUDOptions) {
  const MARGIN = 8;
  const Z_BASE = 2_000_000;
  const HUD_WIN_PATH = (id: string) => `glc.hud.windows.${id}`;

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
    const stored = readGlcPath<boolean>(HIDE_MENU_PATH);
    if (typeof stored === "boolean") return stored;
    const legacyAries = readAriesPath<boolean>(HIDE_MENU_PATH);
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
      /* ignore storage access errors */
    }
    return false;
  };
  const getLaunchItemEl = () =>
    launcher.querySelector<HTMLElement>('.glc-launch-item[data-id="editor"]');
  const setLauncherHidden = (hidden: boolean) => {
    const item = getLaunchItemEl();
    if (item) item.style.display = hidden ? "none" : "";
    const anyVisible = Array.from(launcher.querySelectorAll<HTMLElement>(".glc-launch-item")).some(
      (el) => el.style.display !== "none"
    );
    launcher.style.display = anyVisible ? "" : "none";
  };
  const applyHideMenuSetting = () => {
    const hidden = readHideMenuSetting();
    setLauncherHidden(hidden);
  };
  applyHideMenuSetting();

  const windows = new Map<string, { el: HTMLElement; body: HTMLElement; title: string }>();
  const launchButtons = new Map<string, HTMLButtonElement>();

  const translate = (s: string) => {
    try { return i18n.translateString?.(s) ?? s; } catch { return s; }
  };

  function setLaunchState(id: string, open: boolean) {
    const btn = launchButtons.get(id);
    if (!btn) return;
    btn.textContent = translate(open ? "Close" : "Open");
    btn.dataset.open = open ? "1" : "0";
    if (open) btn.classList.add("active"); else btn.classList.remove("active");
  }

  function restoreWinPos(id: string, el: HTMLElement) {
    const pos = readAriesPath<{ x?: number; y?: number }>(HUD_WIN_PATH(id));
    if (!pos) return;
    if (Number.isFinite(pos.x)) el.style.left = `${pos.x}px`;
    if (Number.isFinite(pos.y)) el.style.top = `${pos.y}px`;
  }

  function saveWinPos(id: string, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    writeAriesPath(HUD_WIN_PATH(id), { x: rect.left, y: rect.top });
  }

  function attachDrag(el: HTMLElement, onMove: (x: number, y: number) => void, onUp?: () => void) {
    let startX = 0;
    let startY = 0;
    let baseX = 0;
    let baseY = 0;
    let dragging = false;
    const onDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest?.(".w-btn")) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      baseX = rect.left;
      baseY = rect.top;
      document.addEventListener("mousemove", onMoveEv);
      document.addEventListener("mouseup", onUpEv, { once: true });
    };
    const onMoveEv = (e: MouseEvent) => {
      if (!dragging) return;
      onMove(baseX + (e.clientX - startX), baseY + (e.clientY - startY));
    };
    const onUpEv = () => {
      dragging = false;
      document.removeEventListener("mousemove", onMoveEv);
      onUp?.();
    };
    el.addEventListener("mousedown", onDown);
  }

  function openWindow(id: string, title: string, render: PanelRender) {
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
        <button class="w-btn" data-act="min">–</button>
        <button class="w-btn" data-act="close">✕</button>
      </div>
      <div class="w-body"></div>
    `;
    const head = win.querySelector(".w-head") as HTMLElement;
    const bodyEl = win.querySelector(".w-body") as HTMLElement;
    const btnMin = win.querySelector('[data-act="min"]') as HTMLButtonElement;
    const btnClose = win.querySelector('[data-act="close"]') as HTMLButtonElement;

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

  function register(id: string, title: string, render: PanelRender) {
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

  try { opts?.onRegister?.(register); } catch {}
  i18n.onChange?.(() => {
    launchButtons.forEach((btn) => {
      const open = btn.dataset.open === "1";
      btn.textContent = translate(open ? "Close" : "Open");
    });
  });
}
