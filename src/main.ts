// src/main.ts

import { installPageWebSocketHook } from "./hooks/ws-hook";
import { mountHUD } from "./ui/hud";
import { renderEditorMenu } from "./ui/menus/editor";
import { tos } from "./utils/tileObjectSystemApi";
import { EditorService } from "./services/editor";
import "./sprite";

(async function () {
  "use strict";

  installPageWebSocketHook();
  try { tos.init(); } catch {}
  EditorService.init();

  mountHUD({
    onRegister(register) {
      register("editor", "🧱 Garden Layout Creator", renderEditorMenu);
    },
  });
})();
