import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { fmtNum } from '../data/exercises'
import { GROUP_NAME, type Exercise, type SetLog } from '../data/types'
import { db } from '../lib/db'
import { getExercise } from '../lib/library'
import { deleteLog, updateLog } from '../lib/session'
import { summarize, type Trend } from '../lib/summary'
import { Sheet } from './Sheet'
import { Stepper } from './Stepper'
import { Button, Card, Chip, Divider } from './ui'

const TREND_STYLE: Record<Trend, string> = {
  better: 'bg-lime-400/20 text-lime-200',
  same: 'bg-zinc-700 text-zinc-200',
  worse: 'bg-amber-400/20 text-amber-200',
  first: 'bg-sky-400/20 text-sky-200',
  fatigued: 'bg-amber-400/15 text-amber-200',
}
const TREND_ICON: Record<Trend, string> = { better: '↑ ', same: '= ', worse: '↓ ', first: '', fatigued: '' }

function pill(ex: Exercise, l: SetLog): string {
  const side = l.side === 'L' ? '左' : l.side === 'R' ? '右' : ''
  if (ex.unit === 'none') return `${side}${l.reps}`
  return `${side}${fmtNum(l.load)}${ex.unit === 'cm' ? 'cm' : 'kg'}×${l.reps}`
}

// 一次训练的完整总结：完成页和历史详情共用。点某一组可以改/删
export function SessionSummaryView({ sessionId, editable = true }: { sessionId: string; editable?: boolean }) {
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId])
  const logs = useLiveQuery(() => db.setLogs.where('sessionId').equals(sessionId).toArray(), [sessionId])
  const exIds = [...new Set((logs ?? []).map((l) => l.exerciseId))]
  const history = useLiveQuery(() => db.setLogs.where('exerciseId').anyOf(exIds).toArray(), [exIds.join(',')])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const [edit, setEdit] = useState<SetLog | null>(null)

  if (session === undefined || logs === undefined || history === undefined || sessions === undefined) return null
  if (!session) return <p className="mt-6 text-[17px] text-zinc-300">这次训练已经删掉了。</p>

  const sum = summarize(session, logs, history, new Map(sessions.map((s) => [s.id, s])))
  const advice = sum.exercises.filter((e) => e.advice)

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: '用时', v: sum.minutes, unit: '分' },
          { label: '组数', v: sum.sets, unit: '组' },
          { label: '总次数', v: sum.reps, unit: '次' },
        ].map((x) => (
          <Card key={x.label} className="px-2 text-center">
            <div className="text-[13px] text-zinc-400">{x.label}</div>
            <div className="mt-0.5 text-[28px] font-bold leading-tight tabular-nums">
              {x.v}
              <span className="ml-0.5 text-[15px] text-zinc-300">{x.unit}</span>
            </div>
          </Card>
        ))}
      </div>

      {(session.short || session.fatigued.length > 0 || session.status === 'active') && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {session.status === 'active' && <Chip tone="lime">进行中</Chip>}
          {session.short && <Chip tone="sky">精简</Chip>}
          {session.fatigued.length > 0 && <Chip tone="amber">疲劳：{session.fatigued.map((g) => GROUP_NAME[g]).join('、')}</Chip>}
        </div>
      )}

      {advice.length > 0 && (
        <div className="mt-4 rounded-2xl border border-lime-400/50 bg-lime-400/10 p-4">
          <div className="text-[17px] font-bold text-lime-200">该加难了</div>
          <div className="mt-2 space-y-2">
            {advice.map((e) => (
              <div key={e.ex.id}>
                <div className="text-[17px] font-semibold">{e.ex.name}</div>
                <div className="text-[15px] text-lime-100">{e.advice}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Card className="mt-4 py-1">
        {sum.exercises.map((e, i) => (
          <div key={e.ex.id}>
            {i > 0 && <Divider />}
            <div className="py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[17px] font-semibold">{e.ex.name}</span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${TREND_STYLE[e.trend]}`}>
                  {TREND_ICON[e.trend]}
                  {e.trendText}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {e.logs.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    disabled={!editable}
                    onClick={() => setEdit(l)}
                    className="rounded-lg bg-zinc-700 px-2.5 py-1.5 text-[15px] tabular-nums text-zinc-100 active:bg-zinc-600 disabled:active:bg-zinc-700"
                  >
                    {pill(e.ex, l)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
        {sum.exercises.length === 0 && <div className="py-3 text-[15px] text-zinc-300">这次没有记录任何组</div>}
      </Card>
      {editable && sum.exercises.length > 0 && <p className="mt-2 px-1 text-[13px] text-zinc-400">记错了？点那一组可以改或删</p>}

      <EditSetSheet log={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

function EditSetSheet({ log, onClose }: { log: SetLog | null; onClose: () => void }) {
  const [load, setLoad] = useState(0)
  const [reps, setReps] = useState(0)
  const [confirmDel, setConfirmDel] = useState(false)
  useEffect(() => {
    if (log) {
      setLoad(log.load)
      setReps(log.reps)
      setConfirmDel(false)
    }
  }, [log])
  if (!log) return null
  const ex = getExercise(log.exerciseId)
  const side = log.side === 'L' ? ' 左边' : log.side === 'R' ? ' 右边' : ''
  return (
    <Sheet open={!!log} onClose={onClose} title={`${ex.name}${side} 第 ${log.setNo} 组`}>
      <div className="space-y-4">
        {ex.unit !== 'none' && (
          <div>
            <div className="mb-1.5 px-1 text-[15px] font-semibold text-zinc-300">{ex.unit === 'cm' ? '脚垫高度' : '负重'}</div>
            <Stepper label="负重" value={load} onChange={setLoad} step={ex.step || 0.5} min={0} max={120} unit={ex.unit} size="md" />
          </div>
        )}
        <div>
          <div className="mb-1.5 px-1 text-[15px] font-semibold text-zinc-300">次数</div>
          <Stepper label="次数" value={reps} onChange={setReps} step={1} min={0} max={100} unit="次" size="md" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={() =>
              void updateLog(log.id, load, reps).then(() => {
                onClose()
              })
            }
          >
            保存
          </Button>
        </div>
        {confirmDel ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setConfirmDel(false)}>
              不删
            </Button>
            <Button variant="danger" onClick={() => void deleteLog(log.id).then(onClose)}>
              确认删掉这组
            </Button>
          </div>
        ) : (
          <Button variant="danger" className="w-full" onClick={() => setConfirmDel(true)}>
            删掉这组
          </Button>
        )}
      </div>
    </Sheet>
  )
}
