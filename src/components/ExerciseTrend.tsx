import { useLiveQuery } from 'dexie-react-hooks'
import { fmtNum } from '../data/exercises'
import type { Exercise, Session, SetLog } from '../data/types'
import { longDate } from '../lib/dates'
import { db } from '../lib/db'
import { getExercise } from '../lib/library'
import { navigate } from '../lib/router'
import { LineChart, SERIES_COLORS, type ChartSeries } from './LineChart'
import { Card } from './ui'

interface Row {
  session: Session
  logs: SetLog[]
  maxLoad: number
  fatigued: boolean
}

const unitOf = (ex: Exercise) => (ex.unit === 'cm' ? 'cm' : ex.unit === 'kg' ? 'kg' : '')

function pill(ex: Exercise, l: SetLog) {
  const side = l.side === 'L' ? '左' : l.side === 'R' ? '右' : ''
  return ex.unit === 'none' ? `${side}${l.reps}` : `${side}${fmtNum(l.load)}${unitOf(ex)}×${l.reps}`
}

// 历史 → 动作趋势
export function ExerciseTrend({ exerciseId }: { exerciseId?: string }) {
  const logs = useLiveQuery(() => db.setLogs.toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  if (!logs || !sessions) return null

  // 练过的动作，最近练的排前面
  const lastAt = new Map<string, number>()
  for (const l of logs) lastAt.set(l.exerciseId, Math.max(lastAt.get(l.exerciseId) ?? 0, l.doneAt))
  const exIds = [...lastAt.keys()].sort((a, b) => lastAt.get(b)! - lastAt.get(a)!)
  if (!exIds.length) return <p className="mt-6 text-[17px] text-zinc-300">还没有训练记录，练过以后这里会出现每个动作的趋势。</p>

  const selected = exerciseId && lastAt.has(exerciseId) ? exerciseId : exIds[0]
  const ex = getExercise(selected)
  const sessMap = new Map(sessions.map((s) => [s.id, s]))
  const bySession = new Map<string, SetLog[]>()
  for (const l of logs) if (l.exerciseId === selected) bySession.set(l.sessionId, [...(bySession.get(l.sessionId) ?? []), l])
  const rows: Row[] = [...bySession.entries()]
    .map(([sid, ls]) => {
      const session = sessMap.get(sid)
      if (!session) return null
      return { session, logs: ls.sort((a, b) => a.setNo - b.setNo || (a.side === 'R' ? 1 : -1)), maxLoad: Math.max(...ls.map((l) => l.load)), fatigued: session.fatigued.includes(ex.group) }
    })
    .filter((r): r is Row => r !== null)
    .sort((a, b) => a.session.startedAt - b.session.startedAt)

  // 每组次数：第 N 组一条线（单边取左右平均）
  const maxSet = Math.min(SERIES_COLORS.length, Math.max(...rows.map((r) => Math.max(...r.logs.map((l) => l.setNo)))))
  const setSeries: ChartSeries[] = []
  for (let n = 1; n <= maxSet; n++) {
    const pts = rows
      .map((r) => {
        const ls = r.logs.filter((l) => l.setNo === n)
        if (!ls.length) return null
        return { x: r.session.startedAt, y: +(ls.reduce((s, l) => s + l.reps, 0) / ls.length).toFixed(1), flag: r.fatigued }
      })
      .filter((p): p is { x: number; y: number; flag: boolean } => p !== null)
    if (pts.length) setSeries.push({ name: `第${n}组`, color: SERIES_COLORS[n - 1], points: pts })
  }
  const loadSeries: ChartSeries[] =
    ex.unit !== 'none' && rows.some((r) => r.maxLoad > 0)
      ? [{ name: ex.unit === 'cm' ? '脚垫高度' : '最大负重', color: SERIES_COLORS[0], points: rows.map((r) => ({ x: r.session.startedAt, y: r.maxLoad, flag: r.fatigued })) }]
      : []
  const best = rows
    .flatMap((r) => r.logs)
    .reduce<SetLog | null>((b, l) => (!b || l.load > b.load || (l.load === b.load && l.reps > b.reps) ? l : b), null)
  const isPullup = selected === 'pullup'

  return (
    <div>
      {/* 选动作 */}
      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {exIds.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => navigate(`history/trend/${id}`, { replace: true })}
            className={`h-10 shrink-0 rounded-full px-4 text-[15px] font-semibold ${
              id === selected ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-800 text-zinc-200 active:bg-zinc-700'
            }`}
          >
            {getExercise(id).name}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Card className="px-2 text-center">
          <div className="text-[13px] text-zinc-400">练过</div>
          <div className="text-[22px] font-bold tabular-nums">{rows.length} 次</div>
        </Card>
        <Card className="col-span-2 px-3">
          <div className="text-[13px] text-zinc-400">最好的一组</div>
          <div className="text-[22px] font-bold tabular-nums">{best ? pill(ex, best) : '—'}</div>
        </Card>
      </div>

      {loadSeries.length > 0 && (
        <Card className="mt-3">
          <div className="mb-1 text-[15px] font-bold">{loadSeries[0].name}（{unitOf(ex)}）</div>
          <LineChart series={loadSeries} unit={unitOf(ex)} flagLabel="疲劳模式那次" />
        </Card>
      )}

      <Card className="mt-3">
        <div className="mb-1 text-[15px] font-bold">
          {isPullup ? '引体每组次数' : '每组次数'}
          {ex.sided === 'LR' ? <span className="font-normal text-zinc-400">（左右平均）</span> : null}
        </div>
        <LineChart series={setSeries} unit="次" flagLabel="疲劳模式那次" yMin={0} />
        {rows.length < 2 && <p className="mt-1 px-1 text-[13px] text-zinc-400">多练几次就能看出趋势了</p>}
      </Card>

      {/* 每次的明细（也是图的表格版） */}
      <div className="mb-2 mt-5 px-1 text-[15px] font-bold text-zinc-200">每次的明细</div>
      <div className="space-y-2">
        {[...rows].reverse().map((r) => (
          <button
            key={r.session.id}
            type="button"
            onClick={() => navigate(`history/${r.session.id}`)}
            className="w-full rounded-2xl border border-zinc-700/60 bg-zinc-800/70 px-4 py-3 text-left active:bg-zinc-700"
          >
            <div className="flex items-center justify-between text-[13px] text-zinc-400">
              <span>
                {longDate(new Date(r.session.startedAt))} · {r.session.templateName}
              </span>
              {r.fatigued && <span className="text-amber-300">疲劳</span>}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {r.logs.map((l) => (
                <span key={l.id} className="rounded-lg bg-zinc-700 px-2 py-1 text-[15px] tabular-nums">
                  {pill(ex, l)}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
