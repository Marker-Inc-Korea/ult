import "./styles.css";
import { native } from "./native";
import { renderSettingsWindow } from "./nativeWindows";
import { renderPaletteOverlay } from "./paletteOverlay";
import { applyAppearance } from "./theme";

const app = getAppRoot();

function getAppRoot() {
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) {
    throw new Error("App root not found");
  }
  return root;
}

async function boot() {
  let windowRole = "main";
  try {
    windowRole = await native.windowLabel();
  } catch {
    windowRole = "main";
  }
  document.documentElement.dataset.windowRole = windowRole;
  await native.loadAppSettings()
    .then((settings) => applyAppearance(settings.appearance))
    .catch(() => applyAppearance("dark"));
  void native.listenAppearanceChanged((appearance) => {
    applyAppearance(appearance);
  });

  if (windowRole === "palette") {
    await renderPaletteOverlay(app);
    return;
  }

  if (windowRole === "settings") {
    await renderSettingsWindow(app);
    return;
  }

  app.replaceChildren();
}

void boot();
