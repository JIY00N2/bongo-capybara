import { useState, useEffect, useRef } from 'react'
import type { HandState } from '../types'

const HAND_HOLD_MS = 120

export function useHandState(): HandState {
  const [handState, setHandState] = useState<HandState>('idle')
  // setTimeout 콜백에서 최신 state를 읽기 위해 ref 사용
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
    if (!window.electronAPI) return

    window.electronAPI.onHandState((state: HandState) => {
      if (state !== 'idle') triggerBounce(state)
      else applyHandState('idle')
    })
  }, [])

  return handState
}