const { app, BrowserWindow, Notification, ipcMain, Menu, Tray } = require('electron')
const path = require('path')

let mainWindow = null
let tray = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'electron-preload.js')
    },
    title: 'EasyMO Bar Manager',
    backgroundColor: '#f3f4f6',
    show: false
  })

  // Load the app
  mainWindow.loadURL('http://localhost:3000')

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Handle window close
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
    return false
  })

  // Desktop notifications
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow navigation within the app
    if (!url.startsWith('http://localhost:3000')) {
      event.preventDefault()
    }
  })
}

function createTray() {
  // Create tray icon (you can add an icon file later)
  tray = new Tray(path.join(__dirname, 'public/favicon.ico'))
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow.show()
      }
    },
    {
      label: 'Hide App',
      click: () => {
        mainWindow.hide()
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('EasyMO Bar Manager')
  tray.setContextMenu(contextMenu)
  
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
  })
}

// App lifecycle
app.whenReady().then(() => {
  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow.show()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  app.isQuitting = true
})

// Handle new order notifications from renderer
ipcMain.on('new-order-notification', (event, orderData) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: 'New Order!',
      body: `Order #${orderData.orderCode} - Table ${orderData.table}`,
      urgency: 'critical',
      timeoutType: 'never'
    })
    
    notification.show()
    
    notification.on('click', () => {
      mainWindow.show()
      mainWindow.focus()
    })
  }
})
