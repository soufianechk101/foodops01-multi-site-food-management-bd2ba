/* ============================================================
   FoodOps — Processus principal Electron (variante desktop)
   Architecture sécurisée :
     main (Node) → preload (contextBridge) → renderer (React)
   Le renderer n'a AUCUN accès direct à Node.js.
   Activation offline: DEMO 5 jours / LIFE à vie
   ============================================================ */
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { validateCode } = require("./activation.cjs");

const isDev = process.env.FOODOPS_DEV === "1";

/** Emplacement de la base locale (équivalent du fichier SQLite desktop). */
const dataDir = () => {
  const dir = path.join(app.getPath("userData"), "foodops-data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/* ---------- Activation ---------- */
const ACTIVATION_FILE = () => path.join(app.getPath("userData"), "activation.json");

function readActivation() {
  try {
    const p = ACTIVATION_FILE();
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf-8");
    const data = JSON.parse(raw);
    if (!data.code || !data.type || !data.activatedAt) return null;
    return data;
  } catch { return null; }
}

function writeActivation(info) {
  fs.writeFileSync(ACTIVATION_FILE(), JSON.stringify(info, null, 2), "utf-8");
}

function getActivationStatus() {
  const a = readActivation();
  if (!a) return { activated: false, type: null, expiresAt: null, daysLeft: null, code: null };
  if (a.type === "life") return { activated: true, type: "life", expiresAt: null, daysLeft: null, code: a.code, activatedAt: a.activatedAt };
  // demo
  const expiresAt = a.expiresAt;
  const now = Date.now();
  const expMs = Date.parse(expiresAt);
  const daysLeft = Math.ceil((expMs - now) / 86400000);
  if (now > expMs) return { activated: false, type: "demo", expiresAt, daysLeft: 0, code: a.code, activatedAt: a.activatedAt, expired: true };
  return { activated: true, type: "demo", expiresAt, daysLeft: Math.max(0, daysLeft), code: a.code, activatedAt: a.activatedAt };
}

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
    mainWindow.loadURL("http://localhost:5173");
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
  if (!payload || typeof payload.name !== "string" || typeof payload.content !== "string")
    throw new Error("Payload invalide.");
  // Sanitize filename: pas de chemin, pas de traversal, extension json obligatoire
  const raw = payload.name.trim();
  const safe = path.basename(raw);
  if (safe !== raw || safe.includes("..") || safe.includes("/") || safe.includes("\\"))
    throw new Error("Nom de fichier invalide.");
  if (!safe.toLowerCase().endsWith(".json")) throw new Error("Extension invalide : .json attendu.");
  if (safe.length > 128) throw new Error("Nom de fichier trop long.");
  const file = path.join(dataDir(), safe);
  // Vérification que le fichier reste dans dataDir (anti traversal)
  const resolved = path.resolve(file);
  const base = path.resolve(dataDir());
  if (!resolved.startsWith(base + path.sep) && resolved !== base)
    throw new Error("Chemin de fichier non autorisé.");
  fs.writeFileSync(resolved, payload.content, "utf-8");
  return resolved;
});

/* ---------- IPC Activation ---------- */
ipcMain.handle("foodops:activation-status", () => getActivationStatus());

ipcMain.handle("foodops:activate", (_evt, code) => {
  const v = validateCode(code);
  if (!v.valid) return { ok: false, error: v.reason };
  const now = new Date();
  const activatedAt = now.toISOString();
  let expiresAt = null;
  if (v.type === "demo") {
    const exp = new Date(now.getTime() + 5 * 86400000);
    expiresAt = exp.toISOString();
  }
  const info = { code: code.trim().toUpperCase(), type: v.type, activatedAt, expiresAt };
  writeActivation(info);
  return { ok: true, status: getActivationStatus() };
});

ipcMain.handle("foodops:deactivate", () => {
  try { fs.unlinkSync(ACTIVATION_FILE()); } catch {}
  return { ok: true };
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
