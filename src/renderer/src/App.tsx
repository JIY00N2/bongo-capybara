import { useState, useEffect, useRef } from 'react'
import { useHandState } from './hooks/useHandState'
import { useLipSync } from './hooks/useLipSync'
import { useImagePaths } from './hooks/useImagePaths'
import { ImageSettings } from './components/ImageSettings'
import './App.css'

export default function App() {
  const handState = useHandState()
  const { mouthOpen, micStatus, startLipSync, stopLipSync } = useLipSync()
  const { paths, pickImage, resetSlot, resetAll } = useImagePaths()
  const [micEnabled, setMicEnabled] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // 드래그
  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return
      const deltaX = e.screenX - dragStart.current.x
      const deltaY = e.screenY - dragStart.current.y
      dragStart.current = { x: e.screenX, y: e.screenY }
      window.electronAPI?.dragWindow(deltaX, deltaY)
    }
    function onMouseUp() {
      dragging.current = false
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  function handleDragStart(e: React.MouseEvent) {
    dragging.current = true
    dragStart.current = { x: e.screenX, y: e.screenY }
    e.preventDefault()
  }

  function toggleMic() {
    if (micEnabled) {
      stopLipSync()
      setMicEnabled(false)
    } else {
      startLipSync()
      setMicEnabled(true)
    }
  }

  return (
    <>
      {/* 드래그 핸들 */}
      <div id="drag-handle" onMouseDown={handleDragStart} />

      {/* 마이크 상태 표시 */}
      <div
        id="mic-indicator"
        className={micStatus === 'active' ? 'active' : micStatus === 'error' ? 'error' : ''}
        title="마이크 상태"
      />

      {/* 캐릭터 영역 */}
      <div id="character">
        <img key={paths.body}        className="layer visible"                                    src={paths.body}        alt="" onError={e => (e.currentTarget.style.display = 'none')} />
        <img key={paths.handIdle}   className={`layer${handState === 'idle'  ? ' visible' : ''}`} src={paths.handIdle}    alt="" onError={e => (e.currentTarget.style.display = 'none')} />
        <img key={paths.handLeft}   className={`layer${handState === 'left'  ? ' visible' : ''}`} src={paths.handLeft}    alt="" onError={e => (e.currentTarget.style.display = 'none')} />
        <img key={paths.handRight}  className={`layer${handState === 'right' ? ' visible' : ''}`} src={paths.handRight}   alt="" onError={e => (e.currentTarget.style.display = 'none')} />
        <img key={paths.mouthClosed} className={`layer${!mouthOpen ? ' visible' : ''}`}           src={paths.mouthClosed} alt="" onError={e => (e.currentTarget.style.display = 'none')} />
        <img key={paths.mouthOpen}  className={`layer${mouthOpen  ? ' visible' : ''}`}            src={paths.mouthOpen}   alt="" onError={e => (e.currentTarget.style.display = 'none')} />
      </div>

      {/* 설정 패널 */}
      {showSettings && (
        <ImageSettings
          paths={paths}
          onPick={pickImage}
          onReset={resetSlot}
          onResetAll={resetAll}
        />
      )}

      {/* 버튼들 */}
      <div id="settings-panel">
        <button
          title="마이크 켜기/끄기"
          style={{ opacity: micEnabled ? 1 : 0.4 }}
          onClick={toggleMic}
        >🎤</button>
<button
          title="이미지 설정"
          style={{ opacity: showSettings ? 1 : 0.4 }}
          onClick={() => setShowSettings(prev => !prev)}
        >⚙</button>
      </div>
    </>
  )
}
