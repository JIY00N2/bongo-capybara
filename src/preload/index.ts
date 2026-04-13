import { contextBridge, ipcRenderer } from 'electron'

type HandState = 'idle' | 'left' | 'right' | 'both'

contextBridge.exposeInMainWorld('electronAPI', {
  // 메인 프로세스 → 렌더러: 손 상태 수신
  onHandState: (callback: (state: HandState) => void) => {
    ipcRenderer.on('hand-state', (_event, state: HandState) => callback(state))
  },
  // 렌더러 → 메인 프로세스: 드래그
  dragWindow: (deltaX: number, deltaY: number) => {
    ipcRenderer.send('drag-window', { deltaX, deltaY })
  },
  // 렌더러 → 메인 프로세스: 크기 조절
  resizeWindow: (width: number, height: number) => {
    ipcRenderer.send('resize-window', { width, height })
  },
  // 이미지 파일 선택 다이얼로그
  selectImage: (): Promise<string | null> => {
    return ipcRenderer.invoke('select-image')
  },
})