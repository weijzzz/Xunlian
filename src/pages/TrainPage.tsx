import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ExercisePicker } from '../components/ExercisePicker'
import { Sheet, SheetItem } from '../components/Sheet'
import { Stepper } from '../components/Stepper'
import { Button } from '../components/ui'
import { loadText, WARMUPS } from '../data/exercises'
import { CIRCLED } from '../data/templates'
import type { Exercise, Session, SetLog } from '../data/types'
import { restOverAlert, tick, unlockAudio } from '../lib/alert'
import { db } from '../lib/db'
import { getExercise } from '../lib/library'
import { buildPlan, nextAfter, stepIndex, type PlanStep } from '../lib/plan'
import { computePrefill, findRef, type Banner, type Prefill } from '../lib/progress'
import { navigate } from '../lib/router'
import {
  addRest,
  addSet,
  appendExercise,
  endRest,
  finishSession,
  finishWarmup,
  logSet,
  replaceExercise,
  skipExercise,
  updateLog,
  useActiveSession,
} from '../lib/session'
import { useWakeLock } from '../lib/wakeLock'

export function TrainPage() {
  const session = useActiveSession()
  if (session === undefined) return null
  if (session === null) {
    return (
      <div className="pt-10 text-center">
        <p className="text-[17px] text-zinc-300">现在没有进行中的训练</p>
        <Button className="mt-6" onClick={() => navigate('today', { replace: true })}>
          回首页
        </Button>
      </div>
    )
  }
  return <Trainer session={session} />
}

const SIDE_NAME = { L: '左边', R: '右边' }

function Trainer({ session }: { session: Session }) {
  useWakeLock(true)
  const plan = useMemo(() => buildPlan(session.layout), [session.layout])
  const exIds = useMemo(() => [...new Set(plan.map((p) => p.exerciseId))], [plan])
  const logs = useLiveQuery(() => db.setLogs.where('sessionId').equals(session.id).sortBy('doneAt'), [session.id])
  const history = useLiveQuery(() => db.setLogs.where('exerciseId').anyOf(exIds).toArray(), [exIds.join(',')])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])

  const [menu, setMenu] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [editLast, setEditLast] = useState(false)
  const [picking, setPicking] = useState<'replace' | 'append' | null>(null)

  if (!logs || !history || !sessions) return null

  const sessMap = new Map(sessions.map((s) => [s.id, s]))
  const prefillFor = (st: PlanStep): Prefill => {
    const ex = getExercise(st.exerciseId)
    const ref = findRef(ex, history, sessMap, session.id)
    return computePrefill(
      ex,
      st.side,
      logs.filter((l) => l.exerciseId === ex.id),
      ref,
      session.fatigued.includes(ex.group),
    )
  }

  const c = session.cursor
  const idx = stepIndex(plan, c)
  const step = idx >= 0 ? plan[idx] : undefined
  // 菜单里的操作针对的动作：记组时是当前这个，休息时是下一个
  const nextIdx = c.phase === 'rest' ? nextAfter(plan, c) : idx
  const target = nextIdx >= 0 ? plan[nextIdx] : undefined
  const targetEx = target ? getExercise(target.exerciseId) : undefined
  const targetSlot = target ? session.layout[target.b]?.slots[target.s] : undefined
  const lastLog = logs[logs.length - 1]

  const finish = async () => {
    await finishSession(session.id)
    navigate(`done/${session.id}`, { replace: true })
  }

  const position = c.phase === 'rest' ? nextIdx + 1 : idx + 1
  const blockLabel =
    c.phase === 'warmup'
      ? '热身'
      : target
        ? `${CIRCLED[target.b]}${target.finisher ? ' 收尾' : ''} 第 ${target.r}/${target.rounds} 轮`
        : ''

  return (
    <div className="flex min-h-[calc(100dvh-2rem)] flex-col">
      {/* 顶栏 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="回首页"
          onClick={() => navigate('today')}
          className="-ml-2 h-11 w-11 rounded-lg text-2xl text-zinc-300 active:bg-zinc-800"
        >
          ‹
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-zinc-200">
            {session.templateName}
            {session.short ? ' · 精简' : ''} · {blockLabel}
          </div>
        </div>
        {c.phase !== 'warmup' && (
          <span className="text-[15px] tabular-nums text-zinc-300">
            {Math.max(position, 1)}/{plan.length}
          </span>
        )}
        <button
          type="button"
          aria-label="菜单"
          onClick={() => setMenu(true)}
          className="h-11 w-11 rounded-lg text-2xl font-bold text-zinc-200 active:bg-zinc-800"
        >
          ⋯
        </button>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-lime-400 transition-all"
          style={{ width: `${plan.length ? (Math.min(logs.length, plan.length) / plan.length) * 100 : 0}%` }}
        />
      </div>

      {c.phase === 'warmup' && <WarmupView session={session} plan={plan} />}

      {c.phase === 'set' && step && (
        <SetView
          key={`${step.b}-${step.r}-${step.s}-${step.side ?? ''}-${step.exerciseId}-${logs.length}`}
          step={step}
          prefill={prefillFor(step)}
          onDone={async (load, reps) => {
            const pf = prefillFor(step)
            const finished = await logSet(session, step, pf.setNo, load, reps)
            if (finished) navigate(`done/${session.id}`, { replace: true })
          }}
        />
      )}

      {c.phase === 'rest' && (
        <RestView
          session={session}
          next={target}
          nextPrefill={target ? prefillFor(target) : undefined}
          lastLog={lastLog}
          onEditLast={() => setEditLast(true)}
          onFinished={() => navigate(`done/${session.id}`, { replace: true })}
        />
      )}

      {/* ⋯ 菜单 */}
      <Sheet
        open={menu}
        onClose={() => {
          setMenu(false)
          setConfirmEnd(false)
        }}
        title={targetEx && c.phase !== 'warmup' ? `${c.phase === 'rest' ? '下一个：' : ''}${targetEx.name}` : '训练'}
      >
        <div className="space-y-1">
          {lastLog && (
            <SheetItem
              onClick={() => {
                setMenu(false)
                setEditLast(true)
              }}
              sub={`${getExercise(lastLog.exerciseId).name} ${logText(getExercise(lastLog.exerciseId), lastLog)}`}
            >
              改上一组
            </SheetItem>
          )}
          {target && targetSlot && c.phase !== 'warmup' && (
            <>
              <SheetItem
                onClick={() => {
                  setMenu(false)
                  setPicking('replace')
                }}
                sub="这个动作剩下的组都换成新的"
              >
                换动作
              </SheetItem>
              {targetSlot.altId && (
                <SheetItem
                  tone="accent"
                  onClick={() => {
                    setMenu(false)
                    void replaceExercise(session, targetSlot.altId!)
                  }}
                >
                  换成{getExercise(targetSlot.altId).name}
                </SheetItem>
              )}
              <SheetItem
                onClick={() => {
                  setMenu(false)
                  void skipExercise(session)
                }}
                sub={`剩下 ${Math.max(0, targetSlot.sets - target.r + 1)} 组都不做`}
              >
                跳过这个动作
              </SheetItem>
              <SheetItem
                onClick={() => {
                  setMenu(false)
                  void addSet(session)
                }}
                sub={`${targetSlot.sets} 组 → ${targetSlot.sets + 1} 组`}
              >
                多做一组
              </SheetItem>
            </>
          )}
          <SheetItem
            onClick={() => {
              setMenu(false)
              setPicking('append')
            }}
            sub="加在最后，做 3 组"
          >
            加一个动作
          </SheetItem>
          {confirmEnd ? (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="ghost" onClick={() => setConfirmEnd(false)}>
                继续练
              </Button>
              <Button variant="danger" onClick={() => void finish()}>
                确认结束
              </Button>
            </div>
          ) : (
            <SheetItem tone="danger" onClick={() => setConfirmEnd(true)} sub="已经记的组都会保存">
              提前结束训练
            </SheetItem>
          )}
        </div>
      </Sheet>

      <ExercisePicker
        open={picking !== null}
        onClose={() => setPicking(null)}
        title={picking === 'append' ? '加哪个动作？' : '换成哪个动作？'}
        preferGroup={picking === 'replace' ? targetEx?.group : undefined}
        excludeId={picking === 'replace' ? targetEx?.id : undefined}
        onPick={(id) => {
          if (picking === 'replace') void replaceExercise(session, id)
          else void appendExercise(session, id)
        }}
      />

      {lastLog && <EditLastSheet open={editLast} onClose={() => setEditLast(false)} log={lastLog} />}
    </div>
  )
}

function logText(ex: Exercise, l: SetLog): string {
  const side = l.side ? `${SIDE_NAME[l.side]} ` : ''
  return ex.unit === 'none' ? `${side}${l.reps} 次` : `${side}${loadText(ex, l.load)} × ${l.reps}`
}

// ---------- 热身 ----------

function WarmupView({ session, plan }: { session: Session; plan: PlanStep[] }) {
  const firstBlock = session.layout[0]
  const items = [
    ...(session.short ? [] : WARMUPS.map((w) => ({ id: w.id, name: w.name, detail: w.detail }))),
    ...(firstBlock?.slots ?? []).map((s) => ({
      id: `light-${s.exerciseId}`,
      name: getExercise(s.exerciseId).name,
      detail: '轻组：一半次数，不加重',
    })),
  ]
  const [done, setDone] = useState<Set<string>>(new Set())
  return (
    <div className="mt-5 flex flex-1 flex-col">
      <h2 className="text-[27px] font-bold">热身 {session.short ? '3' : '5'} 分钟</h2>
      <p className="mt-1 text-[15px] text-zinc-300">做完一项点一下，不用记重量</p>
      <div className="mt-4 space-y-2">
        {items.map((it) => {
          const on = done.has(it.id)
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => {
                unlockAudio()
                setDone((d) => {
                  const n = new Set(d)
                  if (n.has(it.id)) n.delete(it.id)
                  else n.add(it.id)
                  return n
                })
              }}
              className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border px-4 text-left ${
                on ? 'border-lime-400/60 bg-lime-400/10' : 'border-zinc-700/60 bg-zinc-800/70 active:bg-zinc-700'
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold ${
                  on ? 'border-lime-400 bg-lime-400 text-zinc-950' : 'border-zinc-500'
                }`}
              >
                {on ? '✓' : ''}
              </span>
              <span className="min-w-0">
                <span className="block text-[17px] font-semibold">{it.name}</span>
                <span className="block text-[13px] text-zinc-400">{it.detail}</span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-auto pt-6">
        <Button
          variant="primary"
          className="h-16 w-full text-xl"
          onClick={() => {
            unlockAudio()
            void finishWarmup(session)
          }}
        >
          开始正式训练 · 共 {plan.length} 组
        </Button>
      </div>
    </div>
  )
}

// ---------- 记一组 ----------

const BANNER_STYLE: Record<Banner['tone'], string> = {
  amber: 'bg-amber-400/20 text-amber-100',
  sky: 'bg-sky-400/20 text-sky-100',
  lime: 'bg-lime-400/20 text-lime-100',
}

const PIKE_PRESETS = [0, 10, 30, 45]

function SetView({ step, prefill, onDone }: { step: PlanStep; prefill: Prefill; onDone: (load: number, reps: number) => Promise<void> }) {
  const ex = getExercise(step.exerciseId)
  const [load, setLoad] = useState(prefill.load)
  const [reps, setReps] = useState(prefill.reps)
  const [saving, setSaving] = useState(false)

  return (
    <div className="mt-4 flex flex-1 flex-col">
      {/* 动作信息 */}
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[27px] font-bold leading-tight">{ex.name}</h2>
        {step.side && (
          <span
            className={`mt-1 shrink-0 rounded-xl px-3 py-1 text-lg font-bold ${
              step.side === 'L' ? 'bg-sky-400/25 text-sky-200' : 'bg-amber-400/25 text-amber-200'
            }`}
          >
            {SIDE_NAME[step.side]}
          </span>
        )}
      </div>
      <p className="mt-1 text-[15px] leading-relaxed text-zinc-200">{ex.cue}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[17px]">
        {prefill.refText && <span className="text-zinc-300">{prefill.refText}</span>}
        {prefill.refText && <span className="text-zinc-500">→</span>}
        <span className="font-bold text-lime-300">目标 {prefill.target ?? '力竭'}</span>
      </div>
      {prefill.banners.map((bn) => (
        <div key={bn.text} className={`mt-2 rounded-xl px-3 py-2 text-[15px] ${BANNER_STYLE[bn.tone]}`}>
          {bn.text}
        </div>
      ))}

      {/* 输入区：放在下半屏 */}
      <div className="mt-auto space-y-4 pt-5">
        {ex.unit !== 'none' && (
          <div>
            <div className="mb-1.5 flex items-baseline justify-between px-1">
              <span className="text-[15px] font-semibold text-zinc-300">{ex.unit === 'cm' ? '脚垫高度' : `负重（${ex.loadLabel}）`}</span>
            </div>
            {ex.unit === 'cm' && (
              <div className="mb-2 grid grid-cols-4 gap-2">
                {PIKE_PRESETS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setLoad(v)}
                    className={`h-11 rounded-xl text-[17px] font-semibold ${load === v ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-700 text-zinc-100 active:bg-zinc-600'}`}
                  >
                    {v === 0 ? '地面' : `${v}cm`}
                  </button>
                ))}
              </div>
            )}
            <Stepper label="负重" value={load} onChange={setLoad} step={ex.step || 0.5} min={0} max={ex.unit === 'cm' ? 120 : 100} unit={ex.unit} size="md" />
          </div>
        )}

        <div>
          <div className="mb-1.5 px-1 text-[15px] font-semibold text-zinc-300">
            次数{ex.sided === 'alt' ? '（一边算 1 次）' : ''}
          </div>
          <Stepper label="次数" value={reps} onChange={setReps} step={1} min={0} max={100} unit="次" size="md" />
          <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${prefill.chips.length}, minmax(0, 1fr))` }}>
            {prefill.chips.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setReps(n)}
                className={`h-13 rounded-xl text-xl font-bold tabular-nums ${
                  reps === n ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-700 text-zinc-100 active:bg-zinc-600'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="primary"
          disabled={saving}
          className="h-16 w-full text-xl"
          onClick={async () => {
            unlockAudio()
            setSaving(true)
            await onDone(load, reps)
          }}
        >
          完成这组 ✓
        </Button>
      </div>
    </div>
  )
}

// ---------- 休息 ----------

function fmtClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function RestView({
  session,
  next,
  nextPrefill,
  lastLog,
  onEditLast,
  onFinished,
}: {
  session: Session
  next?: PlanStep
  nextPrefill?: Prefill
  lastLog?: SetLog
  onEditLast: () => void
  onFinished: () => void
}) {
  const endsAt = session.cursor.restEndsAt ?? Date.now()
  const total = session.cursor.restTotal ?? 60
  const [now, setNow] = useState(() => Date.now())
  const lastTick = useRef<number | null>(null)
  const ending = useRef(false)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [])

  const remainMs = endsAt - now
  useEffect(() => {
    const sec = Math.ceil(remainMs / 1000)
    const visible = document.visibilityState === 'visible'
    if (remainMs <= 0) {
      if (ending.current) return
      ending.current = true
      // 刚到点才响；切出去很久回来就直接进下一组，不响
      if (visible && remainMs > -2000) restOverAlert()
      void endRest(session).then((done) => done && onFinished())
      return
    }
    if (sec <= 3 && sec !== lastTick.current && visible) {
      lastTick.current = sec
      tick()
    }
  }, [remainMs, session, onFinished])

  const nextEx = next ? getExercise(next.exerciseId) : undefined
  const pct = Math.min(100, Math.max(0, (remainMs / 1000 / total) * 100))
  const lastEx = lastLog ? getExercise(lastLog.exerciseId) : undefined

  return (
    <div className="mt-6 flex flex-1 flex-col">
      <div className="text-center text-xl font-semibold text-zinc-300">休息</div>
      <div className="mt-1 text-center text-[96px] font-bold leading-none tabular-nums">{fmtClock(remainMs / 1000)}</div>
      <div className="mx-auto mt-4 h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-lime-400" style={{ width: `${pct}%` }} />
      </div>

      {nextEx && next && nextPrefill && (
        <div className="mt-6 rounded-2xl border border-zinc-700/60 bg-zinc-800/70 p-4">
          <div className="text-[13px] text-zinc-400">下一个</div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-[22px] font-bold">{nextEx.name}</span>
            {next.side && <span className="text-[17px] font-semibold text-sky-200">{SIDE_NAME[next.side]}</span>}
          </div>
          <div className="mt-1 text-[17px] text-zinc-200">
            目标 <span className="font-bold text-lime-300">{nextPrefill.target ?? '力竭'}</span>
            {nextEx.unit !== 'none' && <> · {loadText(nextEx, nextPrefill.load)}</>}
          </div>
          {nextPrefill.banners.map((bn) => (
            <div key={bn.text} className={`mt-2 rounded-xl px-3 py-2 text-[13px] ${BANNER_STYLE[bn.tone]}`}>
              {bn.text}
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto space-y-3 pt-6">
        {lastLog && lastEx && (
          <div className="flex items-center justify-between rounded-xl bg-zinc-800 px-4 py-2">
            <span className="text-[15px] text-zinc-300">
              刚才 {lastEx.name} {logText(lastEx, lastLog)}
            </span>
            <button type="button" onClick={onEditLast} className="h-10 px-2 text-[15px] font-semibold text-lime-300">
              改
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button className="h-16 text-xl" onClick={() => void addRest(session, 15)}>
            +15 秒
          </Button>
          <Button
            variant="primary"
            className="h-16 text-xl"
            onClick={() => {
              if (ending.current) return
              ending.current = true
              void endRest(session).then((done) => done && onFinished())
            }}
          >
            跳过
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------- 改上一组 ----------

function EditLastSheet({ open, onClose, log }: { open: boolean; onClose: () => void; log: SetLog }) {
  const ex = getExercise(log.exerciseId)
  const [load, setLoad] = useState(log.load)
  const [reps, setReps] = useState(log.reps)
  useEffect(() => {
    if (open) {
      setLoad(log.load)
      setReps(log.reps)
    }
  }, [open, log])
  return (
    <Sheet open={open} onClose={onClose} title={`改上一组：${ex.name}${log.side ? ` ${SIDE_NAME[log.side]}` : ''}`}>
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
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              await updateLog(log.id, load, reps)
              onClose()
            }}
          >
            保存
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

