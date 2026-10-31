import { repText } from '../data/exercises'
import { GROUP_NAME, GROUP_ORDER, type Group } from '../data/types'
import { useLibrary } from '../lib/library'
import { Sheet } from './Sheet'

// 从动作库里挑一个动作。preferGroup 那组排最前面
export function ExercisePicker({
  open,
  onClose,
  onPick,
  title = '选一个动作',
  preferGroup,
  excludeId,
}: {
  open: boolean
  onClose: () => void
  onPick: (id: string) => void
  title?: string
  preferGroup?: Group
  excludeId?: string
}) {
  const { exercises } = useLibrary()
  const list = exercises.filter((e) => !e.archived && e.id !== excludeId)
  const order = preferGroup ? [preferGroup, ...GROUP_ORDER.filter((g) => g !== preferGroup)] : GROUP_ORDER

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {order.map((g) => {
        const items = list.filter((e) => e.group === g)
        if (!items.length) return null
        return (
          <div key={g} className="mb-3">
            <div className="mb-1 px-1 text-[13px] font-semibold text-zinc-400">
              {GROUP_NAME[g]}
              {g === preferGroup ? ' · 同部位' : ''}
            </div>
            {items.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  onPick(e.id)
                  onClose()
                }}
                className="flex min-h-13 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left active:bg-zinc-700"
              >
                <span className="text-[17px] font-semibold text-zinc-50">{e.name}</span>
                <span className="shrink-0 text-[13px] text-zinc-400">
                  {e.area} · {repText(e)}
                  {e.sided === 'LR' ? '/边' : ''}
                </span>
              </button>
            ))}
          </div>
        )
      })}
    </Sheet>
  )
}
