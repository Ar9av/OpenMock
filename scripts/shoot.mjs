/**
 * Screenshots the running editor in headless Chrome.
 *
 *   npm run dev            # in another terminal
 *   npm run shoot          # writes .shots/*.png
 *
 * A 3D editor cannot be checked by unit tests alone: the bugs that matter are
 * "the screen is black" and "the picture is upside down". This loads a test card
 * with a known layout, orbits the device, and measures how much of the card's
 * colour survives, so a blank or occluded screen shows up as a number.
 */
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import zlib from 'node:zlib'

const URL = process.env.OPENMOCK_URL ?? 'http://localhost:5173/'
const DEVICE = process.argv[2] ?? 'MacBook Pro 16'
const OUT = resolve(process.cwd(), '.shots')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

mkdirSync(OUT, { recursive: true })

/** Test card: white band on top, then red/blue over yellow/green. Orientation is unmistakable. */
function writeTestCard(path) {
  const W = 800
  const H = 500
  const rows = []
  for (let y = 0; y < H; y++) {
    const row = [0]
    for (let x = 0; x < W; x++) {
      let c
      if (y < H / 8) c = [255, 255, 255]
      else if (y < H / 2) c = x < W / 2 ? [230, 40, 40] : [40, 120, 240]
      else c = x < W / 2 ? [250, 200, 30] : [30, 190, 110]
      row.push(...c)
    }
    rows.push(Buffer.from(row))
  }
  const crcTable = [...Array(256)].map((_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf) => {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(body))
    return Buffer.concat([len, body, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(path, png)
}

const card = resolve(OUT, 'testcard.png')
writeTestCard(card)

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } })
page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`))
page.on('console', (m) => {
  const t = m.text()
  if (/\[openmock\]/.test(t)) console.log(`  [browser] ${t}`)
})

await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('canvas', { timeout: 20000 })
await page.waitForTimeout(2500)

await page.setInputFiles('.dropzone input[type=file]', card)
await page.waitForTimeout(1500)

await page.locator('.panel-section', { hasText: 'Mockup' }).getByRole('button', { name: /change/i }).click()
await page.getByRole('button', { name: new RegExp(DEVICE, 'i') }).click()
await page.waitForTimeout(4000)

const canvas = page.locator('canvas')

/** Share of the frame showing saturated test-card colour. Zero means a blank or hidden screen. */
async function measure(tag) {
  const png = await canvas.screenshot({ path: resolve(OUT, `${tag}.png`) })
  const pct = await page.evaluate(async (b64) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + b64
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    let hit = 0
    for (let i = 0; i < d.length; i += 4) {
      const [r, g2, b] = [d[i], d[i + 1], d[i + 2]]
      if (Math.max(r, g2, b) - Math.min(r, g2, b) > 70 && Math.max(r, g2, b) > 110) hit++
    }
    return +((100 * hit) / (d.length / 4)).toFixed(2)
  }, png.toString('base64'))
  console.log(`${tag.padEnd(16)} ${String(pct).padStart(6)}%  ${pct > 1 ? 'screen visible' : 'screen not visible'}`)
  return pct
}

console.log(`\n${DEVICE}\n`)
const front = await measure('front')

const box = await canvas.boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2
for (const [i, [dx, dy]] of [
  [-140, 0],
  [-140, 0],
  [280, -90],
  [280, 0],
].entries()) {
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + dx, cy + dy, { steps: 20 })
  await page.mouse.up()
  await page.waitForTimeout(900)
  await measure(`orbit-${i + 1}`)
}

await browser.close()
console.log(`\nImages in ${OUT}`)
if (front < 1) {
  console.error('FAIL: the screen is blank head-on.')
  process.exit(1)
}
