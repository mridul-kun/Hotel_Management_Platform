const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');

const PORT = 3500; // any free port; passed to server.js via process.env.PORT
const PROJECT_DIR = 'C:\\Users\\MRIDUL BANSAL\\Presonal\\Hotel Management Platform - Antique Pages';
const fsCheck = require('fs');
process.env.DATA_DIR = fsCheck.existsSync(PROJECT_DIR)
    ? path.join(PROJECT_DIR, 'data')
    : path.join(app.getPath('userData'), 'data');
    
process.env.PORT = String(PORT);

let mainWindow;

function waitForServer(retries = 50) {
    return new Promise((resolve, reject) => {
        const attempt = (n) => {
            http.get(`http://127.0.0.1:${PORT}`, (res) => {
                res.resume();
                resolve();
            }).on('error', () => {
                if (n <= 0) return reject(new Error('Server did not start'));
                setTimeout(() => attempt(n - 1), 200);
            });
        };
        attempt(retries);
    });
}

async function createWindow() {
    require('./server.js'); // starts Express inside Electron
    await waitForServer();

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'build', 'icon.ico'),
        autoHideMenuBar: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false }
    });

    mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
}

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
    app.whenReady().then(createWindow);
}

app.on('window-all-closed', () => app.quit());