/* ============================================================
   FoodOps — Processus principal Electron (variante desktop)
   Architecture sécurisée :
     main (Node) → preload (contextBridge) → renderer (React)
   Le renderer n'a AUCUN accès direct à Node.js.
   ============================================================ */
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const isDev = process.env.FOODOPS_DEV === "1";

/** Emplacement de la base locale (équivalent du fichier SQLite desktop). */
const dataDir = () => {
  const dir = path.join(app.getPath("userData"), "foodops-data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    title: "FoodOps — F&B Control Suite",
    backgroundColor: "#edf0ea",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, // OBLIGATOIRE
      nodeIntegration: false, // OBLIGATOIRE
      sandbox: true,
      spellcheck: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  // Liens externes → navigateur système, jamais dans la fenêtre applicative
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => (mainWindow = null));
}

/* ---------- IPC sécurisé (surface volontairement minimale) ---------- */
ipcMain.handle("foodops:environment", () => ({
  platform: process.platform,
  version: app.getVersion(),
  electron: process.versions.electron,
  dataDir: dataDir(),
}));

ipcMain.handle("foodops:choose-backup-file", async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "Restaurer une sauvegarde FoodOps",
    filters: [{ name: "Sauvegarde FoodOps", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (res.canceled || !res.filePaths.length) return null;
  return fs.readFileSync(res.filePaths[0], "utf-8");
});

ipcMain.handle("foodops:write-backup", async (_evt, payload) => {
  const file = path.join(dataDir(), payload.name);
  fs.writeFileSync(file, payload.content, "utf-8");
  return file;
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
