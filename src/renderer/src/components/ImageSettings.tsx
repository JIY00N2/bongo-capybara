import { ImagePaths, ImageSlot } from '../hooks/useImagePaths'

const SLOT_LABELS: Record<ImageSlot, string> = {
  body:        '대기',
  handLeft:    '손 (왼쪽)',
  handRight:   '손 (오른쪽)',
  mouthClosed: '입 (닫힘)',
  mouthOpen:   '입 (열림)',
}

interface Props {
  paths: ImagePaths
  onPick: (slot: ImageSlot) => void
  onReset: (slot: ImageSlot) => void
  onResetAll: () => void
}

export function ImageSettings({ paths, onPick, onReset, onResetAll }: Props) {
  const slots = Object.keys(SLOT_LABELS) as ImageSlot[]

  return (
    <div id="image-settings">
      <div id="image-settings-header">
        <span>이미지 설정</span>
        <button id="reset-all-btn" onClick={onResetAll} title="전체 초기화">↺</button>
      </div>
      {slots.map(slot => (
        <div key={slot} className="img-row">
          <span className="img-label">{SLOT_LABELS[slot]}</span>
          <button className="img-pick-btn" onClick={() => onPick(slot)}>파일 선택</button>
          <button className="img-reset-btn" onClick={() => onReset(slot)} title="초기화">↺</button>
        </div>
      ))}
    </div>
  )
}
