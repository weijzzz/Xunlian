import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { ExercisePicker } from '../components/ExercisePicker'
import { Sheet, SheetItem } from '../components/Sheet'
import { Stepper } from '../components/Stepper'
import { Button, Chip } from '../components/ui'
import { repText } from '../data/exercises'
import { CIRCLED, cloneBlocks, REST, restBetween, restDefault, SHORT_ROUNDS, shortLayout } from '../data/templates'
import { GROUP_NAME, type Block, type Template } from '../data/types'
import { db } from '../lib/db'
import { blocksGroups, getExercise, useLibrary } from '../lib/library'
import { estimateMinutes } from '../lib/plan'
import { FATIGUE_HOURS, fatigueFor, lastTrained } from '../lib/progress'
import { navigate } from '../lib/router'
import { startSession, useActiveSession } from '../lib/session'

export function StartPage({ templateId }: { templateId: string }) {
  const { templates } = useLibrary()
  const tpl = templates.find((t) => t.id === templateId)
  if (!tpl) {
    return (
      <div className="pt-4">
        <BackButton />
        <p className="mt-6 text-[17px] text-zinc-300">找不到这张训练卡。</p>
      </div>
    )
  }
  return <StartForm key={tpl.id} tpl={tpl} />
}

function BackButton() {
  return (
    <button type="button" onClick={() => navigate('today')} className="-ml-2 h-11 rounded-lg px-2 text-[17px] text-zinc-300 active:bg-zinc-800">
      ‹ 返回
    </button>
  )
}

type Picking = { mode: 'replace'; b: number; s: number } | { mode: 'add'; b: number }

function StartForm({ tpl }: { tpl: Template }) {
  const [draft, setDraft] = useState<Block[]>(() => cloneBlocks(tpl.blocks))
  const [short, setShort] = useState(false)
  const [editing, setEditing] = useState<{ b: number; s: number } | null>(null)
  const [picking, setPicking] = useState<Picking | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = useActiveSession()
  const [now] = useState(() => Date.now())
  const recentLogs = useLiveQuery(() => db.setLogs.where('doneAt').above(now - FATIGUE_HOURS * 3_600_000).toArray(), [now])

  const used = short ? shortLayout(draft) : draft
  const groups = blocksGroups(used)
  const fatigue = fatigueFor(groups, lastTrained(recentLogs ?? []), now)
  const minFull = estimateMinutes(draft, false)
  const minShort = estimateMinutes(shortLayout(draft), true)
  const changed = JSON.stringify(draft) !== JSON.stringify(tpl.blocks)
  const empty = draft.every((b) => b.slots.length === 0)

  const update = (fn: (blocks: Block[]) => void) =>
    setDraft((d) => {
      const next = cloneBlocks(d)
      fn(next)
      return next.filter((b) => b.slots.length > 0)
    })

  const start = async () => {
    setStarting(true)
    setError(null)
    try {
      await startSession(
        tpl,
        draft,
        short,
        fatigue.map((f) => f.group),
      )
      navigate('train', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStarting(false)
    }
  }

  // 精简模式下每块实际做几组
  let mainIdx = -1
  const shortCap = draft.map((b) => {
    if (b.finisher) return 0
    mainIdx++
    return SHORT_ROUNDS[mainIdx] ?? SHORT_ROUNDS[SHORT_ROUNDS.length - 1]
  })

  const editingSlot = editing ? draft[editing.b]?.slots[editing.s] : undefined

  return (
    <div className="pb-28">
      <BackButton />
      <div className="mt-1 flex items-center justify-between">
        <h1 className="text-[27px] font-bold">{tpl.name}</h1>
        <div className="flex gap-1.5">
          <Chip tone={tpl.location === 'home' ? 'zinc' : 'sky'}>{tpl.location === 'home' ? '家' : '外面'}</Chip>
          {groups.map((g) => (
            <Chip key={g}>{GROUP_NAME[g]}</Chip>
          ))}
        </div>
      </div>

      {/* 完整 / 精简 */}
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-zinc-800/70 p-1.5">
        {[
          { v: false, label: '完整', min: minFull },
          { v: true, label: '精简', min: minShort },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => setShort(o.v)}
            className={`flex h-14 flex-col items-center justify-center rounded-xl ${short === o.v ? 'bg-lime-400 text-zinc-950' : 'text-zinc-200 active:bg-zinc-700'}`}
          >
            <span className="text-[17px] font-bold">{o.label}</span>
            <span className={`text-[13px] ${short === o.v ? 'text-zinc-800' : 'text-zinc-400'}`}>约 {o.min} 分钟</span>
          </button>
        ))}
      </div>
      {short && <p className="mt-2 px-1 text-[13px] text-zinc-400">热身只做轻组 → ① 做 3 轮 → ② 做 2 轮 → 收尾跳过</p>}

      {/* 48 小时 */}
      <div className={`mt-3 rounded-xl px-4 py-3 text-[15px] ${fatigue.length ? 'bg-amber-400/20 text-amber-100' : 'bg-zinc-800 text-zinc-300'}`}>
        {recentLogs === undefined ? (
          '检查 48 小时内练过什么…'
        ) : fatigue.length ? (
          <>
            <div className="font-semibold text-amber-200">
              {fatigue.map((f) => `${GROUP_NAME[f.group]} ${Math.round(f.hours)} 小时前`).join('、')}练过 → 疲劳模式
            </div>
            <div className="mt-0.5 text-[13px] text-amber-100/90">这些动作每组留 1-2 个，这次数据不参与加重判断，也不算退步</div>
          </>
        ) : (
          '48 小时内没练过这些肌群 ✓'
        )}
      </div>

      {/* 动作列表 */}
      <div className="mt-4 space-y-3">
        {draft.map((block, b) => (
          <div key={b} className={`rounded-2xl border border-zinc-700/60 bg-zinc-800/70 p-4 ${short && block.finisher ? 'opacity-40' : ''}`}>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-lg font-bold text-zinc-200">
                {CIRCLED[b]} {block.finisher ? '收尾' : block.slots.length > 1 ? '轮流做' : ''}
              </span>
              <span className="text-[13px] text-zinc-400">{restNote(block)}</span>
            </div>
            <div className="space-y-1">
              {block.slots.map((slot, s) => {
                const ex = getExercise(slot.exerciseId)
                const sets = short ? Math.min(slot.sets, shortCap[b]) : slot.sets
                return (
                  <div key={s}>
                    {s > 0 && <div className="py-0.5 pl-1 text-sm text-zinc-400">⇄</div>}
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-[17px] font-bold">{ex.name}</span>
                          <span className="text-[15px] font-semibold tabular-nums text-lime-300">
                            {short && block.finisher ? '跳过' : `${sets}×${repText(ex)}${ex.sided === 'LR' ? '/边' : ''}`}
                          </span>
                          <span className="text-[13px] text-zinc-400">{ex.loadLabel}</span>
                        </div>
                        <div className="mt-0.5 text-sm text-zinc-300">{ex.cue}</div>
                        {slot.altId && (
                          <button
                            type="button"
                            onClick={() =>
                              update((d) => {
                                const x = d[b].slots[s]
                                const alt = x.altId!
                                x.altId = x.exerciseId
                                x.exerciseId = alt
                              })
                            }
                            className="mt-1.5 rounded-lg bg-sky-400/20 px-3 py-1.5 text-sm font-semibold text-sky-200 active:bg-sky-400/30"
                          >
                            换成{getExercise(slot.altId).name}
                            {slot.altId === 'inverted_row' ? '（有矮杠）' : ''}
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label={`改${ex.name}`}
                        onClick={() => setEditing({ b, s })}
                        className="h-11 w-11 shrink-0 rounded-xl bg-zinc-700 text-lg text-zinc-200 active:bg-zinc-600"
                      >
                        ✎
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => setPicking({ mode: 'add', b })}
              className="mt-3 h-10 w-full rounded-xl border border-dashed border-zinc-600 text-[15px] text-zinc-300 active:bg-zinc-700"
            >
              ＋ 加动作
            </button>
          </div>
        ))}
      </div>

      {changed && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-zinc-800 px-4 py-2.5">
          <span className="text-[15px] text-zinc-200">改动只影响这一次，训练卡不变</span>
          <button type="button" onClick={() => setDraft(cloneBlocks(tpl.blocks))} className="h-9 px-2 text-[15px] font-semibold text-lime-300">
            还原
          </button>
        </div>
      )}

      {/* 底部按钮 */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-700 bg-zinc-900/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          {active && <div className="mb-2 text-center text-[13px] text-amber-200">上一次训练还没结束，开始新的会把它结束</div>}
          {error && <div className="mb-2 text-center text-[15px] text-red-300">{error}</div>}
          <Button variant="primary" onClick={() => void start()} disabled={starting || empty || recentLogs === undefined} className="h-14 w-full text-xl">
            开始热身
          </Button>
        </div>
      </div>

      {/* 改某个动作 */}
      <Sheet open={!!editingSlot} onClose={() => setEditing(null)} title={editingSlot ? getExercise(editingSlot.exerciseId).name : ''}>
        {editing && editingSlot && (
          <div className="space-y-2">
            <SheetItem
              onClick={() => {
                setPicking({ mode: 'replace', b: editing.b, s: editing.s })
                setEditing(null)
              }}
            >
              换成别的动作
            </SheetItem>
            <div className="rounded-xl px-3 py-2">
              <div className="mb-2 text-[17px] font-semibold">组数</div>
              <Stepper
                size="md"
                label="组数"
                value={editingSlot.sets}
                step={1}
                min={1}
                max={10}
                unit="组"
                onChange={(v) => update((d) => void (d[editing.b].slots[editing.s].sets = v))}
              />
            </div>
            <SheetItem
              tone="danger"
              onClick={() => {
                update((d) => void d[editing.b].slots.splice(editing.s, 1))
                setEditing(null)
              }}
            >
              删掉这个动作
            </SheetItem>
          </div>
        )}
      </Sheet>

      <ExercisePicker
        open={!!picking}
        onClose={() => setPicking(null)}
        title={picking?.mode === 'add' ? `加到 ${CIRCLED[picking.b]}` : '换成哪个动作？'}
        preferGroup={picking?.mode === 'replace' ? getExercise(draft[picking.b]?.slots[picking.s]?.exerciseId ?? '').group : undefined}
        excludeId={picking?.mode === 'replace' ? draft[picking.b]?.slots[picking.s]?.exerciseId : undefined}
        onPick={(id) => {
          const p = picking
          if (!p) return
          update((d) => {
            if (p.mode === 'replace') {
              const x = d[p.b].slots[p.s]
              x.exerciseId = id
              if (x.altId === id) x.altId = undefined
            } else {
              const sets = Math.max(...d[p.b].slots.map((x) => x.sets), 3)
              d[p.b].slots.push({ exerciseId: id, sets })
            }
          })
        }}
      />
    </div>
  )
}

function restNote(block: Block): string {
  if (block.finisher) return `组间 ${REST.finisher}s`
  if (block.slots.length < 2) return ''
  const gs = block.slots.map((s) => getExercise(s.exerciseId).group)
  const legsCore = gs.includes('legs') && gs.includes('core')
  if (legsCore) return `腿→核心 ${restDefault(restBetween('legs', 'core'))}s · 核心→腿 ${restDefault(restBetween('core', 'legs'))}s`
  return `动作之间 ${restDefault(REST.pair)}s`
}
