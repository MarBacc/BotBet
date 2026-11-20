// Backup demo video of the web page. Usage: node qa/record-demo.mjs [baseUrl]
// Needs the app served (cd web && npm run build && npx vite preview --port 4173).
// Writes qa/out/*.webm (raw) and docs/screenshots/demo.webm (committed copy).
import { chromium } from 'playwright'
import { mkdirSync, copyFileSync, statSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'qa', 'out')
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
const BASE = process.argv[2] ?? 'http://localhost:4173/'
const size = { width: 1920, height: 1080 }
const errors = []

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: outDir, size } })
const page = await ctx.newPage()
page.on('pageerror', e => errors.push('pageerror: ' + e.message))
page.on('console', m => m.type() === 'error' && errors.push('console: ' + m.text()))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.banner', { timeout: 15000 })
await page.waitForTimeout(2500)                      // show the loaded page

await page.keyboard.press('p')                       // Present mode, autoplays the replay
await page.waitForSelector('.present', { timeout: 10000 })
await page.waitForSelector('.pr-win', { timeout: 120000 }) // full replay until the winner screen
await page.waitForTimeout(3000)

await page.keyboard.press('Escape')                  // back to the page
await page.waitForSelector('.present', { state: 'detached', timeout: 5000 }).catch(() => {})
const cap = page.locator('.panel.cap')
await cap.scrollIntoViewIfNeeded()
await cap.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }))
await page.waitForTimeout(4000)

const about = page.locator('.panel.about')
await about.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }))
await page.waitForTimeout(3000)

const video = page.video()
await ctx.close()                                    // flushes the video file
await browser.close()

const raw = await video.path()
const dest = join(root, 'docs', 'screenshots', 'demo.webm')
copyFileSync(raw, dest)
console.log(`raw ${raw}`)
console.log(`docs/screenshots/demo.webm ${(statSync(dest).size / 1048576).toFixed(2)} MB`)
console.log(errors.length ? errors.join('\n') : 'no console/page errors')
