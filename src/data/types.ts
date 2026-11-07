// 肌群分组：48 小时规则按这个判断（core 不受限制）
export type Group = 'push' | 'pull' | 'legs' | 'core'

export const GROUP_NAME: Record<Group, string> = {
  push: '推',
  pull: '拉',
  legs: '腿',
  core: '腹',
}

export const GROUP_ORDER: Group[] = ['push', 'pull', 'legs', 'core']

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
  archived?: boolean // 删除 = 隐藏（练过的动作历史要保留）
  custom?: boolean // 用户自己新建的
}

export interface Slot {
  exerciseId: string
  sets: number
  altId?: string // 可一键替换的动作（上肢B②：有矮杠换反向划船）
}

// 一组轮流做的动作（通常是一对）；finisher = 收尾，组间 45 秒，精简模式跳过
export interface Block {
  slots: Slot[]
  finisher?: boolean
}

export type RestRange = [number, number] // 秒

export interface Template {
  id: string
  name: string
  short: string // 短名，用在周排法格子里
  location: Location
  order: number
  blocks: Block[]
}

// ---------- 训练 ----------

export type Phase = 'warmup' | 'set' | 'rest' | 'done'

// 当前在计划里的位置。用 (第几块, 第几轮, 第几个动作, 左右) 定位，
// 训练中改了动作，计划重新展开后也能找回原位置
export interface Cursor {
  b: number
  r: number
  s: number
  side?: 'L' | 'R'
  phase: Phase
  restEndsAt?: number
  restTotal?: number
}

export interface Session {
  id: string
  templateId: string
  templateName: string // 当时的卡名（之后改名不影响历史）
  location: Location
  startedAt: number
  endedAt?: number
  status: 'active' | 'done' | 'quit'
  short: boolean // 精简模式
  fatigued: Group[] // 空 = 正常
  layout: Block[] // 这次实际用的训练卡副本（含临时改动；精简模式已裁剪）
  cursor: Cursor
  harder?: string[] // 这次改了节奏/变式、变难了的动作 id（不算退步）
}

export interface SetLog {
  id: string
  sessionId: string
  exerciseId: string
  setNo: number // 这个动作在本次训练里的第几组（从 1 开始，左右各自计数）
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

// 「只这周」改某天的训练；templateId = null 表示休息
export interface PlanOverride {
  date: string
  templateId: string | null
}

export interface KV {
  key: string
  value: unknown
}
