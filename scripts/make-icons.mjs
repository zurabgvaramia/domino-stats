import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i]
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const t = Buffer.from(type)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

function createPng(size, draw) {
  const stride = size * 4 + 1
  const raw = Buffer.alloc(stride * size)
  const px = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = y * stride + 1 + x * 4
    raw[i] = r
    raw[i + 1] = g
    raw[i + 2] = b
    raw[i + 3] = a
  }
  draw(px, size)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function roundRect(px, x, y, w, h, r, color) {
  for (let yy = 0; yy < h; yy += 1) {
    for (let xx = 0; xx < w; xx += 1) {
      let dx = 0
      let dy = 0
      if (xx < r && yy < r) {
        dx = r - xx
        dy = r - yy
      } else if (xx >= w - r && yy < r) {
        dx = xx - (w - r - 1)
        dy = r - yy
      } else if (xx < r && yy >= h - r) {
        dx = r - xx
        dy = yy - (h - r - 1)
      } else if (xx >= w - r && yy >= h - r) {
        dx = xx - (w - r - 1)
        dy = yy - (h - r - 1)
      }
      if (dx * dx + dy * dy > r * r) continue
      px(x + xx, y + yy, color[0], color[1], color[2], color[3] ?? 255)
    }
  }
}

function dot(px, cx, cy, r, color) {
  const rad = Math.ceil(r)
  for (let y = -rad; y <= rad; y += 1) {
    for (let x = -rad; x <= rad; x += 1) {
      if (x * x + y * y <= r * r) px(cx + x, cy + y, color[0], color[1], color[2], 255)
    }
  }
}

function drawIcon(px, size, tileScale) {
  const bg = [16, 32, 24]
  const glow = [36, 62, 46]
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - size / 2
      const dy = y - size * 0.42
      const dist = Math.min(1, Math.sqrt(dx * dx + dy * dy) / (size * 0.7))
      const r = Math.round(glow[0] + (bg[0] - glow[0]) * dist)
      const g = Math.round(glow[1] + (bg[1] - glow[1]) * dist)
      const b = Math.round(glow[2] + (bg[2] - glow[2]) * dist)
      px(x, y, r, g, b, 255)
    }
  }

  const tw = Math.round(size * 0.46 * tileScale)
  const th = Math.round(size * 0.62 * tileScale)
  const tx = Math.round((size - tw) / 2)
  const ty = Math.round((size - th) / 2)
  const radius = Math.max(4, Math.round(size * 0.045))
  roundRect(px, tx - Math.round(size * 0.025), ty - Math.round(size * 0.025), tw + Math.round(size * 0.05), th + Math.round(size * 0.05), radius + 2, [228, 197, 106, 255])
  roundRect(px, tx, ty, tw, th, radius, [244, 239, 226, 255])

  const mid = tx + Math.round(tw / 2)
  const ink = [20, 32, 26]
  for (let y = ty + Math.round(th * 0.14); y < ty + th - Math.round(th * 0.14); y += 1) {
    px(mid, y, ink[0], ink[1], ink[2], 255)
  }

  const pr = Math.max(2, size * 0.028 * tileScale)
  dot(px, tx + Math.round(tw * 0.27), ty + Math.round(th * 0.32), pr, ink)
  dot(px, tx + Math.round(tw * 0.27), ty + Math.round(th * 0.68), pr, ink)
  dot(px, tx + Math.round(tw * 0.73), ty + Math.round(th * 0.28), pr, ink)
  dot(px, tx + Math.round(tw * 0.73), ty + Math.round(th * 0.5), pr, ink)
  dot(px, tx + Math.round(tw * 0.73), ty + Math.round(th * 0.72), pr, ink)
}

const files = [
  ['public/icon-192.png', 192, 1.35],
  ['public/icon-512.png', 512, 1.35],
  ['public/apple-touch-icon.png', 180, 1.35],
  ['public/icon-maskable-512.png', 512, 1],
]

for (const [file, size, scale] of files) {
  writeFileSync(file, createPng(size, (px, s) => drawIcon(px, s, scale)))
}
