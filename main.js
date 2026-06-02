const { app, BrowserWindow, ipcMain, dialog, Menu, Tray } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

app.disableHardwareAcceleration();

let mainWindow;
let tray = null;

const notesFilePath = path.join(app.getPath('userData'), 'notes.json');
const settingsFilePath = path.join(app.getPath('userData'), 'settings.json');

function readNotes() {
  try {
    if (!fs.existsSync(notesFilePath)) {
      return [];
    }
    const data = fs.readFileSync(notesFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function writeNotes(notes) {
  try {
    fs.writeFileSync(notesFilePath, JSON.stringify(notes, null, 2), 'utf8');
  } catch (error) {
    console.error(error);
  }
}

function readSettings() {
  try {
    if (!fs.existsSync(settingsFilePath)) {
      return { fontSize: 16, darkMode: false };
    }
    const data = fs.readFileSync(settingsFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { fontSize: 16, darkMode: false };
  }
}

function writeSettings(settings) {
  try {
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    console.error(error);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    title: "Quick Note Taker",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Note',
          accelerator: 'CmdOrCtrl+N',
          click: () => { mainWindow.webContents.send('menu-new-note'); }
        },
        {
          label: 'Open File...',
          accelerator: 'CmdOrCtrl+O',
          click: () => { mainWindow.webContents.send('menu-open-file'); }
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => { mainWindow.webContents.send('menu-save'); }
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => { mainWindow.webContents.send('menu-save-as'); }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  const trayIconPath = path.join(__dirname, 'tray-icon.png');
  const finalIcon = fs.existsSync(trayIconPath) ? trayIconPath : path.join(__dirname, 'index.html');
  
  tray = new Tray(finalIcon);
  const trayContextMenu = Menu.buildFromTemplate([
    { label: 'Show Window', click: () => mainWindow.show() },
    {
      label: 'Quit Application',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setToolTip('Quick Note Taker');
  tray.setContextMenu(trayContextMenu);

  tray.on('double-click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('dialog:newNoteConfirm', async () => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Discard Changes', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    title: 'Unsaved Changes Detected',
    message: 'You have unsaved text changes. Do you want to discard them and create a new note?'
  });
  return result.response === 0;
});

ipcMain.handle('dialog:saveAs', async (event, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Note As...',
    defaultPath: path.join(app.getPath('documents'), 'untitled.txt'),
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  });

  if (!canceled && filePath) {
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
  }
  return null;
});

ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Open External Text File',
    properties: ['openFile'],
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  });

  if (!canceled && filePaths.length > 0) {
    const content = fs.readFileSync(filePaths[0], 'utf8');
    return { filePath: filePaths[0], content };
  }
  return null;
});

ipcMain.handle('file:smartSave', async (event, { filePath, content }) => {
  const targetPath = filePath || path.join(app.getPath('documents'), 'quicknote.txt');
  try {
    fs.writeFileSync(targetPath, content, 'utf8');
    return targetPath;
  } catch (error) {
    return null;
  }
});

ipcMain.handle('notes:get', async () => readNotes());
ipcMain.handle('notes:save', async (event, notesArray) => {
  writeNotes(notesArray);
  return true;
});

ipcMain.handle('settings:get', async () => readSettings());
ipcMain.handle('settings:save', async (event, updatedSettings) => {
  writeSettings(updatedSettings);
  return true;
});