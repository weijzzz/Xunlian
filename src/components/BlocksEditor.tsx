import { useState } from 'react'
import { repText } from '../data/exercises'
import { CIRCLED, cloneBlocks, REST, restBetween, restDefault } from '../data/templates'
import type { Block } from '../data/types'
import { getExercise } from '../lib/library'
import { ExercisePicker } from './ExercisePicker'
import { Sheet, SheetItem } from './Sheet'
import { Stepper } from './Stepper'

type Picking = { mode: 'replace'; b: number; s: number } | { mode: 'add'; b: number } | { mode: 'newBlock' }

function restNote(block: Block): string {
  if (block.finisher) return `组间 ${REST.finisher}s`
  if (block.slots.length < 2) return ''
  const gs = block.slots.map((s) => getExercise(s.exerciseId).group)
  if (gs.includes('legs') && gs.includes('core')) {
    return `腿→核心 ${restDefault(restBetween('legs', 'core'))}s · 核心→腿 ${restDefault(restBetween('core', 'legs'))}s`
  }
  return `动作之间 ${restDefault(REST.pair)}s`
}

function move<T>(arr: T[], i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= arr.length) return
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}

const SMALL_BTN = 'h-9 min-w-9 rounded-lg bg-zinc-700 px-2 text-[15px] text-zinc-100 active:bg-zinc-600 disabled:opacity-30'

// 改一张训练卡里的动作。开始页（只这一次）和设置里的训练卡编辑（以后都这样）共用
export function BlocksEditor({
  blocks,
  onChange,
  shortCaps,
  template = false,
}: {
  blocks: Block[]
  onChange: (b: Block[]) => void
  shortCaps?: number[] | null // 开始页精简模式：每块实际做几组（null = 完整）
  template?: boolean // 训练卡编辑：多了调顺序、设收尾、删整块
}) {
  const [editing, setEditing] = useState<{ b: number; s: number } | null>(null)
  const [picking, setPicking] = useState<Picking | null>(null)

  const update = (fn: (d: Block[]) => void) => {
    const next = cloneBlocks(blocks)
    fn(next)
    onChange(next.filter((b) => b.slots.length > 0))
  }

  const editingSlot = editing ? blocks[editing.b]?.slots[editing.s] : undefined
  const short = !!shortCaps

  return (
    <>
      <div className="space-y-3">
        {blocks.map((block, b) => (
          <div key={b} className={`rounded-2xl border border-zinc-700/60 bg-zinc-800/70 p-4 ${short && block.finisher ? 'opacity-40' : ''}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-lg font-bold text-zinc-200">
                {CIRCLED[b]} {block.finisher ? '收尾' : block.slots.length > 1 ? '轮流做' : ''}
              </span>
              {template ? (
                <div className="flex gap-1.5">
                  <button type="button" aria-label="这一块上移" disabled={b === 0} className={SMALL_BTN} onClick={() => update((d) => move(d, b, -1))}>
                    ↑
                  </button>
                  <button type="button" aria-label="这一块下移" disabled={b === blocks.length - 1} className={SMALL_BTN} onClick={() => update((d) => move(d, b, 1))}>
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => update((d) => void (d[b].finisher = !d[b].finisher))}
                    className={`${SMALL_BTN} ${block.finisher ? 'bg-lime-400 text-zinc-950 active:bg-lime-300' : ''}`}
                  >
                    收尾
                  </button>
                </div>
              ) : (
                <span className="text-[13px] text-zinc-400">{restNote(block)}</span>
              )}
            </div>
            <div className="space-y-1">
              {block.slots.map((slot, s) => {
                const ex = getExercise(slot.exerciseId)
                const sets = shortCaps ? Math.min(slot.sets, shortCaps[b] ?? slot.sets) : slot.sets
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
                        {ex.cue && <div className="mt-0.5 text-sm text-zinc-300">{ex.cue}</div>}
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
        {template && (
          <button
            type="button"
            onClick={() => setPicking({ mode: 'newBlock' })}
            className="h-13 w-full rounded-2xl border border-dashed border-lime-400/60 text-[17px] font-semibold text-lime-300 active:bg-zinc-800"
          >
            ＋ 新的一组（{CIRCLED[blocks.length] ?? ''}）
          </button>
        )}
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
            {template && blocks[editing.b].slots.length > 1 && (
              <div className="grid grid-cols-2 gap-2 px-1">
                <button
                  type="button"
                  disabled={editing.s === 0}
                  className="h-12 rounded-xl bg-zinc-700 text-[15px] font-semibold disabled:opacity-30"
                  onClick={() => {
                    update((d) => move(d[editing.b].slots, editing.s, -1))
                    setEditing({ b: editing.b, s: editing.s - 1 })
                  }}
                >
                  往前（先做）
                </button>
                <button
                  type="button"
                  disabled={editing.s === blocks[editing.b].slots.length - 1}
                  className="h-12 rounded-xl bg-zinc-700 text-[15px] font-semibold disabled:opacity-30"
                  onClick={() => {
                    update((d) => move(d[editing.b].slots, editing.s, 1))
                    setEditing({ b: editing.b, s: editing.s + 1 })
                  }}
                >
                  往后（后做）
                </button>
              </div>
            )}
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
        title={picking?.mode === 'add' ? `加到 ${CIRCLED[picking.b]}` : picking?.mode === 'newBlock' ? '新的一组先放哪个动作？' : '换成哪个动作？'}
        preferGroup={picking?.mode === 'replace' ? getExercise(blocks[picking.b]?.slots[picking.s]?.exerciseId ?? '').group : undefined}
        excludeId={picking?.mode === 'replace' ? blocks[picking.b]?.slots[picking.s]?.exerciseId : undefined}
        onPick={(id) => {
          const p = picking
          if (!p) return
          update((d) => {
            if (p.mode === 'replace') {
              const x = d[p.b].slots[p.s]
              x.exerciseId = id
              if (x.altId === id) x.altId = undefined
            } else if (p.mode === 'add') {
              const sets = Math.max(...d[p.b].slots.map((x) => x.sets), 3)
              d[p.b].slots.push({ exerciseId: id, sets })
            } else {
              // 新的一组插在收尾前面
              const fin = d.findIndex((x) => x.finisher)
              const blk: Block = { slots: [{ exerciseId: id, sets: 3 }] }
              if (fin >= 0) d.splice(fin, 0, blk)
              else d.push(blk)
            }
          })
        }}
      />
    </>
  )
}
