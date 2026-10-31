import { ANIMS } from '../anim/anims'
import { ExerciseAnim } from '../anim/ExerciseAnim'
import { getExercise } from '../lib/library'

// 调试用：#/dev/anims 看所有动画的关键帧
function keyTimes(id: string): number[] {
  const def = ANIMS[id]
  const times: number[] = [0.01]
  let t = 0
  for (const st of def.timeline) {
    if ('hold' in st) t += st.hold
    else {
      times.push(t + st.dur / 2)
      t += st.dur
      times.push(t + 0.01)
    }
  }
  return [...new Set(times)].slice(0, 5)
}

export function DevAnims() {
  return (
    <div className="space-y-4 py-4">
      {Object.keys(ANIMS).map((id) => (
        <div key={id} className="rounded-xl bg-zinc-900 p-2">
          <div className="mb-1 text-[15px] font-bold">
            {getExercise(id).name} <span className="text-zinc-400">{id}</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {keyTimes(id).slice(0, 3).map((t) => (
              <div key={t} className="rounded bg-zinc-950">
                <ExerciseAnim exerciseId={id} at={t} className="h-28 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
