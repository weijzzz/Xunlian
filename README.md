# 训练记录

个人自用的徒手训练记录 PWA：按训练卡带着练、记每组负重和次数、休息倒计时、双重渐进加重提示、身体数据趋势。数据全部存在手机本地（IndexedDB），可一键导出 JSON 备份。

在线地址：https://weijzzz.github.io/Xunlian/
（Android Chrome 打开 → 右上角菜单 →「添加到主屏幕 / 安装应用」）

## 本地开发

```bash
npm install
npm run dev      # http://localhost:5173/Xunlian/
npm run build    # 输出到 dist/
node scripts/make-icons.mjs   # 重新生成图标
```

push 到 `main` 后 GitHub Actions 自动部署。
