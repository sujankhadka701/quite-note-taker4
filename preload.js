const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  confirmNewNote: () => ipcRenderer.invoke('dialog:newNoteConfirm'),
  saveAs: (content) => ipcRenderer.invoke('dialog:saveAs', content),
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  smartSave: (payload) => ipcRenderer.invoke('file:smartSave', payload),

  getNotes: () => ipcRenderer.invoke('notes:get'),
  saveNotes: (notes) => ipcRenderer.invoke('notes:save', notes),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  onMenuNewNote: (callback) => ipcRenderer.on('menu-new-note', callback),
  onMenuOpenFile: (callback) => ipcRenderer.on('menu-open-file', callback),
  onMenuSave: (callback) => ipcRenderer.on('menu-save', callback),
  onMenuSaveAs: (callback) => ipcRenderer.on('menu-save-as', callback)
});