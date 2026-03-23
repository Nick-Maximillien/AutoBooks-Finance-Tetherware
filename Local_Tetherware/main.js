// main.js
const { app, BrowserWindow } = require('electron');
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');

const dev = !app.isPackaged;
const hostname = 'localhost';
const port = 3000;

// Initialize the Next.js Engine
const nextApp = next({ dev, hostname, port });
const handle = nextApp.getRequestHandler();

let mainWindow;

async function createWindow() {
  await nextApp.prepare();

  // Boot the internal offline server to handle /api/sign routes
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, () => {
    console.log(`> TetherWare Secure Server running on http://${hostname}:${port}`);
  });

  // Create the native desktop window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    title: "TetherWare Enclave",
    icon: path.join(__dirname, 'public', 'favicon.ico'), 
    autoHideMenuBar: false, 
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Funnel the user directly to the hardware home screen
  mainWindow.loadURL(`http://${hostname}:${port}/`);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});