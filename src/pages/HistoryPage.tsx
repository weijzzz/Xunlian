import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { ExerciseTrend } from '../components/ExerciseTrend'
import { SessionSummaryView } from '../components/SessionSummary'
import { Button, Chip } from '../components/ui'
import { GROUP_NAME, type Session } from '../data/types'
import { longDate } from '../lib/dates'
import { db } from '../lib/db'
import { navigate } from '../lib/router'
import { deleteSession } from '../lib/session'

const hhmm = (t: number) => {
  const d = new Date(t)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

// #/history = 训练记录；#/history/trend[/动作] = 动作趋势；#/history/:id = 某次详情
export function HistoryPage({ id, sub }: { id?: string; sub?: string }) {
  if (id && id !== 'trend') return <HistoryDetail id={id} />
  const trend = id === 'trend'
  return (
    <div>
      <h1 className="mb-3 text-[27px] font-bold">历史</h1>
      <div className="grid grid-cols-2 rounded-xl bg-zinc-800 p-1">
        {[
          ['history', '训练记录', !trend],
          ['history/trend', '动作趋势', trend],
        ].map(([to, label, on]) => (
          <button
            key={String(to)}
            type="button"
            onClick={() => navigate(String(to), { replace: true })}
            className={`h-10 rounded-lg text-[15px] font-semibold ${on ? 'bg-zinc-600 text-white' : 'text-zinc-300'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {trend ? <ExerciseTrend exerciseId={sub} /> : <HistoryList />}
    </div>
  )
}

function HistoryList() {
  const sessions = useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().toArray(), [])
  const counts = useLiveQuery(async () => {
    const m = new Map<string, number>()
    await db.setLogs.each((l) => m.set(l.sessionId, (m.get(l.sessionId) ?? 0) + 1))
    return m
  }, [])
  if (!sessions || !counts) return null

  // 按月份分组
  const groups: { label: string; items: Session[] }[] = []
  for (const s of sessions) {
    const d = new Date(s.startedAt)
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`
    if (groups[groups.length - 1]?.label !== label) groups.push({ label, items: [] })
    groups[groups.length - 1].items.push(s)
  }

  return (
    <div>
      <p className="mt-3 text-[15px] text-zinc-300">{sessions.length ? `一共 ${sessions.length} 次训练` : '还没有训练记录，练完一次这里就有了'}</p>
      {groups.map((g) => (
        <div key={g.label}>
          <div className="mb-2 mt-6 px-1 text-[15px] font-bold text-zinc-200">{g.label}</div>
          <div className="space-y-2">
            {g.items.map((s) => {
              const n = counts.get(s.id) ?? 0
              const end = s.endedAt ?? s.startedAt
              const min = Math.round((end - s.startedAt) / 60000)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => navigate(s.status === 'active' ? 'train' : `history/${s.id}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-700/60 bg-zinc-800/70 px-4 py-3 text-left active:bg-zinc-700"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] text-zinc-400">
                      {longDate(new Date(s.startedAt))} · {hhmm(s.startedAt)}
                    </div>
                    <div className="mt-0.5 text-lg font-bold">{s.templateName}</div>
                    {(s.status === 'active' || s.short || s.fatigued.length > 0) && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {s.status === 'active' && <Chip tone="lime">进行中 · 点一下继续</Chip>}
                        {s.short && <Chip tone="sky">精简</Chip>}
                        {s.fatigued.length > 0 && <Chip tone="amber">疲劳：{s.fatigued.map((x) => GROUP_NAME[x]).join('、')}</Chip>}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[15px] tabular-nums text-zinc-200">{n} 组</div>
                    {s.status !== 'active' && <div className="text-[13px] tabular-nums text-zinc-400">{min} 分钟</div>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function HistoryDetail({ id }: { id: string }) {
  const session = useLiveQuery(() => db.sessions.get(id), [id])
  const [confirm, setConfirm] = useState(false)
  if (session === undefined) return null
  return (
    <div className="pb-10">
      <button type="button" onClick={() => navigate('history')} className="-ml-2 h-11 rounded-lg px-2 text-[17px] text-zinc-300 active:bg-zinc-800">
        ‹ 历史
      </button>
      {session ? (
        <>
          <div className="mt-1 text-[15px] text-zinc-300">
            {longDate(new Date(session.startedAt))} · {hhmm(session.startedAt)}
          </div>
          <h1 className="mb-4 text-[27px] font-bold">{session.templateName}</h1>
          <SessionSummaryView sessionId={id} />
          <div className="mt-8 rounded-2xl border border-zinc-700/60 bg-zinc-800/70 p-4">
            <div className="text-[17px] font-semibold">删除这次训练</div>
            <div className="mt-0.5 text-[13px] text-zinc-400">比如误点开始的。所有组都会删掉，不能恢复</div>
            <div className="mt-3">
              {confirm ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="ghost" onClick={() => setConfirm(false)}>
                    取消
                  </Button>
                  <Button variant="danger" onClick={() => void deleteSession(id).then(() => navigate('history'))}>
                    确认删除
                  </Button>
                </div>
              ) : (
                <Button variant="danger" className="w-full" onClick={() => setConfirm(true)}>
                  删除
                </Button>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="mt-6 text-[17px] text-zinc-300">这次训练已经删掉了。</p>
      )}
    </div>
  )
}
