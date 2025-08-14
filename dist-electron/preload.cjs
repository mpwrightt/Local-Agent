// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("agent", {
  startTask: (input) => import_electron.ipcRenderer.invoke("agent/startTask", input),
  simpleChat: (input) => import_electron.ipcRenderer.invoke("agent/simpleChat", input),
  getHistory: (input) => import_electron.ipcRenderer.invoke("agent/getHistory", input),
  confirmDangerous: (input) => import_electron.ipcRenderer.invoke("agent/confirmDangerous", input),
  cancelRun: (input) => import_electron.ipcRenderer.invoke("agent/cancelRun", input),
  setDefaultModel: (input) => import_electron.ipcRenderer.invoke("agent/setDefaultModel", input),
  getVisualizerVariant: () => import_electron.ipcRenderer.invoke("agent/getVisualizerVariant"),
  setVisualizerVariant: (input) => import_electron.ipcRenderer.invoke("agent/setVisualizerVariant", input),
  openPath: (input) => import_electron.ipcRenderer.invoke("agent/openPath", input),
  revealInFolder: (input) => import_electron.ipcRenderer.invoke("agent/revealInFolder", input),
  saveUploadedImage: (input) => import_electron.ipcRenderer.invoke("agent/saveUploadedImage", input),
  readFileText: (input) => import_electron.ipcRenderer.invoke("agent/readFileText", input),
  onEvent: (handler) => {
    const listener = (_, payload) => handler(payload);
    import_electron.ipcRenderer.on("agent/event", listener);
    return () => import_electron.ipcRenderer.removeListener("agent/event", listener);
  },
  voiceTTS: (input) => import_electron.ipcRenderer.invoke("agent/voiceTTS", input),
  listVoices: () => import_electron.ipcRenderer.invoke("agent/elevenVoices"),
  speechToText: (input) => import_electron.ipcRenderer.invoke("agent/speechToText", input),
  listModels: () => import_electron.ipcRenderer.invoke("agent/listModels"),
  getDefaultModel: () => import_electron.ipcRenderer.invoke("agent/getDefaultModel")
});
