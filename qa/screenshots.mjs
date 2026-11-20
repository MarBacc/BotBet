// QA screenshots for the README. Usage: node qa/screenshots.mjs [baseUrl]
// Needs the web app served (cd web && npm run build && npm run preview).
import { chromium } from 'playwright'
import { writeFileSync, statSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'docs', 'screenshots')
mkdirSync(out, { recursive: true })
const BASE = process.argv[2] ?? 'http://localhost:4173/'
const log = []
const stamp = () => new Date().toISOString()

function watch(page, tag) {
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) log.push(`${stamp()} [${tag}] console.${m.type()}: ${m.text()}`) })
  page.on('pageerror', e => log.push(`${stamp()} [${tag}] pageerror: ${e.message}`))
  page.on('requestfailed', r => log.push(`${stamp()} [${tag}] requestfailed: ${r.url()} ${r.failure()?.errorText}`))
  page.on('response', r => { if (r.status() >= 400) log.push(`${stamp()} [${tag}] http ${r.status()}: ${r.url()}`) })
}

async function open(browser, tag, viewport, dsf = 1) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dsf })
  const page = await ctx.newPage()
  watch(page, tag)
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForSelector('.banner', { timeout: 15000 })
  await page.waitForTimeout(500)
  return { ctx, page }
}

const shots = []
const browser = await chromium.launch()
try {
  const desk = { width: 1920, height: 1080 }

  // 1. main: full page with the real result loaded
  let { ctx, page } = await open(browser, 'main', desk)
  const sample = await page.locator('.sample-ribbon').count()
  log.push(`${stamp()} [main] sample ribbon present: ${sample > 0}`)
  await page.screenshot({ path: join(out, 'main.png'), fullPage: true })
  shots.push('main.png')

  // 2. wallet card (element)
  const cap = page.locator('.panel.cap')
  if (await cap.count()) {
    await cap.scrollIntoViewIfNeeded()
    await cap.screenshot({ path: join(out, 'wallet-card.png') })
    shots.push('wallet-card.png')
  } else log.push(`${stamp()} [wallet] MISSING: .panel.cap not on page`)

  // 3. present: press p, ~3s into replay
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.keyboard.press('p')
  await page.waitForSelector('.present', { timeout: 10000 })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: join(out, 'present.png') })
  shots.push('present.png')

  // 4. winner: jump to the end (Space in Present mode), wait for the win card
  await page.keyboard.press('Space')
  const win = await page.waitForSelector('.pr-win', { timeout: 15000 }).then(() => true, () => false)
  if (!win) log.push(`${stamp()} [winner] .pr-win did not appear after Space`)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: join(out, 'winner.png') })
  shots.push('winner.png')
  await ctx.close()

  // 5. mobile 390x844
  ;({ ctx, page } = await open(browser, 'mobile', { width: 390, height: 844 }, 2))
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  log.push(`${stamp()} [mobile] horizontal overflow px: ${overflow}`)
  await page.screenshot({ path: join(out, 'mobile.png') })
  shots.push('mobile.png')
  await ctx.close()
} finally {
  await browser.close()
}

for (const s of shots) log.push(`${stamp()} [size] ${s}: ${Math.round(statSync(join(out, s)).size / 1024)} KB`)
writeFileSync(join(root, 'qa', 'console.log'), log.join('\n') + '\n')
console.log(log.join('\n'))
