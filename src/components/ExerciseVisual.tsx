import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { ExerciseAnim, hasAnim } from '../anim/ExerciseAnim'
import { db } from '../lib/db'
import { Sheet, SheetItem } from './Sheet'

const MAX_MB = 30

function useObjectURL(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) {
      setUrl(undefined)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

// 动作演示：用户自己的图片/动图/视频优先，没有就用内置的小人动画
export function ExerciseVisual({ exerciseId, editable = false, className = '' }: { exerciseId: string; editable?: boolean; className?: string }) {
  const media = useLiveQuery(() => db.media.get(exerciseId), [exerciseId])
  const url = useObjectURL(media?.blob)
  const [sheet, setSheet] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const anim = hasAnim(exerciseId)

  const save = async (f: File | undefined) => {
    if (!f) return
    setError(null)
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
      setError('只能用图片、动图或视频')
      return
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`文件太大（超过 ${MAX_MB}MB），换个短一点的视频`)
      return
    }
    await db.media.put({ exerciseId, blob: f, type: f.type, updatedAt: Date.now() })
    setSheet(false)
  }

  let content
  if (media && url) {
    content = media.type.startsWith('video/') ? (
      <video src={url} autoPlay loop muted playsInline className="h-full w-full rounded-2xl object-contain" />
    ) : (
      <img src={url} alt="动作演示" className="h-full w-full rounded-2xl object-contain" />
    )
  } else if (anim) {
    content = <ExerciseAnim exerciseId={exerciseId} className="h-full w-full" />
  } else if (editable) {
    content = <span className="text-[15px] text-zinc-400">＋ 添加图片 / 动图 / 视频</span>
  } else {
    content = null
  }
  if (!content) return null

  return (
    <>
      <button
        type="button"
        disabled={!editable}
        onClick={() => setSheet(true)}
        aria-label="动作演示"
        className={`relative flex items-center justify-center overflow-hidden rounded-2xl bg-zinc-900/70 ${className}`}
      >
        {content}
        {editable && (media || anim) && (
          <span className="absolute bottom-1.5 right-2 rounded-md bg-zinc-800/90 px-1.5 py-0.5 text-[13px] text-zinc-300">换图</span>
        )}
      </button>
      {editable && (
        <>
          <Sheet open={sheet} onClose={() => setSheet(false)} title="动作演示">
            <div className="space-y-1">
              <SheetItem onClick={() => fileRef.current?.click()} sub="从相册选，或者现场拍一段">
                用我自己的图片 / 动图 / 视频
              </SheetItem>
              {media && (
                <SheetItem
                  tone="danger"
                  onClick={() => {
                    void db.media.delete(exerciseId)
                    setSheet(false)
                  }}
                >
                  {anim ? '恢复默认动画' : '删除图片'}
                </SheetItem>
              )}
              {error && <div className="px-3 py-2 text-[15px] text-red-300">{error}</div>}
              <p className="px-3 pt-1 text-[13px] text-zinc-400">图片和视频只存在这台手机上，不包含在导出的备份里</p>
            </div>
          </Sheet>
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => void save(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
        </>
      )}
    </>
  )
}
