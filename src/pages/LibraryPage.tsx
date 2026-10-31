import { useState } from 'react'
import { ExerciseVisual } from '../components/ExerciseVisual'
import { ExerciseForm } from '../components/NewExerciseForm'
import { Button, Card, SectionTitle } from '../components/ui'
import { repText } from '../data/exercises'
import { GROUP_NAME, GROUP_ORDER, type Exercise } from '../data/types'
import { setArchived, useLibrary } from '../lib/library'
import { navigate } from '../lib/router'

function Back({ to, label = '‹ 返回' }: { to: string; label?: string }) {
  return (
    <button type="button" onClick={() => navigate(to)} className="-ml-2 h-11 rounded-lg px-2 text-[17px] text-zinc-300 active:bg-zinc-800">
      {label}
    </button>
  )
}

function meta(e: Exercise) {
  return `${e.area} · ${repText(e)}${e.sided === 'LR' ? '/边' : ''} · ${e.loadLabel}`
}

// 设置 → 动作库
export function LibraryPage({ id }: { id?: string }) {
  if (id === 'new') return <ExerciseEdit />
  if (id) return <ExerciseEdit id={id} />
  return <LibraryList />
}

function LibraryList() {
  const { exercises } = useLibrary()
  const [showHidden, setShowHidden] = useState(false)
  const visible = exercises.filter((e) => !e.archived)
  const hidden = exercises.filter((e) => e.archived)

  return (
    <div className="pb-10">
      <Back to="settings" label="‹ 设置" />
      <h1 className="mt-1 text-[27px] font-bold">动作库</h1>
      <p className="mt-1 text-[15px] text-zinc-300">点一个动作可以改；改动只影响以后的训练</p>
      <Button variant="primary" className="mt-4 w-full" onClick={() => navigate('library/new')}>
        ＋ 新建动作
      </Button>

      {GROUP_ORDER.map((g) => {
        const items = visible.filter((e) => e.group === g)
        if (!items.length) return null
        return (
          <div key={g}>
            <SectionTitle hint={`${items.length} 个`}>{GROUP_NAME[g]}</SectionTitle>
            <div className="space-y-2">
              {items.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => navigate(`library/${e.id}`)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-zinc-700/60 bg-zinc-800/70 p-2 pr-3 text-left active:bg-zinc-700"
                >
                  <div className="pointer-events-none h-14 w-20 shrink-0">
                    <ExerciseVisual exerciseId={e.id} className="h-14 w-20" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[17px] font-semibold">
                      {e.name}
                      {e.custom && <span className="ml-1.5 text-[13px] font-normal text-lime-300">自建</span>}
                    </div>
                    <div className="truncate text-[13px] text-zinc-400">{meta(e)}</div>
                  </div>
                  <span className="text-2xl text-zinc-400">›</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {hidden.length > 0 && (
        <>
          <button type="button" onClick={() => setShowHidden(!showHidden)} className="mt-6 h-11 px-1 text-[15px] font-semibold text-zinc-300">
            已隐藏 {hidden.length} 个 {showHidden ? '▲' : '▼'}
          </button>
          {showHidden && (
            <Card className="space-y-1 py-2">
              {hidden.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 py-1">
                  <div className="min-w-0">
                    <div className="text-[17px] text-zinc-200">{e.name}</div>
                    <div className="truncate text-[13px] text-zinc-400">{meta(e)}</div>
                  </div>
                  <Button className="shrink-0" onClick={() => void setArchived(e.id, false)}>
                    恢复显示
                  </Button>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function ExerciseEdit({ id }: { id?: string }) {
  const { exercises } = useLibrary()
  const ex = id ? exercises.find((e) => e.id === id) : undefined
  const [confirmHide, setConfirmHide] = useState(false)

  if (id && !ex) {
    return (
      <div>
        <Back to="library" />
        <p className="mt-6 text-[17px] text-zinc-300">找不到这个动作。</p>
      </div>
    )
  }

  return (
    <div className="pb-10">
      <Back to="library" label="‹ 动作库" />
      <h1 className="mt-1 text-[27px] font-bold">{ex ? `改：${ex.name}` : '新建动作'}</h1>
      {ex && (
        <div className="mt-3">
          <ExerciseVisual exerciseId={ex.id} editable className="h-44 w-full" />
          <p className="mt-1 px-1 text-[13px] text-zinc-400">点图可以换成自己的图片 / 动图 / 视频</p>
        </div>
      )}
      <div className="mt-4">
        <ExerciseForm key={ex?.id ?? 'new'} initial={ex} onSaved={() => navigate('library')} onCancel={() => navigate('library')} />
      </div>
      {ex && (
        <div className="mt-6 rounded-2xl border border-zinc-700/60 bg-zinc-800/70 p-4">
          <div className="text-[17px] font-semibold">{ex.archived ? '这个动作已隐藏' : '不用这个动作了？'}</div>
          <div className="mt-0.5 text-[13px] text-zinc-400">隐藏后选动作时不再出现，历史记录保留，随时能恢复</div>
          <div className="mt-3">
            {ex.archived ? (
              <Button className="w-full" onClick={() => void setArchived(ex.id, false)}>
                恢复显示
              </Button>
            ) : confirmHide ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" onClick={() => setConfirmHide(false)}>
                  取消
                </Button>
                <Button variant="danger" onClick={() => void setArchived(ex.id, true).then(() => navigate('library'))}>
                  确认隐藏
                </Button>
              </div>
            ) : (
              <Button variant="danger" className="w-full" onClick={() => setConfirmHide(true)}>
                隐藏这个动作
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
