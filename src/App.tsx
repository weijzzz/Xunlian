import { useEffect } from 'react'
import { BottomNav, type Tab } from './components/BottomNav'
import { Placeholder } from './components/ui'
import { installAudioUnlock } from './lib/alert'
import { usePWA } from './lib/pwa'
import { useRoute } from './lib/router'
import { requestPersist } from './lib/storage'
import { BodyPage } from './pages/BodyPage'
import { CardsPage } from './pages/CardsPage'
import { DevAnims } from './pages/DevAnims'
import { DonePage } from './pages/DonePage'
import { LibraryPage } from './pages/LibraryPage'
import { SettingsPage } from './pages/SettingsPage'
import { StartPage } from './pages/StartPage'
import { TodayPage } from './pages/TodayPage'
import { TrainPage } from './pages/TrainPage'

const TABS: Tab[] = ['today', 'history', 'body', 'settings']

export default function App() {
  const route = useRoute()
  const pwa = usePWA()
  const page = route[0] ?? 'today'
  // 全屏流程：开始页、训练中、完成页（不显示底部导航）
  const fullscreen = ['start', 'train', 'done', 'dev', 'library', 'cards'].includes(page)
  // #/weigh = 桌面长按图标的「记体重」快捷方式
  const weigh = page === 'weigh'
  const tab: Tab = TABS.includes(page as Tab) ? (page as Tab) : 'today'

  useEffect(() => {
    installAudioUnlock()
    void requestPersist()
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [page])

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      {pwa.needRefresh && page !== 'train' && (
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-lime-400 px-4 pb-2 pt-[max(env(safe-area-inset-top),0.5rem)] text-zinc-950">
          <span className="font-semibold">有新版本</span>
          <div className="flex gap-2">
            <button type="button" onClick={pwa.dismiss} className="h-10 rounded-lg px-3 text-[15px] font-semibold">
              稍后
            </button>
            <button type="button" onClick={() => void pwa.update()} className="h-10 rounded-lg bg-zinc-950 px-4 text-[15px] font-bold text-lime-300">
              更新
            </button>
          </div>
        </div>
      )}
      {pwa.offlineReady && !pwa.needRefresh && !fullscreen && (
        <button
          type="button"
          onClick={pwa.dismiss}
          className="fixed inset-x-4 bottom-20 z-30 mx-auto max-w-sm rounded-xl bg-zinc-700 px-4 py-3 text-left text-[15px] text-white shadow-lg"
        >
          已可离线使用 ✓ <span className="text-zinc-300">（点一下关闭）</span>
        </button>
      )}

      <main className={`flex-1 px-4 pt-[max(env(safe-area-inset-top),1rem)] ${fullscreen ? 'pb-4' : 'pb-32'}`}>
        {page === 'start' && <StartPage templateId={route[1] ?? ''} />}
        {page === 'train' && <TrainPage />}
        {page === 'done' && <DonePage sessionId={route[1] ?? ''} />}
        {page === 'dev' && <DevAnims />}
        {page === 'library' && <LibraryPage id={route[1]} />}
        {page === 'cards' && <CardsPage id={route[1]} />}
        {!fullscreen && tab === 'today' && <TodayPage weighOpen={weigh} />}
        {!fullscreen && tab === 'history' && (
          <Placeholder title="历史" step="第 3、5 步" items={['按日期列出每次训练，点开看每组', '每个动作的趋势图（最大负重、每组次数）', '引体每组次数单独一张图']} />
        )}
        {!fullscreen && tab === 'body' && <BodyPage />}
        {!fullscreen && tab === 'settings' && <SettingsPage />}
      </main>

      {!fullscreen && <BottomNav current={tab} />}
    </div>
  )
}
