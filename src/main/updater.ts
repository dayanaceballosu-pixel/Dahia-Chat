import { app, dialog, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'

// Auto-actualización (electron-updater + GitHub Releases).
// Cuando subes una versión nueva a GitHub, la app instalada la detecta al abrir,
// la baja en segundo plano (solo lo que cambió) y ofrece reiniciar para aplicarla.
// Los datos de ella (%APPDATA%\dahia-chat) y el modelo NO se tocan.
const { autoUpdater } = electronUpdater

export function initUpdater(getWindow: () => BrowserWindow | null): void {
  // Solo en la app instalada (en desarrollo no hay nada que actualizar).
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', async (info) => {
    const win = getWindow()
    const opts = {
      type: 'info' as const,
      buttons: ['Reiniciar ahora', 'Más tarde'],
      defaultId: 0,
      cancelId: 1,
      title: 'Actualización lista',
      message: `Dahia Chat ${info.version} está lista para instalarse.`,
      detail: 'Se aplicará al reiniciar. Tus clientes, chats y el modelo se conservan.'
    }
    const res = win
      ? await dialog.showMessageBox(win, opts)
      : await dialog.showMessageBox(opts)
    if (res.response === 0) autoUpdater.quitAndInstall()
  })

  autoUpdater.on('error', (err) => {
    console.warn('Updater:', err?.message || err)
  })

  // Revisar al arrancar y cada 6 horas (por si la deja abierta mucho tiempo).
  autoUpdater.checkForUpdates().catch(() => {})
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 60 * 60 * 1000)
}
