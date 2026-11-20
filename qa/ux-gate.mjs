// UX gate probe. Usage: node qa/ux-gate.mjs <url> <poker-result.json> [screenshotDir]
// Checks: chess still works (banner, replay to end, Present end screen); poker works (tab, replay to end);
// NO private poker cards visible at any replay step (any face-up card / card text must be a table card
// of the current hand); no hex strings in visible text (collapsed <details> is invisible to innerText);
// 0 console errors; mobile 390px overflow 0 on both tabs. Writes plain-chess.png / plain-poker.png.
import { chromium } from 'playwright'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const [url = 'http://localhost:4173/', resultPath, shotDir] = process.argv.slice(2)
const poker = resultPath ? JSON.parse(readFileSync(resultPath, 'utf8')) : null
const fails = [], notes = [], errs = []
const HEX = /0x[0-9a-fA-F]{4,}/g
const RANK = { '10': 'T', jack: 'J', queen: 'Q', king: 'K', ace: 'A' }
const SUIT = { spades: 's', hearts: 'h', diamonds: 'd', clubs: 'c', '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' }
const norm = c => c && c[0].toUpperCase() + c[1].toLowerCase()

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } })
const p = await ctx.newPage()
p.on('pageerror', e => errs.push('pageerror ' + e.message))
p.on('console', m => m.type() === 'error' && errs.push('console ' + m.text()))
p.on('response', r => r.status() >= 400 && errs.push(`http ${r.status()} ${r.url()}`))

const visibleHex = async where => {
  const t = await p.evaluate(() => document.body.innerText)
  const h = [...new Set(t.match(HEX) ?? [])]
  if (h.length) fails.push(`hex visible (${where}): ${h.slice(0, 4).join(', ')}${h.length > 4 ? ` +${h.length - 4}` : ''}`)
  return h.length
}

// ── chess ──
await p.goto(url, { waitUntil: 'networkidle' })
await p.waitForSelector('.banner', { timeout: 15000 }).catch(() => fails.push('chess: no .banner (chess view did not load)'))
const chessTab = p.getByRole('tab', { name: /chess/i })
if (await chessTab.count()) await chessTab.first().click()
await visibleHex('chess, start')
const last = p.getByRole('button', { name: /last move|skip to the end|end/i }).first()
if (await last.count()) await last.click(); else for (let i = 0; i < 200; i++) await p.keyboard.press('ArrowRight')
await p.waitForTimeout(500)
await visibleHex('chess, end of replay')
if (shotDir) await p.screenshot({ path: join(shotDir, 'plain-chess.png'), fullPage: true })
await p.keyboard.press('p')
const chessPresent = await p.waitForSelector('.pr-vs, .present', { timeout: 8000 }).then(() => true, () => false)
await p.waitForTimeout(500); await p.keyboard.press('Space')
const chessWin = await p.waitForSelector('.pr-win', { timeout: 15000 }).then(() => true, () => false)
if (!chessPresent || !chessWin) fails.push(`chess Present mode: opened=${chessPresent} winner screen=${chessWin}`)
else await visibleHex('chess Present end screen')
await p.keyboard.press('Escape'); await p.waitForTimeout(400)

// ── poker ──
let frames = 0, leaks = 0, pokerOk = false
const pokerTab = p.getByRole('tab', { name: /poker/i })
if (!poker) notes.push('no poker-result.json given: poker checks skipped')
else if (!(await pokerTab.count())) fails.push('poker: no Poker tab')
else {
  await pokerTab.first().click()
  pokerOk = await p.waitForSelector('.ptable', { timeout: 10000 }).then(() => true, () => false)
  if (!pokerOk) fails.push('poker: table (.ptable) did not render')
  else {
    const slider = p.locator('input[aria-label="Replay position"]').first()
    const total = Number(await slider.getAttribute('max'))
    const check = async label => {
      // Each table (inline, and the full-screen one when open) is checked against its own hand's board;
      // card faces outside any table and card text anywhere against the union of the shown hands' boards.
      const s = await p.evaluate(() => {
        const vis = e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed'
        const lab = e => e.getAttribute('aria-label') ?? ''
        const tables = [...document.querySelectorAll('.ptable')].filter(vis).map(t => ({ t: lab(t), faces: [...t.querySelectorAll('.pcard:not(.back):not(.empty)')].map(lab) }))
        const loose = [...document.querySelectorAll('.pcard:not(.back):not(.empty)')].filter(e => vis(e) && !e.closest('.ptable')).map(lab)
        return { tables, loose, text: document.body.innerText }
      })
      const toCode = f => { const m = f.match(/^(\S+) of (\w+)/); return m ? norm((RANK[m[1]] ?? m[1]) + SUIT[m[2]]) : null }
      const boardOf = t => new Set((poker.hands.find(h => h.n === Number((t.match(/Hand (\d+)/) ?? [])[1]))?.board ?? []).map(norm))
      const bad = new Set(), union = new Set(), hands = []
      for (const t of s.tables) {
        const bd = boardOf(t.t); bd.forEach(c => union.add(c)); hands.push((t.t.match(/Hand (\d+)/) ?? [])[1])
        for (const f of t.faces) { const c = toCode(f); if (c && !bd.has(c)) bad.add(c) }
      }
      for (const f of s.loose) { const c = toCode(f); if (c && !union.has(c)) bad.add(c) }
      for (const m of s.text.matchAll(/(?<![\w])(10|[2-9JQKA])\s?([♠♥♦♣])/g)) { const c = norm((RANK[m[1]] ?? m[1]) + SUIT[m[2]]); if (!union.has(c)) bad.add(c) }
      const n = hands.join('+')
      if (bad.size) { leaks++; if (leaks <= 3) fails.push(`private card visible at ${label} (hand ${n}): ${[...bad].join(' ')}`) }
    }
    await p.locator('body').click({ position: { x: 5, y: 5 } })
    for (let i = 0; i <= total; i++) {
      await check(`step ${i}/${total}`)
      if (i === Math.floor(total / 3)) { await visibleHex(`poker, step ${i}`); if (shotDir) await p.screenshot({ path: join(shotDir, 'plain-poker.png'), fullPage: true }) }
      await p.keyboard.press('ArrowRight')
      frames++
    }
    await visibleHex('poker, end')
    const done = await p.evaluate(() => document.body.innerText.match(/wins|won/i) !== null)
    if (!done) fails.push('poker: no winner text at the end of the replay')
    await p.keyboard.press('p'); await p.waitForTimeout(800)
    await check('poker full screen'); await visibleHex('poker full screen')
    await p.keyboard.press('Escape'); await p.waitForTimeout(300)
    if (leaks > 3) fails.push(`… private cards visible at ${leaks} steps in total`)
  }
}

// ── mobile ──
const m = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
m.on('pageerror', e => errs.push('mobile pageerror ' + e.message))
m.on('console', x => x.type() === 'error' && errs.push('mobile console ' + x.text()))
await m.goto(url, { waitUntil: 'networkidle' }); await m.waitForSelector('.banner', { timeout: 15000 }).catch(() => {})
const ovC = await m.evaluate(() => document.documentElement.scrollWidth - innerWidth)
let ovP = 0
const mt = m.getByRole('tab', { name: /poker/i })
if (await mt.count()) { await mt.first().click(); await m.waitForTimeout(800); ovP = await m.evaluate(() => document.documentElement.scrollWidth - innerWidth) }
if (ovC > 0 || ovP > 0) fails.push(`mobile overflow chess ${ovC}px poker ${ovP}px`)
await b.close()

if (errs.length) fails.push(`console errors: ${[...new Set(errs)].slice(0, 3).join(' | ')}`)
const sizes = shotDir ? ['plain-chess.png', 'plain-poker.png'].map(f => { try { return `${f} ${Math.round(statSync(join(shotDir, f)).size / 1024)} KB` } catch { return `${f} missing` } }) : []
console.log(JSON.stringify({ ux: fails.length ? 'FAIL' : 'PASS', fails, notes, pokerFramesChecked: frames, mobile: { chess: ovC, poker: ovP }, sizes }, null, 1))
process.exit(fails.length ? 1 : 0)
