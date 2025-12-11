"use strict";
const electron = require("electron");
const electronAPI = {
  // Select directory dialog
  selectDirectory: () => electron.ipcRenderer.invoke("dialog:selectDirectory"),
  // Get last directory
  getLastDirectory: () => electron.ipcRenderer.invoke("store:getLastDirectory"),
  // Start project analysis
  analyzeProject: (dirPath) => electron.ipcRenderer.invoke("analysis:start", dirPath),
  // Cancel ongoing analysis
  cancelAnalysis: () => electron.ipcRenderer.invoke("analysis:cancel"),
  // Listen to analysis progress (with cleanup function)
  onAnalysisProgress: (callback) => {
    const handler = (_event, progress) => {
      callback(progress);
    };
    electron.ipcRenderer.on("analysis:progress", handler);
    return () => {
      electron.ipcRenderer.removeListener("analysis:progress", handler);
    };
  },
  // Listen to analysis errors (with cleanup function)
  onAnalysisError: (callback) => {
    const handler = (_event, error) => {
      callback(error);
    };
    electron.ipcRenderer.on("analysis:error", handler);
    return () => {
      electron.ipcRenderer.removeListener("analysis:error", handler);
    };
  },
  // Save file dialog
  saveFile: (options) => electron.ipcRenderer.invoke("dialog:saveFile", options),
  // Open file with default application
  openFile: (filePath) => electron.ipcRenderer.invoke("shell:openFile", filePath),
  // Show file in folder (opens explorer/finder)
  openFolder: (filePath) => electron.ipcRenderer.invoke("shell:openFolder", filePath)
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
