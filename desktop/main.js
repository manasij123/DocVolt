// DocVault Desktop — Electron main process
// Loads the deployed web app inside a native window (Windows / macOS / Linux).
// Update WEB_URL below to your live deployment URL.

const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");

// ⚠️ IMPORTANT: replace this with your deployed app URL (after going live)
const WEB_URL =
  process.env.DOCVAULT_WEB_URL ||
  "https://REPLACE_WITH_YOUR_DEPLOYED_APP_URL";

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    title: "DocVault",
    backgroundColor: "#0D47A1",
    icon: path.join(__dirname, process.platform === "win32" ? "icon.ico" : "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadURL(WEB_URL);

  // Open external links (e.g. WhatsApp share) in the default browser, not inside the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Hide the default app menu (cleaner look like WhatsApp Desktop)
Menu.setApplicationMenu(null);

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
