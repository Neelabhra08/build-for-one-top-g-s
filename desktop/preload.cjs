const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ishara', {
  isDesktop: true,
  typeText: (text) => ipcRenderer.invoke('ishara:type-text', text),
  hotkey: () => ipcRenderer.invoke('ishara:hotkey'),
  openMain: () => ipcRenderer.send('ishara:open-main'),
  quit: () => ipcRenderer.send('ishara:quit'),
  onToggle: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('ishara:toggle', handler);
    return () => ipcRenderer.removeListener('ishara:toggle', handler);
  },
});
