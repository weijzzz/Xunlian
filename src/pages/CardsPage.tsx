import { useState } from 'react'
import { BlocksEditor } from '../components/BlocksEditor'
import { Button, Chip } from '../components/ui'
import { cloneBlocks } from '../data/templates'
import { GROUP_NAME, type Block, type Location, type Template } from '../data/types'
import { blocksGroups, createTemplate, deleteTemplate, moveTemplate, saveTemplate, useLibrary } from '../lib/library'
import { estimateMinutes } from '../lib/plan'
import { navigate } from '../lib/router'

function Back({ to, label }: { to: string; label: string }) {
  return (
    <button type="button" onClick={() => navigate(to)} className="-ml-2 h-11 rounded-lg px-2 text-[17px] text-zinc-300 active:bg-zinc-800">
      {label}
    </button>
  )
}

// 设置 → 训练卡
export function CardsPage({ id }: { id?: string }) {
  const { templates } = useLibrary()
  if (id) {
    const tpl = templates.find((t) => t.id === id)
    if (!tpl) {
      return (
        <div>
          <Back to="cards" label="‹ 训练卡" />
          <p className="mt-6 text-[17px] text-zinc-300">找不到这张训练卡。</p>
        </div>
      )
    }
    return <CardEdit key={tpl.id} tpl={tpl} />
  }
  return <CardList templates={templates} />
}

const SMALL = 'h-10 w-10 rounded-lg bg-zinc-700 text-[17px] text-zinc-100 active:bg-zinc-600 disabled:opacity-30'

function CardList({ templates }: { templates: Template[] }) {
  return (
    <div className="pb-10">
      <Back to="settings" label="‹ 设置" />
      <h1 className="mt-1 text-[27px] font-bold">训练卡</h1>
      <p className="mt-1 text-[15px] text-zinc-300">在这里改的会一直生效；以前的训练记录不受影响</p>
      <Button
        variant="primary"
        className="mt-4 w-full"
        onClick={() => void createTemplate().then((id) => navigate(`cards/${id}`))}
      >
        ＋ 新建训练卡
      </Button>
      <div className="mt-4 space-y-2">
        {templates.map((t, i) => (
          <div key={t.id} className="flex items-center gap-2 rounded-2xl border border-zinc-700/60 bg-zinc-800/70 p-3">
            <button type="button" onClick={() => navigate(`cards/${t.id}`)} className="min-w-0 flex-1 text-left">
              <div className="text-lg font-bold">{t.name}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Chip tone={t.location === 'home' ? 'zinc' : 'sky'}>{t.location === 'home' ? '家' : '外面'}</Chip>
                {blocksGroups(t.blocks).map((g) => (
                  <Chip key={g}>{GROUP_NAME[g]}</Chip>
                ))}
                <span className="text-[13px] text-zinc-400">{t.blocks.length ? `约 ${estimateMinutes(t.blocks, false)} 分` : '还没有动作'}</span>
              </div>
            </button>
            <div className="flex flex-col gap-1.5">
              <button type="button" aria-label={`${t.name}上移`} disabled={i === 0} className={SMALL} onClick={() => void moveTemplate(t.id, -1)}>
                ↑
              </button>
              <button
                type="button"
                aria-label={`${t.name}下移`}
                disabled={i === templates.length - 1}
                className={SMALL}
                onClick={() => void moveTemplate(t.id, 1)}
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const INPUT = 'h-12 w-full rounded-xl bg-zinc-700 px-3 text-[17px] text-white placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-lime-400'

function CardEdit({ tpl }: { tpl: Template }) {
  const [name, setName] = useState(tpl.name)
  const [short, setShort] = useState(tpl.short)
  const [location, setLocation] = useState<Location>(tpl.location)
  const [blocks, setBlocks] = useState<Block[]>(() => cloneBlocks(tpl.blocks))
  const [confirmDel, setConfirmDel] = useState(false)
  const dirty =
    name !== tpl.name || short !== tpl.short || location !== tpl.location || JSON.stringify(blocks) !== JSON.stringify(tpl.blocks)
  const valid = name.trim().length > 0

  const save = async () => {
    await saveTemplate({ ...tpl, name: name.trim(), short: short.trim() || name.trim().slice(0, 1), location, blocks: cloneBlocks(blocks) })
    navigate('cards')
  }

  return (
    <div className="pb-28">
      <Back to="cards" label={dirty ? '‹ 不保存，返回' : '‹ 训练卡'} />
      <h1 className="mt-1 text-[27px] font-bold">改：{tpl.name}</h1>

      <div className="mt-4 grid grid-cols-[1fr_88px] gap-2">
        <div>
          <div className="mb-1.5 px-1 text-[15px] font-semibold text-zinc-200">卡名</div>
          <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="比如：上肢C" />
        </div>
        <div>
          <div className="mb-1.5 px-1 text-[15px] font-semibold text-zinc-200">格子里</div>
          <input className={`${INPUT} text-center`} value={short} maxLength={2} onChange={(e) => setShort(e.target.value)} placeholder="C" />
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 px-1 text-[15px] font-semibold text-zinc-200">在哪练</div>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['home', '家'],
              ['out', '外面（有单杠）'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setLocation(v)}
              className={`h-12 rounded-xl text-[15px] font-semibold ${location === v ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-700 text-zinc-100 active:bg-zinc-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-2.5 mt-6 px-1 text-[15px] font-bold text-zinc-200">
        动作 <span className="font-normal text-zinc-400">· 同一组里的动作轮流做 · 「收尾」组间 45 秒、精简模式跳过</span>
      </div>
      <BlocksEditor blocks={blocks} onChange={setBlocks} template />

      <div className="mt-8 rounded-2xl border border-zinc-700/60 bg-zinc-800/70 p-4">
        <div className="text-[17px] font-semibold">删除这张训练卡</div>
        <div className="mt-0.5 text-[13px] text-zinc-400">排法里用到它的那几天会变成休息；以前的训练记录不受影响</div>
        <div className="mt-3">
          {confirmDel ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setConfirmDel(false)}>
                取消
              </Button>
              <Button variant="danger" onClick={() => void deleteTemplate(tpl.id).then(() => navigate('cards'))}>
                确认删除
              </Button>
            </div>
          ) : (
            <Button variant="danger" className="w-full" onClick={() => setConfirmDel(true)}>
              删除
            </Button>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-700 bg-zinc-900/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          <Button variant="primary" disabled={!dirty || !valid} onClick={() => void save()} className="h-14 w-full text-xl">
            {dirty ? '保存' : '没有改动'}
          </Button>
        </div>
      </div>
    </div>
  )
}
