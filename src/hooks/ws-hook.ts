import { NativeWS, NativeWorker, sockets, setQWS, Workers } from "../core/state";
import { parseWSData } from "../core/parse";
import { pageWindow, readSharedGlobal } from "../utils/page-context";

let installed = false;

export function installPageWebSocketHook() {
  if (installed) return;
  installed = true;

  try {
    const OriginalWS = NativeWS;
    if (!OriginalWS) return;
    const WSProxy: typeof WebSocket = function (this: WebSocket, ...args: any[]) {
      const ws = new (OriginalWS as any)(...args) as WebSocket;
      sockets.push(ws);
      try { setQWS(ws, "hook"); } catch {}
      try {
        ws.addEventListener("open", () => {
          setTimeout(() => {
            if (ws.readyState === NativeWS.OPEN) setQWS(ws, "open-fallback");
          }, 800);
        });
        ws.addEventListener("message", async (ev: MessageEvent) => {
          const parsed = await parseWSData(ev.data);
          if (!parsed) return;
          if (
            !hasSharedQuinoaWS() &&
            (parsed.type === "Welcome" || parsed.type === "Config" || parsed.fullState || parsed.config)
          ) {
            setQWS(ws, "message:" + (parsed.type || "state"));
          }
        });
      } catch {}
      return ws;
    } as any;
    WSProxy.prototype = OriginalWS.prototype;
    try { (WSProxy as any).OPEN = (OriginalWS as any).OPEN; } catch {}
    try { (WSProxy as any).CLOSED = (OriginalWS as any).CLOSED; } catch {}
    try { (WSProxy as any).CLOSING = (OriginalWS as any).CLOSING; } catch {}
    try { (WSProxy as any).CONNECTING = (OriginalWS as any).CONNECTING; } catch {}
    (pageWindow as any).WebSocket = WSProxy;
    if (pageWindow !== window) {
      try { (window as any).WebSocket = WSProxy; } catch {}
    }
  } catch {
    // ignore
  }

  try {
    const OriginalWorker = NativeWorker;
    const WorkerProxy: typeof Worker = function (this: Worker, ...args: any[]) {
      const worker = new (OriginalWorker as any)(...args) as Worker;
      try { Workers.add?.(worker); } catch {}
      return worker;
    } as any;
    WorkerProxy.prototype = OriginalWorker.prototype;
    (pageWindow as any).Worker = WorkerProxy;
  } catch {
    // ignore
  }

  function hasSharedQuinoaWS() {
    const existing = readSharedGlobal<WebSocket | null>("quinoaWS");
    return !!existing;
  }

  const scheduleRoomConnectionFallback = () => {
    const FALLBACK_DELAY_MS = 5000;
    const win = pageWindow || window;
    win.setTimeout(() => {
      try {
        if (hasSharedQuinoaWS()) return;
        const conn =
          (win as any).MagicCircle_RoomConnection ||
          readSharedGlobal<any>("MagicCircle_RoomConnection");
        const ws: WebSocket | undefined =
          conn?.currentWebSocket || conn?.ws || conn?.socket || conn?.currentWS;
        if (ws && ws.readyState === NativeWS.OPEN) {
          setQWS(ws, "room-connection-fallback");
        }
      } catch {
        // ignore
      }
    }, FALLBACK_DELAY_MS);
  };

  scheduleRoomConnectionFallback();
}
