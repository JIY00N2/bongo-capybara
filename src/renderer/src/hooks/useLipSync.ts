import { useState, useRef } from 'react'

const MIC_THRESHOLD = 0.015  // RMS가 이 값보다 높으면 입 열림
const MOUTH_CLOSE_DELAY = 80  // 소리 끝난 후 입 닫힘 딜레이 (ms)

type MicStatus = 'idle' | 'active' | 'error'

interface UseLipSyncReturn {
  mouthOpen: boolean
  micStatus: MicStatus
  startLipSync: () => Promise<void>
  stopLipSync: () => void
}

export function useLipSync(): UseLipSyncReturn {
  const [mouthOpen, setMouthOpen] = useState(false)
  const [micStatus, setMicStatus] = useState<MicStatus>('idle')

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const runningRef = useRef(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function tick(): void {
    if (!runningRef.current || !analyserRef.current) return

    const buffer = new Float32Array(analyserRef.current.fftSize)
    analyserRef.current.getFloatTimeDomainData(buffer)

    let sumSq = 0
    for (let i = 0; i < buffer.length; i++) sumSq += buffer[i] * buffer[i]
    const rms = Math.sqrt(sumSq / buffer.length)

    if (rms > MIC_THRESHOLD) {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      setMouthOpen(true)
      closeTimerRef.current = setTimeout(() => setMouthOpen(false), MOUTH_CLOSE_DELAY)
    }

    requestAnimationFrame(tick)
  }

  async function startLipSync(): Promise<void> {
    if (runningRef.current) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream
      audioContextRef.current = new AudioContext()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 512
      analyserRef.current.smoothingTimeConstant = 0.6
      source.connect(analyserRef.current)

      runningRef.current = true
      setMicStatus('active')
      tick()
      console.log('[renderer] 마이크 시작됨')
    } catch (err) {
      console.error('[renderer] 마이크 접근 실패:', err)
      setMicStatus('error')
    }
  }

  function stopLipSync(): void {
    runningRef.current = false
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    audioContextRef.current?.close()
    audioContextRef.current = null
    analyserRef.current = null
    setMouthOpen(false)
    setMicStatus('idle')
    console.log('[renderer] 마이크 중지됨')
  }

  return { mouthOpen, micStatus, startLipSync, stopLipSync }
}