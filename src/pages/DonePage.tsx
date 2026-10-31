import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Card, Divider } from '../components/ui'
import { loadText } from '../data/exercises'
import type { SetLog } from '../data/types'
import { db } from '../lib/db'
import { getExercise } from '../lib/library'
import { navigate } from '../lib/router'

// 训练完成（简版）。完整总结（哪些动作该加重）第 3 步做
export function DonePage({ sessionId }: { sessionId: string }) {
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId])
  const logs = useLiveQuery(() => db.setLogs.where('sessionId').equals(sessionId).sortBy('doneAt'), [sessionId])
  if (session === undefined || logs === undefined) return null

  const minutes = session ? Math.round(((session.endedAt ?? Date.now()) - session.startedAt) / 60000) : 0
  const byEx = new Map<string, SetLog[]>()
  for (const l of logs) byEx.set(l.exerciseId, [...(byEx.get(l.exerciseId) ?? []), l])

  return (
    <div className="pb-10 pt-6">
      <div className="text-center text-[64px] leading-none">✓</div>
      <h1 className="mt-3 text-center text-[27px] font-bold">练完了</h1>
      <p className="mt-1 text-center text-[17px] text-zinc-300">{session?.templateName}</p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Card className="text-center">
          <div className="text-[13px] text-zinc-400">用时</div>
          <div className="mt-1 text-[32px] font-bold tabular-nums">
            {minutes}
            <span className="ml-1 text-lg text-zinc-300">分</span>
          </div>
        </Card>
        <Card className="text-center">
          <div className="text-[13px] text-zinc-400">组数</div>
          <div className="mt-1 text-[32px] font-bold tabular-nums">
            {logs.length}
            <span className="ml-1 text-lg text-zinc-300">组</span>
          </div>
        </Card>
      </div>

      <Card className="mt-4 py-1">
        {[...byEx.entries()].map(([id, ls], i) => {
          const ex = getExercise(id)
          return (
            <div key={id}>
              {i > 0 && <Divider />}
              <div className="py-3">
                <div className="text-[17px] font-semibold">{ex.name}</div>
                <div className="mt-1 text-[15px] leading-relaxed text-zinc-300 tabular-nums">
                  {ls
                    .map((l) => {
                      const side = l.side ? (l.side === 'L' ? '左' : '右') : ''
                      return ex.unit === 'none' ? `${side}${l.reps}` : `${side}${loadText(ex, l.load)}×${l.reps}`
                    })
                    .join('  ')}
                </div>
              </div>
            </div>
          )
        })}
        {logs.length === 0 && <div className="py-3 text-[15px] text-zinc-300">这次没有记录任何组</div>}
      </Card>

      <p className="mt-3 px-1 text-[13px] text-zinc-400">哪些动作该加重的总结，下一步做</p>

      <Button variant="primary" className="mt-6 h-14 w-full text-xl" onClick={() => navigate('today', { replace: true })}>
        回首页
      </Button>
    </div>
  )
}
