import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import type { AiSettings, Blueprint, BpNode, GraphState } from '@shared/types'
import * as storage from './storage'
import { exportJson, exportPdf } from './exporter'
import { llmAttacks } from './aiAdapter'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1100,
    minHeight: 700,
    title: 'Blueprint Studio',
    backgroundColor: '#101418',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  mainWindow.setMenuBarVisibility(false)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function registerIpc(): void {
  ipcMain.handle('bp:list', () => storage.listBlueprints())
  ipcMain.handle('bp:load', (_e, id: string) => storage.loadBlueprint(id))
  ipcMain.handle('bp:save', (_e, bp: Blueprint) => storage.saveBlueprint(bp))
  ipcMain.handle('bp:delete', (_e, id: string) => storage.deleteBlueprint(id))
  ipcMain.handle('settings:load', () => storage.loadSettings())
  ipcMain.handle('settings:save', (_e, s: AiSettings) => storage.saveSettings(s))
  ipcMain.handle('export:json', (_e, bp: Blueprint, snapshotId?: string) => {
    const snap = snapshotId ? bp.snapshots.find((s) => s.id === snapshotId) : undefined
    return exportJson(mainWindow!, bp, snap)
  })
  ipcMain.handle('export:pdf', (_e, bp: Blueprint, snapshotId?: string) => {
    const snap = snapshotId ? bp.snapshots.find((s) => s.id === snapshotId) : undefined
    return exportPdf(mainWindow!, bp, snap)
  })
  ipcMain.handle('ai:attacks', async (_e, graph: GraphState, claim: BpNode) => {
    const settings = await storage.loadSettings()
    return llmAttacks(settings, graph, claim)
  })
}
