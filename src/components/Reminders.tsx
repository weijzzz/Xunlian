import { useEffect, useState } from 'react'
import { useMetrics } from '../lib/body'
import { addDays, longDate, ymd } from '../lib/dates'
import { buildItems, disablePush, enablePush, permission, pushSupported, pushUrl, sendTest, syncReminders } from '../lib/push'
import { setSetting, useSettings, type Reminder } from '../lib/settings'
import { Button, Card, Chip, Divider, Row, SectionTitle, Switch } from './ui'

function useWeighedToday(): boolean | undefined {
  const weights = useMetrics('weight')
  if (weights === undefined) return undefined
  const today = ymd(new Date())
  return weights.some((w) => w.date === today)
}

// 放在 App 里：设置变了、记了体重、切回 App 时，把提醒时间同步给服务器
export function ReminderSync() {
  const { pushOn, reminders, parityFlip } = useSettings()
  const weighed = useWeighedToday()
  const key = JSON.stringify(reminders)
  useEffect(() => {
    if (!pushOn || weighed === undefined) return
    const run = () => void syncReminders(reminders, parityFlip, { weight: weighed }).catch(() => {})
    const t = setTimeout(run, 800)
    const onVisible = () => document.visibilityState === 'visible' && run()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushOn, key, parityFlip, weighed])
  return null
}

function fmtNext(at: number): string {
  const d = new Date(at)
  const today = new Date()
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  if (ymd(d) === ymd(today)) return `今天 ${hm}`
  if (ymd(d) === ymd(addDays(today, 1))) return `明天 ${hm}`
  return `${longDate(d)} ${hm}`
}

const TIME_INPUT = 'h-11 w-[104px] rounded-xl bg-zinc-600 px-2 text-center text-[17px] text-white [color-scheme:dark]'

// 设置 → 提醒
export function ReminderSection() {
  const { pushOn, reminders, parityFlip } = useSettings()
  const weighed = useWeighedToday()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const perm = permission()
  const server = !!pushUrl()

  const update = (id: string, patch: Partial<Reminder>) =>
    void setSetting(
      'reminders',
      reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    )

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      setMsg({ ok: true, text: ok })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  const items = buildItems(reminders, parityFlip, new Date(), { weight: !!weighed })
  const on = pushOn && perm === 'granted'

  return (
    <>
      <SectionTitle>提醒</SectionTitle>
      <Card>
        <Row
          label="通知"
          sub={
            !pushSupported()
              ? '这个浏览器不支持通知'
              : !server
                ? '推送服务器还没部署好'
                : perm === 'denied'
                  ? '被拒绝了：手机设置 → 应用 → Chrome（或「训练」）→ 通知 → 允许，再回来点开启'
                  : on
                    ? '到点会在手机上弹通知'
                    : '开启后才能收到提醒'
          }
        >
          {on ? (
            <Chip tone="lime">已开启</Chip>
          ) : (
            <Button variant="primary" disabled={busy || !server || !pushSupported() || perm === 'denied'} onClick={() => void run(enablePush, '通知已开启 ✓')}>
              开启
            </Button>
          )}
        </Row>

        {reminders.map((r) => (
          <div key={r.id}>
            <Divider />
            <Row label={r.label} sub={r.id === 'weight' ? '当天记过体重就不再提醒' : undefined}>
              <Switch on={r.enabled} onChange={(v) => update(r.id, { enabled: v })} label={`${r.label}提醒`} />
            </Row>
            {r.enabled && (
              <div className="space-y-2 pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] text-zinc-300">早起日（7:00 起床）</span>
                  <input type="time" aria-label="早起日提醒时间" value={r.early} onChange={(e) => e.target.value && update(r.id, { early: e.target.value })} className={TIME_INPUT} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[15px] text-zinc-300">不早起的日子</span>
                  <input type="time" aria-label="其他日子提醒时间" value={r.other} onChange={(e) => e.target.value && update(r.id, { other: e.target.value })} className={TIME_INPUT} />
                </div>
              </div>
            )}
          </div>
        ))}

        {on && (
          <>
            <Divider />
            <div className="py-2 text-[15px] text-zinc-300">{items.length ? `下一次提醒：${fmtNext(items[0].at)}` : '没有要发的提醒'}</div>
            <div className="grid grid-cols-2 gap-2 pb-1">
              <Button disabled={busy} onClick={() => void run(sendTest, '已发送，几秒内会弹出来')}>
                测试通知
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => void run(disablePush, '通知已关闭')}>
                关闭通知
              </Button>
            </div>
          </>
        )}
        {msg && <div className={`pb-1 text-[15px] ${msg.ok ? 'text-lime-300' : 'text-red-300'}`}>{msg.text}</div>}
        <p className="pb-1 text-[13px] text-zinc-400">提醒时间会提前排好 3 周；每次打开 App 自动往后续</p>
      </Card>
    </>
  )
}
