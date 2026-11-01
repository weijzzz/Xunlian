import { useEffect, useRef, useState } from 'react'
import { ReminderSection } from '../components/Reminders'
import { Button, Card, Chip, Divider, Row, SectionTitle } from '../components/ui'
import { beepRestOver, canSound, canVibrate, restOverAlert, tick, unlockAudio, vibrateRestOver } from '../lib/alert'
import {
  canShareFiles,
  downloadBackup,
  parseBackup,
  restoreBackup,
  shareBackup,
  summarize,
  type ImportSummary,
} from '../lib/backup'
import { addDays, mondayOf, shortDate } from '../lib/dates'
import { BUILD_TIME, checkForUpdate } from '../lib/pwa'
import { useLibrary } from '../lib/library'
import { navigate } from '../lib/router'
import { describePlan, resetDefaultPlan, useSchedule } from '../lib/schedule'
import { setSetting, useSettings } from '../lib/settings'
import { requestPersist, useStorageInfo } from '../lib/storage'
import { useWakeLock, type WakeState } from '../lib/wakeLock'
import { PARITY_NAME, weekParity } from '../lib/week'

export function SettingsPage() {
  return (
    <div>
      <h1 className="mb-2 text-[27px] font-bold">设置</h1>
      <ReminderSection />
      <EditSection />
      <WeekSection />
      <PlanSection />
      <CreatineSection />
      <AlertSection />
      <WakeSection />
      <StorageSection />
      <BackupSection />
      <AboutSection />
    </div>
  )
}

function WeekSection() {
  const { parityFlip } = useSettings()
  const now = new Date()
  const monday = mondayOf(now)
  const parity = weekParity(now, parityFlip)
  const next = weekParity(addDays(monday, 7), parityFlip)
  return (
    <>
      <SectionTitle>单双周</SectionTitle>
      <Card>
        <Row label={`本周（${shortDate(monday)}–${shortDate(addDays(monday, 6))}）`} sub={`下周是${PARITY_NAME[next]}，之后每周自动切换`}>
          <Chip tone={parity === 'odd' ? 'sky' : 'amber'}>{PARITY_NAME[parity]}</Chip>
        </Row>
        <Divider />
        <Row label="单双周不对？" sub="放假后学校单双周错开时点一下">
          <Button onClick={() => void setSetting('parityFlip', !parityFlip)}>翻转</Button>
        </Row>
      </Card>
    </>
  )
}

function EditSection() {
  const { exercises, templates } = useLibrary()
  const items = [
    { to: 'cards', label: '训练卡', sub: `${templates.length} 张 · 改动作、组数、顺序，新建或删除` },
    { to: 'library', label: '动作库', sub: `${exercises.filter((e) => !e.archived).length} 个动作 · 改要点、次数范围、图片，新建或隐藏` },
  ]
  return (
    <>
      <SectionTitle>训练内容</SectionTitle>
      <Card className="py-1">
        {items.map((it, i) => (
          <div key={it.to}>
            {i > 0 && <Divider />}
            <button type="button" onClick={() => navigate(it.to)} className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left">
              <div className="min-w-0">
                <div className="text-[17px] text-zinc-50">{it.label}</div>
                <div className="mt-0.5 text-[13px] text-zinc-400">{it.sub}</div>
              </div>
              <span className="text-2xl text-zinc-400">›</span>
            </button>
          </div>
        ))}
      </Card>
    </>
  )
}

function PlanSection() {
  const sched = useSchedule()
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <SectionTitle hint="在首页排法里点某一天可以改">默认排法</SectionTitle>
      <Card>
        <div className="space-y-1 py-1 text-[15px] text-zinc-200">
          <div>{describePlan(sched.plan, 'odd')}</div>
          <div>{describePlan(sched.plan, 'even')}</div>
        </div>
        {sched.customPlan && (
          <>
            <Divider />
            <Row label="已经改过默认排法" sub="恢复成最初的：单周 周一上肢A·周五下肢·周日上肢B；双周 周五全身">
              {confirm ? (
                <Button
                  variant="danger"
                  onClick={() => {
                    void resetDefaultPlan()
                    setConfirm(false)
                  }}
                >
                  确认
                </Button>
              ) : (
                <Button onClick={() => setConfirm(true)}>恢复</Button>
              )}
            </Row>
          </>
        )}
      </Card>
    </>
  )
}

function CreatineSection() {
  const { creatineStart } = useSettings()
  return (
    <>
      <SectionTitle>肌酸</SectionTitle>
      <Card>
        <Row label="开始吃的日期" sub="开始后 3 周不给热量建议（肌酸会让体重涨 1-2kg 水）" />
        <input
          type="date"
          value={creatineStart ?? ''}
          onChange={(e) => void setSetting('creatineStart', e.target.value || null)}
          className="mb-1 h-12 w-full rounded-xl bg-zinc-600 px-4 text-[17px] text-white [color-scheme:dark]"
        />
        {creatineStart && (
          <div className="flex justify-end">
            <Button variant="ghost" className="min-h-10 text-[15px]" onClick={() => void setSetting('creatineStart', null)}>
              清除
            </Button>
          </div>
        )}
      </Card>
    </>
  )
}

function AlertSection() {
  const [running, setRunning] = useState(false)
  const [left, setLeft] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  const endRef = useRef(0)
  const lastRef = useRef(0)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const remain = Math.ceil((endRef.current - Date.now()) / 1000)
      if (remain <= 0) {
        clearInterval(id)
        restOverAlert()
        setRunning(false)
        setLeft(null)
        setDone(true)
        return
      }
      if (remain !== lastRef.current) {
        lastRef.current = remain
        if (remain <= 3) tick()
        setLeft(remain)
      }
    }, 100)
    return () => clearInterval(id)
  }, [running])

  const start = () => {
    unlockAudio()
    setDone(false)
    endRef.current = Date.now() + 5000
    lastRef.current = 5
    setLeft(5)
    setRunning(true)
  }

  return (
    <>
      <SectionTitle>提醒测试</SectionTitle>
      <Card>
        <Row label="提示音" sub={canSound() ? '用的是媒体音量，不是铃声音量' : '这个浏览器不支持'}>
          <Button onClick={beepRestOver} disabled={!canSound()}>
            试听
          </Button>
        </Row>
        <Divider />
        <Row label="震动" sub={canVibrate() ? undefined : '这个浏览器不支持'}>
          <Button onClick={vibrateRestOver} disabled={!canVibrate()}>
            试一下
          </Button>
        </Row>
        <Divider />
        <Row label="模拟休息结束" sub={done ? '响了、震了吗？没有就告诉我' : '倒数 5 秒，最后 3 秒滴答，结束响铃+震动'}>
          {left !== null ? (
            <span className="w-16 text-center text-3xl font-bold tabular-nums text-lime-300">{left}</span>
          ) : (
            <Button variant="primary" onClick={start}>
              开始
            </Button>
          )}
        </Row>
      </Card>
    </>
  )
}

const WAKE_TEXT: Record<WakeState, string> = {
  unsupported: '这个浏览器不支持',
  off: '未开启',
  on: '已常亮 ✓',
  error: '申请失败',
}

function WakeSection() {
  const [on, setOn] = useState(false)
  const state = useWakeLock(on)
  return (
    <>
      <SectionTitle>屏幕常亮</SectionTitle>
      <Card>
        <Row label={`状态：${WAKE_TEXT[state]}`} sub="打开后放着别动，超过你的自动锁屏时间看会不会熄屏">
          <Button variant={on ? 'primary' : 'secondary'} onClick={() => setOn(!on)} disabled={state === 'unsupported'}>
            {on ? '关闭' : '测试'}
          </Button>
        </Row>
      </Card>
    </>
  )
}

function StorageSection() {
  const { info, refresh } = useStorageInfo()
  const [asked, setAsked] = useState(false)
  const ask = async () => {
    await requestPersist()
    setAsked(true)
    await refresh()
  }
  return (
    <>
      <SectionTitle>存储</SectionTitle>
      <Card>
        <Row
          label="持久化存储"
          sub={
            info.persisted
              ? '浏览器清理空间时不会删训练数据'
              : asked
                ? '浏览器没批准。先装到桌面、多用几天再试；记得定期导出备份'
                : '开启后浏览器清理空间时不会删训练数据'
          }
        >
          {info.persisted ? <Chip tone="lime">已开启</Chip> : <Button onClick={() => void ask()}>申请</Button>}
        </Row>
        {info.usageKB !== null && (
          <>
            <Divider />
            <Row label="已用空间">
              <span className="text-base tabular-nums text-zinc-200">{info.usageKB} KB</span>
            </Row>
          </>
        )}
      </Card>
    </>
  )
}

function BackupSection() {
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [pending, setPending] = useState<{ data: ReturnType<typeof parseBackup>; summary: ImportSummary } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const share = canShareFiles()

  const run = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn()
      setMsg({ tone: 'ok', text: ok })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return // 用户取消分享
      setMsg({ tone: 'err', text: e instanceof Error ? e.message : String(e) })
    }
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setMsg(null)
    try {
      const data = parseBackup(await f.text())
      setPending({ data, summary: summarize(data) })
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
      <SectionTitle>数据备份</SectionTitle>
      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => void run(downloadBackup, '已保存到「下载」文件夹')}>导出到下载</Button>
          <Button onClick={() => void run(shareBackup, '已分享')} disabled={!share}>
            分享…
          </Button>
        </div>
        <Button className="w-full" onClick={() => fileRef.current?.click()}>
          从备份恢复
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />

        {pending && (
          <div className="rounded-xl bg-red-500/10 p-3">
            <div className="text-[15px] text-red-100">
              备份里有：{pending.summary.sessions} 次训练、{pending.summary.setLogs} 组、{pending.summary.bodyMetrics} 条身体数据、
              {pending.summary.dailyChecks} 天打卡。
            </div>
            <div className="mt-1 text-[15px] font-semibold text-red-300">恢复会覆盖手机上现在的全部数据。</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setPending(null)}>
                取消
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const p = pending
                  setPending(null)
                  void run(() => restoreBackup(p.data), '已恢复')
                }}
              >
                确认覆盖
              </Button>
            </div>
          </div>
        )}

        {msg && <div className={`text-[15px] ${msg.tone === 'ok' ? 'text-lime-300' : 'text-red-300'}`}>{msg.text}</div>}
      </Card>
    </>
  )
}

function AboutSection() {
  const [status, setStatus] = useState<string | null>(null)
  const check = async () => {
    setStatus('检查中…')
    try {
      const found = await checkForUpdate()
      setStatus(found ? '发现新版本，顶部会出现「更新」' : '已经是最新版')
    } catch {
      setStatus('检查失败（离线？）')
    }
  }
  return (
    <>
      <SectionTitle>关于</SectionTitle>
      <Card>
        <Row label="版本" sub={`构建于 ${BUILD_TIME}`}>
          <Button onClick={() => void check()}>检查更新</Button>
        </Row>
        {status && <div className="pb-1 text-[15px] text-zinc-200">{status}</div>}
      </Card>
    </>
  )
}
