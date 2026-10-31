import { useLiveQuery } from 'dexie-react-hooks'
import { SessionSummaryView } from '../components/SessionSummary'
import { Button } from '../components/ui'
import { db } from '../lib/db'
import { navigate } from '../lib/router'

// 训练完成：完整总结
export function DonePage({ sessionId }: { sessionId: string }) {
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId])
  if (session === undefined) return null
  return (
    <div className="pb-10 pt-4">
      <div className="text-center text-[56px] leading-none text-lime-400">✓</div>
      <h1 className="mt-2 text-center text-[27px] font-bold">练完了</h1>
      <p className="mb-5 mt-1 text-center text-[17px] text-zinc-300">{session?.templateName}</p>
      <SessionSummaryView sessionId={sessionId} />
      <Button variant="primary" className="mt-6 h-14 w-full text-xl" onClick={() => navigate('today', { replace: true })}>
        回首页
      </Button>
    </div>
  )
}
