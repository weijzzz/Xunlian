import { useEffect } from 'react'
import { BottomNav, type Tab } from './components/BottomNav'
import { Placeholder } from './components/ui'
import { installAudioUnlock } from './lib/alert'
import { usePWA } from './lib/pwa'
import { useRoute } from './lib/router'
import { requestPersist } from './lib/storage'
import { SettingsPage } from './pages/SettingsPage'
import { TodayPage } from './pages/TodayPage'

const TABS: Tab[] = ['today', 'history', 'body', 'settings']

export default function App() {
  const route = useRoute()
  const tab: Tab = TABS.includes(route[0] as Tab) ? (route[0] as Tab) : 'today'
  const pwa = usePWA()

  useEffect(() => {
    installAudioUnlock()
    void requestPersist()
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      {pwa.needRefresh && (
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-lime-400 px-4 pb-2 pt-[max(env(safe-area-inset-top),0.5rem)] text-zinc-950">
          <span className="font-semibold">有新版本</span>
          <div className="flex gap-2">
            <button type="button" onClick={pwa.dismiss} className="h-11 rounded-lg px-3 text-base font-semibold">
              稍后
            </button>
            <button type="button" onClick={() => void pwa.update()} className="h-11 rounded-lg bg-zinc-950 px-4 text-base font-bold text-lime-300">
              更新
            </button>
          </div>
        </div>
      )}
      {pwa.offlineReady && !pwa.needRefresh && (
        <button
          type="button"
          onClick={pwa.dismiss}
          className="fixed inset-x-4 bottom-20 z-30 mx-auto max-w-sm rounded-xl bg-zinc-700 px-4 py-3 text-left text-base text-white shadow-lg"
        >
          已可离线使用 ✓ <span className="text-zinc-300">（点一下关闭）</span>
        </button>
      )}

      <main className="flex-1 px-4 pb-32 pt-[max(env(safe-area-inset-top),1.25rem)]">
        {tab === 'today' && <TodayPage />}
        {tab === 'history' && (
          <Placeholder title="历史" step="第 3、5 步" items={['按日期列出每次训练，点开看每组', '每个动作的趋势图（最大负重、每组次数）', '引体每组次数单独一张图']} />
        )}
        {tab === 'body' && (
          <Placeholder
            title="身体"
            step="第 5 步"
            items={['每天晨起空腹体重 → 7 日平均、周变化', '每两周腰围（主指标）、每 4-6 周胸围，到期提醒', '趋势提示：+150 / 保持 / −150 kcal']}
          />
        )}
        {tab === 'settings' && <SettingsPage />}
      </main>

      <BottomNav current={tab} />
    </div>
  )
}
