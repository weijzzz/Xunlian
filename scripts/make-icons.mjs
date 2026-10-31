// 生成 PWA 图标：node scripts/make-icons.mjs
// 图案：三根递增的柱子 = 渐进超负荷
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'

const BG = '#09090b'
const FG = '#a3e635'

function bars(scale = 1) {
  const w = 72, gap = 36, base = 380
  const heights = [140, 220, 300]
  const total = 3 * w + 2 * gap
  const x0 = 256 - total / 2
  const rects = heights
    .map((h, i) => `<rect x="${x0 + i * (w + gap)}" y="${base - h}" width="${w}" height="${h}" rx="18" fill="${FG}"/>`)
    .join('')
  // 以画布中心缩放（maskable 要留安全区）
  const t = `translate(256 ${256 - 24 * scale}) scale(${scale}) translate(-256 -${256 - 24})`
  return `<g transform="${t}">${rects}</g>`
}

const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${BG}"/>${bars(1)}</svg>`
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${BG}"/>${bars(0.78)}</svg>`

writeFileSync('public/favicon.svg', rounded)
await sharp(Buffer.from(rounded)).resize(192, 192).png().toFile('public/pwa-192.png')
await sharp(Buffer.from(rounded)).resize(512, 512).png().toFile('public/pwa-512.png')
await sharp(Buffer.from(full)).resize(512, 512).png().toFile('public/maskable-512.png')
await sharp(Buffer.from(full)).resize(180, 180).png().toFile('public/apple-touch-icon.png')
// 「记体重」快捷方式图标：体重秤
const scale = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${BG}"/>
<rect x="136" y="136" width="240" height="240" rx="52" fill="none" stroke="${FG}" stroke-width="28"/>
<path d="M190 236 A66 66 0 0 1 322 236" fill="none" stroke="${FG}" stroke-width="24" stroke-linecap="round"/>
<line x1="256" y1="252" x2="290" y2="204" stroke="${FG}" stroke-width="22" stroke-linecap="round"/></svg>`
await sharp(Buffer.from(scale)).resize(192, 192).png().toFile('public/shortcut-weight-192.png')
console.log('icons done')
