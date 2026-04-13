import { useState } from 'react'

export interface ImagePaths {
  body:        string
  handIdle:    string
  handLeft:    string
  handRight:   string
  mouthClosed: string
  mouthOpen:   string
}

export type ImageSlot = keyof ImagePaths

const DEFAULTS: ImagePaths = {
  body:        'body/body.png',
  handIdle:    'hands/idle.png',
  handLeft:    'hands/left.png',
  handRight:   'hands/right.png',
  mouthClosed: 'mouth/closed.png',
  mouthOpen:   'mouth/open.png',
}

const STORAGE_KEY = 'bongo-image-paths'

function load(): ImagePaths {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) }
  } catch {}
  return { ...DEFAULTS }
}

export function useImagePaths() {
  const [paths, setPaths] = useState<ImagePaths>(load)

  async function pickImage(slot: ImageSlot) {
    const filePath = await window.electronAPI?.selectImage()
    if (!filePath) return

    // Electron에서 로컬 파일은 file:// 프로토콜로 로드
    const url = `file://${filePath}`
    const next = { ...paths, [slot]: url }
    setPaths(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function resetSlot(slot: ImageSlot) {
    const next = { ...paths, [slot]: DEFAULTS[slot] }
    setPaths(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function resetAll() {
    setPaths({ ...DEFAULTS })
    localStorage.removeItem(STORAGE_KEY)
  }

  return { paths, pickImage, resetSlot, resetAll }
}
