/* ============================================================
   FoodOps — Preload (pont sécurisé main ↔ renderer)
   Expose une API minimale et contrôlée via contextBridge.
   Aucune API Node.js n'est exposée directement au renderer.
   ============================================================ */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("foodopsDesktop", {
  /** Informations d'environnement (plateforme, version, dossier de données). */
  environment: () => ipcRenderer.invoke("foodops:environment"),
  /** Ouvre le sélecteur de fichier natif et renvoie le contenu de la sauvegarde choisie. */
  chooseBackupFile: () => ipcRenderer.invoke("foodops:choose-backup-file"),
  /** Écrit une sauvegarde dans le dossier de données applicatives. */
  writeBackup: (name, content) => ipcRenderer.invoke("foodops:write-backup", { name, content }),
});
