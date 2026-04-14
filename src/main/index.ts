import { app, BrowserWindow, ipcMain, screen, dialog } from 'electron'
import { join } from 'path'

// uiohook은 네이티브 모듈이라 try/catch로 감싸둠
let uIOhook: any
try {
  const uiohookModule = require('uiohook-napi')
  uIOhook = uiohookModule.uIOhook
} catch (e: any) {
  console.warn('[main] uiohook-napi 로드 실패 - 키보드 후킹 비활성화:', e.message)
}

let overlayWindow: BrowserWindow | null
let lastHand: 'left' | 'right' = 'right' // 다음 누를 손 (toggle)

function createOverlayWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  overlayWindow = new BrowserWindow({
    width: 300,
    height: 350,
    x: width - 320,
    y: height - 400,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: join(__dirname, '../preload/index.js'),
    },
  })

  // electron-vite dev 모드: Vite dev server URL 사용
  if (process.env['ELECTRON_RENDERER_URL']) {
    overlayWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    overlayWindow.loadFile(join(__dirname, '../renderer/index.html'))  // out/renderer/index.html
  }

  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (process.argv.includes('--dev') || process.env['ELECTRON_RENDERER_URL']) {
    overlayWindow.webContents.openDevTools({ mode: 'detach' })
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

function setupHooks(): void {
  if (!uIOhook) return

  function toggleHand(): void {
    if (!overlayWindow) return
    lastHand = lastHand === 'left' ? 'right' : 'left'
    overlayWindow.webContents.send('hand-state', lastHand)
  }

  uIOhook.on('keydown', (_e: { keycode: number }) => {
    toggleHand()
  })

  uIOhook.on('mousedown', () => {
    toggleHand()
  })

  process.on('uncaughtException', (err) => {
    if (err.message && err.message.includes('assistive devices')) {
      console.warn('[main] ⚠️  키보드 후킹 실패: macOS 접근성 권한이 필요합니다.')
      console.warn('[main] 시스템 설정 → 개인 정보 보호 및 보안 → 접근성 → 터미널 허용')
    } else {
      console.error('[main] 예상치 못한 오류:', err)
    }
  })

  process.on('unhandledRejection', (reason: any) => {
    if (reason?.message?.includes('assistive devices')) {
      console.warn('[main] ⚠️  uiohook 시작 실패 (접근성 권한 필요). 앱은 계속 실행됩니다.')
    } else {
      console.error('[main] Unhandled rejection:', reason)
    }
  })

  try {
    uIOhook.start()
    console.log('[main] uiohook 시작됨 - 글로벌 키 후킹 활성')
  } catch (e: any) {
    console.warn('[main] uiohook 시작 실패:', e.message)
  }
}

// IPC: 렌더러에서 창 드래그 요청
ipcMain.on('drag-window', (_event, { deltaX, deltaY }: { deltaX: number; deltaY: number }) => {
  if (!overlayWindow) return
  const [x, y] = overlayWindow.getPosition()
  overlayWindow.setPosition(x + deltaX, y + deltaY)
})

// IPC: 창 크기 조절
ipcMain.on('resize-window', (_event, { width, height }: { width: number; height: number }) => {
  if (!overlayWindow) return
  overlayWindow.setSize(Math.max(100, width), Math.max(100, height))
})

// IPC: 이미지 파일 선택 다이얼로그
ipcMain.handle('select-image', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

app.whenReady().then(() => {
  createOverlayWindow()
  setupHooks()
})

app.on('window-all-closed', () => {
  if (uIOhook) uIOhook.stop()
  app.quit()
})

app.on('before-quit', () => {
  if (uIOhook) uIOhook.stop()
})