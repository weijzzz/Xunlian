import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/ui'
import { restOverAlert, tick, unlockAudio } from '../lib/alert'
import { ymd } from '../lib/dates'
import { setDaily, useDaily } from '../lib/daily'
import { navigate } from '../lib/router'
import { setSetting, useSettings } from '../lib/settings'
import { useWakeLock } from '../lib/wakeLock'

// 吸腹计时：3 组 ×（准备 3 秒 → 保持 N 秒 → 休息 20 秒），最后一组不休息
const SETS = 3
const PREP = 3
const REST = 20
const HOLDS = [20, 30, 40]

type Phase = 'prep' | 'hold' | 'rest'
interface Run {
  set: number // 1..3
  phase: Phase
  endsAt: number // 正在跑时这一段结束的时间
  paused: number | null // 暂停时剩下的毫秒
}

const PHASE_TEXT: Record<Phase, { title: string; tip: string; color: string }> = {
  prep: { title: '准备', tip: '先把肺里的气全部呼出去', color: 'text-sky-300' },
  hold: { title: '收！保持', tip: '肚脐用力往脊柱方向收，可以浅浅地呼吸', color: 'text-lime-300' },
  rest: { title: '休息', tip: '放松，正常呼吸几次', color: 'text-zinc-200' },
}

export function VacuumPage() {
  const { vacuumHold } = useSettings()
  const [today] = useState(() => new Date())
  const daily = useDaily(today)
  const [run, setRun] = useState<Run | null>(null)
  const [done, setDone] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const lastTick = useRef<number | null>(null)
  useWakeLock(run !== null)

  const durOf = (p: Phase) => (p === 'prep' ? PREP : p === 'hold' ? vacuumHold : REST)

  useEffect(() => {
    if (!run || run.paused !== null) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [run])

  // 到点 → 下一段
  useEffect(() => {
    if (!run || run.paused !== null) return
    const remain = run.endsAt - now
    const sec = Math.ceil(remain / 1000)
    if (remain > 0) {
      if (run.phase !== 'prep' && sec <= 3 && sec !== lastTick.current) {
        lastTick.current = sec
        tick()
      }
      return
    }
    lastTick.current = null
    restOverAlert()
    const t = Date.now()
    if (run.phase === 'prep') setRun({ ...run, phase: 'hold', endsAt: t + vacuumHold * 1000 })
    else if (run.phase === 'hold') {
      if (run.set >= SETS) {
        setRun(null)
        setDone(true)
        void setDaily(ymd(today), 'vacuum', true)
      } else setRun({ ...run, phase: 'rest', endsAt: t + REST * 1000 })
    } else setRun({ set: run.set + 1, phase: 'prep', endsAt: t + PREP * 1000, paused: null })
  }, [now, run, vacuumHold, today])

  const start = () => {
    unlockAudio()
    setDone(false)
    lastTick.current = null
    setRun({ set: 1, phase: 'prep', endsAt: Date.now() + PREP * 1000, paused: null })
    setNow(Date.now())
  }
  const togglePause = () => {
    if (!run) return
    if (run.paused === null) setRun({ ...run, paused: run.endsAt - Date.now() })
    else {
      setRun({ ...run, endsAt: Date.now() + run.paused, paused: null })
      setNow(Date.now())
    }
  }
  const skip = () => {
    if (!run) return
    setRun({ ...run, endsAt: Date.now(), paused: null })
    setNow(Date.now())
  }

  const remainMs = run ? (run.paused ?? run.endsAt - now) : 0
  const total = run ? durOf(run.phase) * 1000 : 1
  const pct = run ? Math.max(0, Math.min(1, remainMs / total)) : 1
  const R = 110
  const C = 2 * Math.PI * R

  return (
    <div className="flex min-h-[calc(100dvh-2rem)] flex-col">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navigate('today')} className="-ml-2 h-11 rounded-lg px-2 text-[17px] text-zinc-300 active:bg-zinc-800">
          ‹ 返回
        </button>
        {daily.loaded && daily.today.vacuum && !run && <span className="text-[15px] text-lime-300">今天已打勾 ✓</span>}
      </div>
      <h1 className="mt-1 text-[27px] font-bold">吸腹</h1>
      <div className="mt-2 rounded-xl bg-amber-400/15 px-3 py-2 text-[15px] text-amber-100">感觉头晕就停 · 刚吃完饭别做</div>

      {/* 保持几秒 */}
      <div className="mt-4">
        <div className="mb-1.5 px-1 text-[15px] font-semibold text-zinc-300">每组保持</div>
        <div className="grid grid-cols-3 gap-2">
          {HOLDS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => void setSetting('vacuumHold', h)}
              className={`h-12 rounded-xl text-[17px] font-semibold ${vacuumHold === h ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-700 text-zinc-100 active:bg-zinc-600'}`}
            >
              {h} 秒
            </button>
          ))}
        </div>
      </div>

      {/* 计时圈 */}
      <div className="flex flex-1 flex-col items-center justify-center py-4">
        {run ? (
          <>
            <div className="mb-2 flex gap-2">
              {Array.from({ length: SETS }, (_, i) => (
                <span
                  key={i}
                  className={`h-2.5 w-10 rounded-full ${i + 1 < run.set || (i + 1 === run.set && run.phase === 'rest') ? 'bg-lime-400' : i + 1 === run.set ? 'bg-lime-400/50' : 'bg-zinc-700'}`}
                />
              ))}
            </div>
            <div className="text-[15px] text-zinc-300">
              第 {run.set}/{SETS} 组
            </div>
            <div className="relative mt-2 h-[250px] w-[250px]">
              <svg viewBox="0 0 250 250" className="absolute inset-0 -rotate-90">
                <circle cx="125" cy="125" r={R} fill="none" stroke="#27272a" strokeWidth="12" />
                <circle
                  cx="125"
                  cy="125"
                  r={R}
                  fill="none"
                  stroke={run.phase === 'hold' ? '#a3e635' : run.phase === 'prep' ? '#38bdf8' : '#a1a1aa'}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - pct)}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={`text-[22px] font-bold ${PHASE_TEXT[run.phase].color}`}>{PHASE_TEXT[run.phase].title}</div>
                <div className="text-[80px] font-bold leading-none tabular-nums">{Math.max(0, Math.ceil(remainMs / 1000))}</div>
                {run.paused !== null && <div className="text-[15px] text-amber-300">已暂停</div>}
              </div>
            </div>
            <p className="mt-3 max-w-[300px] text-center text-[17px] text-zinc-200">{PHASE_TEXT[run.phase].tip}</p>
          </>
        ) : done ? (
          <div className="text-center">
            <div className="text-[64px] leading-none text-lime-400">✓</div>
            <div className="mt-2 text-[22px] font-bold">做完 3 组了</div>
            <div className="mt-1 text-[15px] text-zinc-300">今天的吸腹已经打勾</div>
          </div>
        ) : (
          <div className="text-center text-[17px] leading-relaxed text-zinc-300">
            {SETS} 组 · 每组：准备 {PREP} 秒 → 保持 {vacuumHold} 秒 → 休息 {REST} 秒
            <br />
            每段结束会响一声、震一下
          </div>
        )}
      </div>

      {/* 按钮 */}
      <div className="space-y-2 pb-2">
        {run ? (
          <div className="grid grid-cols-2 gap-2">
            <Button className="h-14 text-lg" onClick={togglePause}>
              {run.paused !== null ? '继续' : '暂停'}
            </Button>
            <Button className="h-14 text-lg" onClick={skip}>
              跳过这段
            </Button>
            <Button variant="ghost" className="col-span-2 text-[15px]" onClick={() => setRun(null)}>
              结束（不打勾）
            </Button>
          </div>
        ) : done ? (
          <Button variant="primary" className="h-14 w-full text-xl" onClick={() => navigate('today')}>
            回首页
          </Button>
        ) : (
          <>
            <Button variant="primary" className="h-16 w-full text-xl" onClick={start}>
              开始
            </Button>
            {daily.loaded && (
              <Button
                variant="ghost"
                className="w-full text-[15px]"
                onClick={() => void setDaily(daily.today.date, 'vacuum', !daily.today.vacuum).then(() => !daily.today.vacuum && navigate('today'))}
              >
                {daily.today.vacuum ? '取消今天的打勾' : '不计时，直接打勾'}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
