// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("agent", {
  startTask: (input) => import_electron.ipcRenderer.invoke("agent/startTask", input),
  simpleChat: (input) => import_electron.ipcRenderer.invoke("agent/simpleChat", input),
  getHistory: (input) => import_electron.ipcRenderer.invoke("agent/getHistory", input),
  confirmDangerous: (input) => import_electron.ipcRenderer.invoke("agent/confirmDangerous", input),
  cancelRun: (input) => import_electron.ipcRenderer.invoke("agent/cancelRun", input),
  setDefaultModel: (input) => import_electron.ipcRenderer.invoke("agent/setDefaultModel", input),
  openPath: (input) => import_electron.ipcRenderer.invoke("agent/openPath", input),
  revealInFolder: (input) => import_electron.ipcRenderer.invoke("agent/revealInFolder", input),
  saveUploadedImage: (input) => import_electron.ipcRenderer.invoke("agent/saveUploadedImage", input),
  onEvent: (handler) => {
    const listener = (_, payload) => handler(payload);
    import_electron.ipcRenderer.on("agent/event", listener);
    return () => import_electron.ipcRenderer.removeListener("agent/event", listener);
  }
});
