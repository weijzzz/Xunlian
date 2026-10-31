import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { BlocksEditor } from '../components/BlocksEditor'
import { Button, Chip } from '../components/ui'
import { cloneBlocks, SHORT_ROUNDS, shortLayout } from '../data/templates'
import { GROUP_NAME, type Block, type Template } from '../data/types'
import { db } from '../lib/db'
import { blocksGroups, saveTemplate, useLibrary } from '../lib/library'
import { estimateMinutes } from '../lib/plan'
import { FATIGUE_HOURS, fatigueFor, lastTrained } from '../lib/progress'
import { navigate } from '../lib/router'
import { startSession, useActiveSession } from '../lib/session'

export function StartPage({ templateId, initialShort = false }: { templateId: string; initialShort?: boolean }) {
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
  return <StartForm key={tpl.id} tpl={tpl} initialShort={initialShort} />
}

function BackButton() {
  return (
    <button type="button" onClick={() => navigate('today')} className="-ml-2 h-11 rounded-lg px-2 text-[17px] text-zinc-300 active:bg-zinc-800">
      ‹ 返回
    </button>
  )
}

function StartForm({ tpl, initialShort }: { tpl: Template; initialShort: boolean }) {
  const [draft, setDraft] = useState<Block[]>(() => cloneBlocks(tpl.blocks))
  const [short, setShort] = useState(initialShort)
  const [starting, setStarting] = useState(false)
  const [saved, setSaved] = useState(false)
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
  const shortCaps = draft.map((b) => {
    if (b.finisher) return 0
    mainIdx++
    return SHORT_ROUNDS[mainIdx] ?? SHORT_ROUNDS[SHORT_ROUNDS.length - 1]
  })

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

      <div className="mt-4">
        <BlocksEditor
          blocks={draft}
          onChange={(b) => {
            setDraft(b)
            setSaved(false)
          }}
          shortCaps={short ? shortCaps : null}
        />
      </div>

      {changed && (
        <div className="mt-3 rounded-xl bg-zinc-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[15px] text-zinc-200">改动只影响这一次</span>
            <button type="button" onClick={() => setDraft(cloneBlocks(tpl.blocks))} className="h-9 px-2 text-[15px] font-semibold text-lime-300">
              还原
            </button>
          </div>
          <Button
            className="mt-2 w-full"
            onClick={() =>
              void saveTemplate({ ...tpl, blocks: cloneBlocks(draft) }).then(() => {
                setSaved(true)
              })
            }
          >
            存到训练卡（以后都这样）
          </Button>
        </div>
      )}
      {saved && !changed && <div className="mt-3 rounded-xl bg-lime-400/15 px-4 py-2.5 text-[15px] text-lime-200">已存到「{tpl.name}」，以后都按这个来 ✓</div>}

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
    </div>
  )
}
