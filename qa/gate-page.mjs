// Page probe for the release gate. Usage: node qa/gate-page.mjs <url>
// Prints one JSON line: banner, sample, console/page errors, mobile overflow px, external hrefs.
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:4173/'
const b = await chromium.launch()
const errs = []
const watch = p => {
  p.on('pageerror', e => errs.push('pageerror ' + e.message))
  p.on('console', m => m.type() === 'error' && errs.push('console ' + m.text()))
  p.on('response', r => r.status() >= 400 && errs.push(`http ${r.status()} ${r.url()}`))
}

const desk = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage()
watch(desk)
await desk.goto(url, { waitUntil: 'networkidle' })
await desk.waitForSelector('.banner', { timeout: 15000 })
const banner = (await desk.textContent('.banner')).trim()
const sample = (await desk.locator('.sample-ribbon').count()) > 0
const hrefs = await desk.$$eval('a[href^="http"]', as => [...new Set(as.map(a => a.href))])
await desk.keyboard.press('p')
await desk.waitForSelector('.pr-vs', { timeout: 10000 }) // real Present, not the Suspense fallback (also .present)
await desk.waitForTimeout(500)
await desk.keyboard.press('Space')
const presentEnd = await desk.waitForSelector('.pr-win', { timeout: 15000 }).then(() => true, () => false)

const mob = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
watch(mob)
await mob.goto(url, { waitUntil: 'networkidle' })
await mob.waitForSelector('.banner', { timeout: 15000 })
const overflow = await mob.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

await b.close()
console.log(JSON.stringify({ banner, sample, presentEnd, overflow, errs, hrefs }))
