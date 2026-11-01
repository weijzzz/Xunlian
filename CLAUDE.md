# 训练记录 PWA — 给 Claude 的项目说明

个人自用的徒手训练记录 App。用户在训练中**单手**操作手机（Android / Chrome），常在晚上 23 点练。

## 怎么合作
- 一次只做一个功能，做完用户在手机上测，确认后再做下一个
- 新功能写代码前，先给用户看数据结构改动 + 页面改动，确认后再写
- 界面中文；单位 kg、cm；深色模式
- **字号、颜色**（用户试过：12px 灰字嫌小嫌暗，18px 又嫌大）：正文 17px，次要 15px，最小 13px；次要文字 zinc-300，提示 zinc-400，别用 zinc-500 以下当文字色；卡片 bg-zinc-800/70 + 边框
- 每次 push 到 main 会自动部署到 https://weijzzz.github.io/Xunlian/

## 技术栈
React + Vite + TypeScript + Tailwind v4 · Dexie（IndexedDB）· vite-plugin-pwa（registerType: prompt，训练中不自动刷新）· hash 路由（`src/lib/router.ts`）

## 代码在哪
- `src/data/types.ts` 所有类型 · `src/data/exercises.ts` / `templates.ts` 动作库和训练卡的**初始数据**（SEED_*）+ 休息规则
- `src/lib/library.tsx` 动作库/训练卡：存在数据库里，**只在表为空时**从 SEED 导入——之后改 SEED 不会影响已有用户，要改得写迁移
- `src/lib/plan.ts` 把训练卡展开成步骤（块→轮→动作→左右）+ 休息时长 + 预计分钟
- `src/lib/progress.ts` 48h 疲劳、「上次」参考、负重/次数预填、加重提示、首测
- `src/lib/session.ts` 训练进行中的所有操作（开始/记组/休息/换动作/跳过/多一组/加动作/结束/6h 自动结束）
- 页面：`TodayPage` 首页 · `StartPage` 开始页（临时改动作）· `TrainPage` 热身/记组/休息/菜单 · `DonePage` 完成
- `src/lib/schedule.ts` 某天实际练什么 = planOverrides（只这一天）→ settings.defaultPlan（以后都这样）→ week.ts 的 DEFAULT_PLAN；`dayWarnings` 48h/早起/上肢B 提示 · `DayPlanSheet` 改某天的面板
- `src/lib/week.ts` 单双周、早起日、原始排法 · `src/lib/db.ts` 数据库 · `src/lib/backup.ts` 导出导入
- `src/lib/alert.ts` 提示音/震动 · `src/lib/wakeLock.ts` 屏幕常亮
- `src/anim/` 动作小人动画：`figure.ts` 引擎（姿势=髋+躯干角+手脚落点，肘膝用 IK）、`anims.ts` 13 个动作、`ExerciseAnim.tsx`；`#/dev/anims` 看所有关键帧（调动画时截图用）
- `src/components/ExerciseVisual.tsx` 动作演示：用户自己的图片/动图/视频（db.media，不进备份）优先，否则小人动画
- `src/components/NewExerciseForm.tsx` 的 `ExerciseForm`：新建/编辑动作共用（选动作面板、动作库页）
- `src/components/BlocksEditor.tsx` 改训练卡里的动作：开始页（只这一次）和训练卡编辑（template 模式：上下移、收尾、新的一组）共用
- 页面 `LibraryPage`（#/library、#/library/:id、#/library/new）· `CardsPage`（#/cards、#/cards/:id）；入口在设置「训练内容」
- library.tsx 里的 `updateExercise / setArchived / saveTemplate / createTemplate / deleteTemplate（会清掉排法里的引用）/ moveTemplate`
- `src/lib/summary.ts` 一次训练的总结：该加难了（双重渐进/进阶方法/引体背包，疲劳肌群不算）、跟上次比（findRef 带 before=这次开始时间；先比最大负重，再比同组号同负重的次数）
- `src/components/SessionSummary.tsx` 总结视图（完成页、历史详情共用，点某组可改/删）· 页面 `HistoryPage`（#/history、#/history/:id，可删整次训练）
- `src/lib/recommend.ts` 今天练什么（5.5 四条规则：地点、48h 排除、今天排法→拆全身→最久没练的肌群、单双周平手）· `src/components/TodayCards.tsx` 首页推荐卡（section aria-label=今天练什么）+ 每日打卡 · `src/lib/daily.ts` 打卡读写
- 开始页路由 `#/start/:id/short` = 预选精简
- `src/components/LineChart.tsx` 自己画的 SVG 折线图（点按十字线+提示框、≥2 条线有图例、疲劳点琥珀圈）；配色 SERIES_COLORS 用 dataviz 校验器在深色卡片底 #1e1e21 上校验通过，按顺序取
- `src/components/ExerciseTrend.tsx` 历史→动作趋势（#/history/trend/:动作）：最大负重图、每组次数图（引体标题「引体每组次数」）、每次明细
- `src/lib/advice.ts` 趋势提示规则 + 腰围（14 天）/胸围（28 天）到期；`strengthDecline` 力量下滑 · 身体页 `BodyPage`：趋势提示、体重图（每天点+7日均线，4周/12周/全部）、腰围胸围卡；首页 `MeasureReminder`
- `src/lib/body.ts` 体重读写和 7 日平均 · `src/components/WeightCard.tsx` 首页/身体页的体重卡
- `src/pages/VacuumPage.tsx` 吸腹计时（#/vacuum，首页打卡「吸腹 ⏱」进入）：3 组 ×（准备 3s → 保持 20/30/40s → 休息 20s），做完自动打勾；也能不计时直接打勾
- 提醒推送：`src/lib/push.ts`（设备 id+密钥、订阅、`buildItems` 排未来 21 天、`syncReminders` 内容变了才发）· `src/components/Reminders.tsx`（设置「提醒」区 + App 里的 `ReminderSync`：开 App/切回来/改设置/记体重时同步）· `public/push-sw.js`（SW 里收推送、点通知打开对应页，workbox importScripts 引入）
- settings.reminders 是列表（id/label/enabled/early/other），以后加别的提醒往里加一项 + push.ts 的 TEXT 加文案
- `worker/` 推送服务器（Cloudflare Worker + Durable Object 闹钟准点发 Web Push，VAPID 钥匙第一次 /key 时在 DO 里生成）；只存订阅和提醒时间。`.github/workflows/worker.yml` 改 worker/ 时自动部署（要仓库 Secrets：CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID）；地址 https://xunlian-push.zhangweijie2006.workers.dev 填在 push.ts 的 `DEPLOYED_URL`（这个沙盒连不上 workers.dev，只能看 Actions 日志里的检查），调试可用 localStorage `xunlian.pushUrl` 覆盖
- 为什么要服务器：浏览器的定时通知（Notification Triggers）从没正式上线，PWA 关着时只能靠服务器推
- 训练卡结构：`blocks[]`，每块 `slots[]` 轮流做；`finisher` 块组间 45s、精简模式跳过
- Session 存当天训练卡副本 `layout`（含临时改动，精简已裁剪）；`cursor` 用 (块,轮,动作,左右) 定位，改了动作也能找回位置
- 测试：`/home/claude/checks/train.mjs` 完整走查（58 项）+ `extras.mjs`（数字条/新建动作/自定义图片）+ `plan.mjs`（改某天训练，23 项）+ `library.mjs`（动作库/训练卡，23 项）+ `history.mjs`（总结/历史，22 项）+ `recommend.mjs`（推荐/打卡，21 项）+ `trends.mjs`（趋势图/趋势提示各规则/腰围，24 项）+ `vacuum.mjs`（吸腹计时）+ `reminders.mjs`（提醒：假订阅 + 拦截服务器请求，28 项）+ `upgrade.mjs`（旧版数据升级），改逻辑后都跑一遍；worker：`node --experimental-strip-types test/webpush.test.ts`（加密，用 http_ece 解密核对）+ `wrangler dev --var ALLOW_HTTP_ENDPOINTS:1` 下跑 `test/integration.test.mjs`

## 已确认的规则（和用户逐条确认过）
- 疲劳模式按**肌群**判断（推/拉/腿；腹不受 48h 限制），只有疲劳肌群的数据不参与加重判断
- 精简模式和疲劳可同时出现：Session 用 `short` + `fatigued[]`
- 训练时长选项叫「完整 / 精简」，显示预计分钟数，练过几次后用真实用时
- 休息倒计时取区间中值，可 +15s / 跳过；换下一对 90s；单边左→右 20-30s
- 计时按结束时间戳算（锁屏/切出去回来也准）
- 单边动作左右都到次数上限才算达标
- 加重：负重深度俯卧撑 +2.5kg；其他提示「+1–2kg」，下次预填 +1kg；步进 0.5kg
- 自重动作（反向卷腹、死虫、反向划船）到顶不提示加重，显示 `progressTip`
- 引体：没有次数上限，目标 = 上次每组 +1；任一组 >12 才提示背包
- 派克记脚垫高度 cm，快捷 0 / 10 / 30 / 45
- 预填：负重 = 本次上一组 → 上次最后一组（=工作重量，首测组不算）→ 首测重量 → 0；次数目标 = 上次**同负重**、组号最接近那组 +1（封顶上限）；换了负重从下限开始
- 休息中打开菜单：改动针对「下一个」动作，倒计时继续
- 次数数字条：当前次数超出范围时整条平移跟着走；超过上限显示琥珀色 + 提示（用户要求）
- 动作图片：用户要每个动作有图/动图 → 内置小人动画（自己画，没版权问题）+ 可换成自己的图片/动图/视频
- 改动作/排法都给「只这次 / 以后都这样」两个选项（用户确认）；新建动作字段：名字、部位、推/拉/腿/腹、单/双边、负重方式、次数范围、要点
- 体重：秤精度 0.1kg；首页体重卡预填上次值，−/+ 可长按，点数字可键盘输入（支持逗号）；桌面长按图标「记体重」→ `#/weigh`；7 日平均要 7 天里至少记 3 天
- 单双周：2026-11-02 那周 = 单周，设置可翻转
- 推荐规则 3 平手：单周优先分化卡，双周优先全身
- 拆全身：在家拆成「上肢A + 下肢」（上肢B 要单杠，只有周日在外面）
- 提醒：记体重默认早起日、其他日子都 8:00（用户可改，之后还会加别的提醒）；当天记过体重就不提醒
- 吸腹：每组保持默认 30s（可选 20/40），组间休息 20s（用户确认）
- 体重趋势：加「上涨」分支——周均在涨且腰围也涨 → 建议 −150kcal；腰围不变或降 → 正常。
  肌酸开始日后 3 周不给热量建议。「不动」= 周均变化 <0.1kg、腰围变化 <0.5cm；
  「力量下滑」= 最近两次非疲劳训练里过半动作比上次差

## 开发顺序
1. ✅ 骨架 + PWA + 部署 + 设置页（提醒/常亮/存储/备份测试）——用户手机实测全部通过
1.5 ✅ 体重快捷记录（提前做，好让数据早点攒起来）
2. ✅ 训练模式（手动选卡）+ 临时改动作（开始页 ✎ 换/删/改组数/加；训练中 ⋯ 换/跳过/多一组/加动作/改上一组/提前结束）
2.5 ✅ 次数数字条跟着走、选动作时新建动作、动作动画 + 自定义图片/视频
3. ✅ 改某天的训练（首页排法格子点一下，本周/下周：只改这一天 / 以后每个单双周这天都这样；设置里可恢复原始排法）
4. ✅ 永久编辑动作库和训练卡（设置→训练内容；动作：改全部字段/换图/隐藏；训练卡：改名/格子短名/地点/动作/顺序/收尾，新建、删除、排序；开始页「存到训练卡（以后都这样）」）
5. ✅ 训练总结（用时/组数/总次数、该加难了、跟上次比、每组明细）+ 历史列表/详情（改组、删组、删整次）
6. ✅ 今天推荐（家/外面、完整/精简、理由、不推荐的原因、拆全身提示、今天已练）+ 每日打卡（肌酸、吸腹，本周天数）
7. ✅ 趋势图（历史→动作趋势）+ 身体数据（体重图、腰围胸围、趋势提示、首页到期提醒）
—— MVP 七步全部完成。
7.5 吸腹计时 + 记体重推送提醒（Cloudflare Worker）
之后是需求文档的 V2：营养记录（热量/蛋白/盐，常用产品库）、动作详情页
