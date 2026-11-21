const path = require('node:path');
const { execFile } = require('node:child_process');
const { app, BrowserWindow, clipboard, globalShortcut, ipcMain, screen, session } = require('electron');

const APP_URL = process.env.ISHARA_URL || 'http://localhost:5173';
const HOTKEY = 'CommandOrControl+Shift+Space';
const MAX_TEXT = 300;
const CLIPBOARD_RESTORE_MS = 800;

let widget = null;
let mainWindow = null;
let hotkeyLabel = '';

function isAppUrl(url) {
  try {
    return new URL(url).origin === new URL(APP_URL).origin;
  } catch {
    return false;
  }
}

function lockDown(contents) {
  contents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

function createWidget() {
  const { workArea } = screen.getPrimaryDisplay();
  const width = 340;
  const height = 520;
  widget = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - 16,
    y: workArea.y + workArea.height - height - 16,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    focusable: false,
    title: 'Ishara',
    backgroundColor: '#0E1222',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  widget.setAlwaysOnTop(true, 'floating');
  lockDown(widget.webContents);
  widget.webContents.on('console-message', (event, legacyLevel, legacyMessage) => {
    const level = event?.level ?? legacyLevel;
    const message = event?.message ?? legacyMessage;
    if (level === 'warning' || level === 'error' || level >= 2) console.log(`[widget ${level}] ${message}`);
  });
  widget.loadURL(`${APP_URL}/widget.html`);
  widget.on('closed', () => { widget = null; });
}

function openMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  mainWindow = new BrowserWindow({
    width: 480,
    height: 900,
    title: 'Ishara: teach signs',
    backgroundColor: '#F4F6FB',
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  lockDown(mainWindow.webContents);
  mainWindow.loadURL(APP_URL);
  mainWindow.on('closed', () => { mainWindow = null; });
}

function sendPasteKeystroke() {
  if (process.platform !== 'win32') {
    return Promise.reject(new Error('Typing into other apps is only built for Windows'));
  }
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', "(New-Object -ComObject WScript.Shell).SendKeys('^v')"],
      { windowsHide: true, timeout: 5000 },
      (error) => (error ? reject(error) : resolve()),
    );
  });
}

ipcMain.handle('ishara:type-text', async (event, text) => {
  if (!isAppUrl(event.senderFrame?.url ?? '')) return { ok: false, error: 'origin' };
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT) return { ok: false, error: 'invalid' };
  const previous = clipboard.readText();
  clipboard.writeText(text);
  try {
    await sendPasteKeystroke();
    setTimeout(() => clipboard.writeText(previous), CLIPBOARD_RESTORE_MS);
    return { ok: true };
  } catch (error) {
    console.error('Could not paste into the focused app:', error.message);
    clipboard.writeText(previous);
    return { ok: false, error: 'paste' };
  }
});

ipcMain.handle('ishara:hotkey', () => hotkeyLabel);
ipcMain.on('ishara:open-main', openMainWindow);
ipcMain.on('ishara:quit', () => app.quit());

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(permission === 'media' && isAppUrl(details.requestingUrl || contents.getURL()));
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission, origin) => (
    permission === 'media' && isAppUrl(origin)
  ));

  const registered = globalShortcut.register(HOTKEY, () => {
    widget?.webContents.send('ishara:toggle');
  });
  hotkeyLabel = registered ? 'Ctrl + Shift + Space' : '';
  if (!registered) console.error(`Hotkey ${HOTKEY} is taken by another app. Use the Listen button instead.`);

  createWidget();
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
