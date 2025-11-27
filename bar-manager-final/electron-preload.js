// Preload script for Electron
const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  sendNotification: (orderData) => {
    ipcRenderer.send('new-order-notification', orderData)
  },
  platform: process.platform,
  isElectron: true
})
