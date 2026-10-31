// 肌群分组：48 小时规则按这个判断（core 不受限制）
export type Group = 'push' | 'pull' | 'legs' | 'core'

export const GROUP_NAME: Record<Group, string> = {
  push: '推',
  pull: '拉',
  legs: '腿',
  core: '腹',
}

// no = 双边；LR = 单边，左右分开记；alt = 交替（死虫，一边算 1 次，不分左右记）
export type Sided = 'no' | 'LR' | 'alt'

// kg = 负重；cm = 脚垫高度（派克）；none = 自重，不输入负重
export type LoadUnit = 'kg' | 'cm' | 'none'

export type Location = 'home' | 'out'

export interface FirstTest {
  testLoad: number
  // 按第 1 组力竭次数决定后面用多重：从上往下第一个满足 reps >= minReps 的
  rules: { minReps: number; load: number }[]
}

export interface Exercise {
  id: string
  name: string
  area: string // 显示用部位
  group: Group
  sided: Sided
  unit: LoadUnit
  step: number // 负重输入步进
  loadLabel: string // 负重方式：背包 / 米袋 / 水桶 / 脚垫高度 / 自重
  repMin: number | null // null = 力竭（引体）
  repMax: number | null
  addLoad?: number // 所有组到上限后，下次预填加多少
  addLoadText?: string // 提示文字，如 "+1–2kg"
  loadAfterReps?: number // 引体：任一组超过这个数才提示负重
  cue: string // 训练时显示的一行要点
  progressTip?: string // 自重 / 高度类动作到顶时显示的进阶方法
  firstTest?: FirstTest
}

export interface Slot {
  exerciseId: string
  sets: number
  altId?: string // 可一键替换的动作（上肢B②：有矮杠换反向划船）
}

export type RestRange = [number, number] // 秒

export interface Pair {
  a: Slot
  b: Slot
  restAB: RestRange // a 做完到 b
  restBA: RestRange // b 做完到下一轮 a
}

export interface Finisher extends Slot {
  rest: number
}

export interface Template {
  id: string
  name: string
  short: string // 短名，用在徽章上
  location: Location
  pairs: Pair[]
  finisher?: Finisher
}

// ---------- 存进 IndexedDB 的 ----------

export interface Session {
  id: string
  templateId: string
  location: Location
  startedAt: number
  endedAt?: number
  status: 'active' | 'done' | 'quit'
  short: boolean // 精简模式
  fatigued: Group[] // 空 = 正常
  warmupDone: boolean
  swaps?: Record<string, string> // 原动作 id → 替换后的 id
  cursor?: { step: number; restEndsAt?: number } // 中途退出恢复用
}

export interface SetLog {
  id: string
  sessionId: string
  exerciseId: string
  setNo: number // 这个动作在本次训练里的第几组（从 1 开始）
  side?: 'L' | 'R'
  load: number
  reps: number
  doneAt: number
}

export type MetricType = 'weight' | 'waist' | 'chest'

export interface BodyMetric {
  type: MetricType
  date: string // YYYY-MM-DD（本地日期）
  value: number
}

export interface DailyCheck {
  date: string
  creatine: boolean
  vacuum: boolean
}

export interface KV {
  key: string
  value: unknown
}
