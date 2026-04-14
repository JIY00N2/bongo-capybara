import { app, BrowserWindow, ipcMain, screen, dialog } from 'electron'
import { createServer } from 'http'
import { readFileSync } from 'fs'
import { join, extname } from 'path'
import { WebSocketServer, WebSocket } from 'ws'

// uiohook은 네이티브 모듈이라 try/catch로 감싸둠
let uIOhook: any
try {
  const uiohookModule = require('uiohook-napi')
  uIOhook = uiohookModule.uIOhook
} catch (e: any) {
  console.warn('[main] uiohook-napi 로드 실패 - 키보드 후킹 비활성화:', e.message)
}

let overlayWindow: BrowserWindow | null
let lastHand: 'left' | 'right' = 'right'
let wss: WebSocketServer | null = null

const OBS_PORT = 3876

function broadcastHandState(state: string): void {
  if (!wss) return
  const msg = JSON.stringify({ type: 'hand-state', state })
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg)
  })
}

function startOBSServer(): void {
  const isDevMode = !!process.env['ELECTRON_RENDERER_URL']

  if (isDevMode) {
    // 개발 모드: WebSocket만 열기 (HTML은 Vite dev server에서 서빙)
    wss = new WebSocketServer({ port: OBS_PORT })
    console.log(`[main] OBS 브라우저 소스 (dev): http://localhost:5173`)
    console.log(`[main] OBS WebSocket: ws://localhost:${OBS_PORT}`)
  } else {
    // 프로덕션: HTTP + WebSocket 서버
    const rendererDir = join(__dirname, '../renderer')
    const MIME: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    }

    const server = createServer((req, res) => {
      const urlPath = req.url?.split('?')[0] || '/'

      // 로컬 이미지 파일 프록시 (OBS Browser Source용)
      if (urlPath.startsWith('/localfile/')) {
        const filePath = decodeURIComponent(urlPath.slice('/localfile/'.length))
        try {
          const data = readFileSync(filePath)
          const ext = extname(filePath).toLowerCase()
          res.writeHead(200, { 'Content-Type': MIME[ext] || 'image/png', 'Access-Control-Allow-Origin': '*' })
          res.end(data)
        } catch {
          res.writeHead(404); res.end()
        }
        return
      }

      // 정적 파일 서빙
      const target = urlPath === '/' ? '/index.html' : urlPath
      const fullPath = join(rendererDir, target)
      try {
        const data = readFileSync(fullPath)
        const ext = extname(fullPath).toLowerCase()
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain', 'Access-Control-Allow-Origin': '*' })
        res.end(data)
      } catch {
        // SPA 폴백
        try {
          const data = readFileSync(join(rendererDir, 'index.html'))
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(data)
        } catch {
          res.writeHead(404); res.end('Not found')
        }
      }
    })

    wss = new WebSocketServer({ server })
    server.on('error', (e) => console.error('[main] OBS 서버 오류:', e))
    server.listen(OBS_PORT, '127.0.0.1', () => {
      console.log(`[main] OBS 브라우저 소스: http://localhost:${OBS_PORT}`)
    })
  }
}

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

  if (process.env['ELECTRON_RENDERER_URL']) {
    overlayWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    overlayWindow.loadFile(join(__dirname, '../renderer/index.html'))
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
    lastHand = lastHand === 'left' ? 'right' : 'left'
    if (overlayWindow) overlayWindow.webContents.send('hand-state', lastHand)
    broadcastHandState(lastHand)
  }

  uIOhook.on('keydown', (_e: { keycode: number }) => { toggleHand() })
  uIOhook.on('mousedown', () => { toggleHand() })

  process.on('uncaughtException', (err) => {
    if (err.message && err.message.includes('assistive devices')) {
      console.warn('[main] ⚠️  키보드 후킹 실패: macOS 접근성 권한이 필요합니다.')
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

// IPC: 창 드래그
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

// IPC: 이미지 파일 선택
ipcMain.handle('select-image', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

app.whenReady().then(() => {
  startOBSServer()
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
