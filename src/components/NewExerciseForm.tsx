import { useState } from 'react'
import { GROUP_NAME, GROUP_ORDER, type Exercise, type Group, type Sided } from '../data/types'
import { createExercise } from '../lib/library'
import { Stepper } from './Stepper'
import { Button } from './ui'

const LOAD_OPTIONS = [
  { label: '背包', unit: 'kg' },
  { label: '米袋', unit: 'kg' },
  { label: '水桶', unit: 'kg' },
  { label: '自重', unit: 'none' },
  { label: '脚垫高度', unit: 'cm' },
] as const

const SIDED_OPTIONS: { v: Sided; label: string; sub: string }[] = [
  { v: 'no', label: '双边', sub: '两边一起' },
  { v: 'LR', label: '单边', sub: '左右分开记' },
  { v: 'alt', label: '交替', sub: '一边算 1 次' },
]

function Seg<T>({ options, value, onChange, cols }: { options: { v: T; label: string; sub?: string }[]; value: T; onChange: (v: T) => void; cols: number }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(o.v)}
          className={`flex min-h-12 flex-col items-center justify-center rounded-xl px-1 py-1.5 ${
            value === o.v ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-700 text-zinc-100 active:bg-zinc-600'
          }`}
        >
          <span className="text-[15px] font-semibold">{o.label}</span>
          {o.sub && <span className={`text-[13px] ${value === o.v ? 'text-zinc-800' : 'text-zinc-400'}`}>{o.sub}</span>}
        </button>
      ))}
    </div>
  )
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between px-1">
        <span className="text-[15px] font-semibold text-zinc-200">{label}</span>
        {hint && <span className="text-[13px] text-zinc-400">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

const INPUT = 'h-12 w-full rounded-xl bg-zinc-700 px-3 text-[17px] text-white placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-lime-400'

// 新建一个动作库里没有的动作
export function NewExerciseForm({
  defaultGroup = 'push',
  onCreated,
  onCancel,
}: {
  defaultGroup?: Group
  onCreated: (id: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [area, setArea] = useState('')
  const [group, setGroup] = useState<Group>(defaultGroup)
  const [sided, setSided] = useState<Sided>('no')
  const [loadIdx, setLoadIdx] = useState(0)
  const [failure, setFailure] = useState(false)
  const [repMin, setRepMin] = useState(8)
  const [repMax, setRepMax] = useState(12)
  const [cue, setCue] = useState('')
  const [saving, setSaving] = useState(false)

  const load = LOAD_OPTIONS[loadIdx]
  const valid = name.trim().length > 0 && (failure || repMin <= repMax)

  const save = async () => {
    if (!valid) return
    setSaving(true)
    const fields: Omit<Exercise, 'id' | 'custom'> = {
      name: name.trim(),
      area: area.trim() || GROUP_NAME[group],
      group,
      sided,
      unit: load.unit,
      step: load.unit === 'kg' ? 0.5 : load.unit === 'cm' ? 5 : 0,
      loadLabel: load.label,
      repMin: failure ? null : repMin,
      repMax: failure ? null : repMax,
      cue: cue.trim(),
      ...(load.unit === 'kg' ? { addLoad: 1, addLoadText: '+1–2kg' } : {}),
    }
    const id = await createExercise(fields)
    onCreated(id)
  }

  return (
    <div className="space-y-4">
      <Field label="名字">
        <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="比如：靠墙静蹲" autoFocus />
      </Field>
      <Field label="练哪类" hint="用来判断 48 小时">
        <Seg cols={4} value={group} onChange={setGroup} options={GROUP_ORDER.map((g) => ({ v: g, label: GROUP_NAME[g] }))} />
      </Field>
      <Field label="部位" hint="可不填">
        <input className={INPUT} value={area} onChange={(e) => setArea(e.target.value)} placeholder="比如：大腿前侧" />
      </Field>
      <Field label="单边 / 双边">
        <Seg cols={3} value={sided} onChange={setSided} options={SIDED_OPTIONS} />
      </Field>
      <Field label="负重方式">
        <Seg cols={5} value={loadIdx} onChange={setLoadIdx} options={LOAD_OPTIONS.map((o, i) => ({ v: i, label: o.label }))} />
      </Field>
      <Field label="次数">
        <div className="mb-2">
          <Seg
            cols={2}
            value={failure}
            onChange={setFailure}
            options={[
              { v: false, label: '固定范围' },
              { v: true, label: '力竭（不设上限）' },
            ]}
          />
        </div>
        {!failure && (
          <div className="space-y-2">
            <Stepper size="md" label="最少" value={repMin} onChange={setRepMin} step={1} min={1} max={100} unit="次起" />
            <Stepper size="md" label="最多" value={repMax} onChange={setRepMax} step={1} min={1} max={100} unit="次到" />
            {repMin > repMax && <div className="px-1 text-[13px] text-red-300">最少不能大于最多</div>}
          </div>
        )}
      </Field>
      <Field label="要点" hint="训练时显示的一行，可不填">
        <input className={INPUT} value={cue} onChange={(e) => setCue(e.target.value)} placeholder="比如：背贴墙，大腿和地面平行" />
      </Field>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button variant="primary" disabled={!valid || saving} onClick={() => void save()}>
          保存并选用
        </Button>
      </div>
      <p className="px-1 text-[13px] text-zinc-400">新动作会存进动作库，以后都能选。</p>
    </div>
  )
}
