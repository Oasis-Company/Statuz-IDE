const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  console.log('Test app ready');
  const win = new BrowserWindow({
    width: 800, height: 600,
    show: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  win.loadURL('data:text/html,<h1>Statuz IDE Test</h1>');
  console.log('Window created');
});