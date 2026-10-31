import { useState } from 'react'
import { GROUP_NAME, GROUP_ORDER, type Exercise, type Group, type LoadUnit, type Sided } from '../data/types'
import { createExercise, updateExercise } from '../lib/library'
import { Stepper } from './Stepper'
import { Button } from './ui'

const LOAD_OPTIONS: { label: string; unit: LoadUnit }[] = [
  { label: '背包', unit: 'kg' },
  { label: '米袋', unit: 'kg' },
  { label: '水桶', unit: 'kg' },
  { label: '自重', unit: 'none' },
  { label: '脚垫高度', unit: 'cm' },
]

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

// 新建动作（不给 initial）或者编辑已有动作（给 initial）
export function ExerciseForm({
  initial,
  defaultGroup = 'push',
  onSaved,
  onCancel,
}: {
  initial?: Exercise
  defaultGroup?: Group
  onSaved: (id: string) => void
  onCancel: () => void
}) {
  const editing = !!initial
  const initLoadIdx = (() => {
    if (!initial) return 0
    const exact = LOAD_OPTIONS.findIndex((o) => o.label === initial.loadLabel && o.unit === initial.unit)
    return exact >= 0 ? exact : Math.max(0, LOAD_OPTIONS.findIndex((o) => o.unit === initial.unit))
  })()
  const [name, setName] = useState(initial?.name ?? '')
  const [area, setArea] = useState(initial?.area ?? '')
  const [group, setGroup] = useState<Group>(initial?.group ?? defaultGroup)
  const [sided, setSided] = useState<Sided>(initial?.sided ?? 'no')
  const [loadIdx, setLoadIdx] = useState(initLoadIdx)
  const [failure, setFailure] = useState(initial ? initial.repMin === null : false)
  const [repMin, setRepMin] = useState(initial?.repMin ?? 8)
  const [repMax, setRepMax] = useState(initial?.repMax ?? 12)
  const [cue, setCue] = useState(initial?.cue ?? '')
  const [addLoad, setAddLoad] = useState(initial?.addLoad ?? 1)
  const [tip, setTip] = useState(initial?.progressTip ?? '')
  const [saving, setSaving] = useState(false)

  const load = LOAD_OPTIONS[loadIdx]
  const valid = name.trim().length > 0 && (failure || repMin <= repMax)

  const save = async () => {
    if (!valid) return
    setSaving(true)
    const addText = initial?.addLoad === addLoad && initial.addLoadText ? initial.addLoadText : `+${addLoad}kg`
    const fields: Omit<Exercise, 'id' | 'custom'> = {
      ...(initial ?? {}),
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
      addLoad: load.unit === 'kg' ? addLoad : undefined,
      addLoadText: load.unit === 'kg' ? addText : undefined,
      progressTip: load.unit !== 'kg' && tip.trim() ? tip.trim() : undefined,
    }
    if (initial) {
      await updateExercise(initial.id, fields)
      onSaved(initial.id)
    } else {
      onSaved(await createExercise(fields))
    }
  }

  return (
    <div className="space-y-4">
      <Field label="名字">
        <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="比如：靠墙静蹲" autoFocus={!editing} />
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
      {load.unit === 'kg' ? (
        <Field label="每次加多少" hint="所有组都到上限后，下次预填加这么多">
          <Stepper size="md" label="加重" value={addLoad} onChange={setAddLoad} step={0.5} min={0.5} max={10} unit="kg" />
        </Field>
      ) : (
        <Field label="进阶方法" hint="到顶后提示怎么加难，可不填">
          <input className={INPUT} value={tip} onChange={(e) => setTip(e.target.value)} placeholder="比如：下放改 4 秒" />
        </Field>
      )}
      <Field label="要点" hint="训练时显示的一行，可不填">
        <input className={INPUT} value={cue} onChange={(e) => setCue(e.target.value)} placeholder="比如：背贴墙，大腿和地面平行" />
      </Field>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button variant="primary" disabled={!valid || saving} onClick={() => void save()}>
          {editing ? '保存' : '保存并选用'}
        </Button>
      </div>
      {!editing && <p className="px-1 text-[13px] text-zinc-400">新动作会存进动作库，以后都能选。</p>}
      {editing && <p className="px-1 text-[13px] text-zinc-400">改动只影响以后的训练，以前的记录不变。</p>}
    </div>
  )
}

// 兼容旧名字
export const NewExerciseForm = ExerciseForm
