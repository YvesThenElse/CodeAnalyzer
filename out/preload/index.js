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
  openFolder: (filePath) => electron.ipcRenderer.invoke("shell:openFolder", filePath),
  // LLM operations
  llm: {
    // Get LLM configuration for a project
    getConfig: (projectPath) => electron.ipcRenderer.invoke("llm:getConfig", projectPath),
    // Save LLM configuration for a project
    saveConfig: (projectPath, config) => electron.ipcRenderer.invoke("llm:saveConfig", projectPath, config),
    // Test LLM connection
    testConnection: (config) => electron.ipcRenderer.invoke("llm:testConnection", config),
    // Generate descriptions for files
    generateDescriptions: (projectPath, forceRegenerate) => electron.ipcRenderer.invoke("llm:generateDescriptions", projectPath, forceRegenerate),
    // Get cached descriptions
    getDescriptions: (projectPath) => electron.ipcRenderer.invoke("llm:getDescriptions", projectPath),
    // Invalidate description cache
    invalidateCache: (projectPath) => electron.ipcRenderer.invoke("llm:invalidateCache", projectPath),
    // Listen to LLM progress (with cleanup function)
    onProgress: (callback) => {
      const handler = (_event, progress) => {
        callback(progress);
      };
      electron.ipcRenderer.on("llm:progress", handler);
      return () => {
        electron.ipcRenderer.removeListener("llm:progress", handler);
      };
    },
    // Listen to LLM completion (with cleanup function)
    onComplete: (callback) => {
      const handler = (_event, descriptions) => {
        callback(descriptions);
      };
      electron.ipcRenderer.on("llm:complete", handler);
      return () => {
        electron.ipcRenderer.removeListener("llm:complete", handler);
      };
    },
    // Listen to LLM errors (with cleanup function)
    onError: (callback) => {
      const handler = (_event, error) => {
        callback(error);
      };
      electron.ipcRenderer.on("llm:error", handler);
      return () => {
        electron.ipcRenderer.removeListener("llm:error", handler);
      };
    }
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
