import { Card, Divider, SectionTitle } from '../components/ui'
import { WeightCard } from '../components/WeightCard'
import { fmtChange, fmtKg, useMetrics } from '../lib/body'
import { longDate, parseYmd } from '../lib/dates'

export function BodyPage() {
  const weights = useMetrics('weight')
  const recent = (weights ?? []).slice(0, 14)

  return (
    <div>
      <h1 className="mb-4 text-[27px] font-bold">身体</h1>
      <WeightCard />

      <SectionTitle hint={recent.length ? `最近 ${recent.length} 次` : undefined}>体重记录</SectionTitle>
      <Card className="py-1">
        {recent.length === 0 ? (
          <div className="py-3 text-[15px] text-zinc-300">还没有记录</div>
        ) : (
          recent.map((r, i) => {
            const prev = recent[i + 1]
            return (
              <div key={r.date}>
                {i > 0 && <Divider />}
                <div className="flex min-h-12 items-center justify-between py-2">
                  <span className="text-[15px] text-zinc-200">{longDate(parseYmd(r.date))}</span>
                  <span className="flex items-baseline gap-3">
                    {prev && <span className="text-[13px] tabular-nums text-zinc-400">{fmtChange(r.value - prev.value)}</span>}
                    <span className="text-[17px] font-semibold tabular-nums">{fmtKg(r.value)}</span>
                  </span>
                </div>
              </div>
            )
          })
        )}
      </Card>

      <SectionTitle>第 5 步会做</SectionTitle>
      <Card>
        <ul className="space-y-2 text-base text-zinc-100">
          {['体重趋势图、7 日平均、周变化', '每两周腰围（主指标）、每 4-6 周胸围，到期提醒', '趋势提示：+150 / 保持 / −150 kcal'].map((t) => (
            <li key={t} className="flex gap-2">
              <span className="text-zinc-400">·</span>
              {t}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
