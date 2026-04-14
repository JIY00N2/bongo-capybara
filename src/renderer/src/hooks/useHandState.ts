import { useState, useEffect, useRef } from 'react'
import type { HandState } from '../types'

const HAND_HOLD_MS = 120
const OBS_WS_URL = 'ws://localhost:3876'

export function useHandState(): HandState {
  const [handState, setHandState] = useState<HandState>('idle')
  const stateRef = useRef<HandState>('idle')
  const timers = useRef<{ left: ReturnType<typeof setTimeout> | null; right: ReturnType<typeof setTimeout> | null }>({
    left: null,
    right: null,
  })

  function applyHandState(state: HandState): void {
    stateRef.current = state
    setHandState(state)
  }

  function triggerBounce(state: HandState): void {
    applyHandState(state)

    if (state === 'left' || state === 'both') {
      if (timers.current.left) clearTimeout(timers.current.left)
      timers.current.left = setTimeout(() => {
        if (stateRef.current === 'left') applyHandState('idle')
        else if (stateRef.current === 'both') applyHandState('right')
      }, HAND_HOLD_MS)
    }

    if (state === 'right' || state === 'both') {
      if (timers.current.right) clearTimeout(timers.current.right)
      timers.current.right = setTimeout(() => {
        if (stateRef.current === 'right') applyHandState('idle')
        else if (stateRef.current === 'both') applyHandState('left')
      }, HAND_HOLD_MS)
    }
  }

  useEffect(() => {
    // Electron IPC 방식 (일반 앱 창)
    if (window.electronAPI) {
      window.electronAPI.onHandState((state: HandState) => {
        if (state !== 'idle') triggerBounce(state)
        else applyHandState('idle')
      })
      return
    }

    // WebSocket 방식 (OBS 브라우저 소스)
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      ws = new WebSocket(OBS_WS_URL)
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'hand-state') {
            triggerBounce(data.state as HandState)
          }
        } catch {}
      }
      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 2000)
      }
    }

    connect()

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [])

  return handState
}
