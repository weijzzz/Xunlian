import { useEffect, useRef } from 'react'
import { ANIMS } from './anims'
import { poseAt, renderSVG, solve, type AnimDef } from './figure'

function frame(def: AnimDef, t: number): string {
  return renderSVG(def, solve(poseAt(def, t), def.elbow, def.knee))
}

export function hasAnim(exerciseId: string): boolean {
  return exerciseId in ANIMS
}

// 动作动画。at = 固定显示某一秒（截图/调试用）
export function ExerciseAnim({ exerciseId, at, className = '' }: { exerciseId: string; at?: number; className?: string }) {
  const def = ANIMS[exerciseId]
  const gRef = useRef<SVGGElement>(null)

  useEffect(() => {
    if (!def || !gRef.current) return
    const g = gRef.current
    if (at !== undefined) {
      g.innerHTML = frame(def, at)
      return
    }
    let raf = 0
    const start = performance.now()
    const loop = (now: number) => {
      g.innerHTML = frame(def, (now - start) / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [def, at])

  if (!def) return null
  return (
    <svg viewBox={def.viewBox.join(' ')} className={className} preserveAspectRatio="xMidYMid meet" role="img" aria-label="动作演示">
      <g ref={gRef} />
    </svg>
  )
}
