export type HandState = 'idle' | 'left' | 'right' | 'both'

declare global {
  interface Window {
    electronAPI?: {
      onHandState: (callback: (state: HandState) => void) => void
      dragWindow: (deltaX: number, deltaY: number) => void
      resizeWindow: (width: number, height: number) => void
      selectImage: () => Promise<string | null>
    }
  }
}