// Smoke-check a served build: loads, no errors, real (non-sample) data. Usage: node qa/fresh-check.mjs <url>
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/'
const b = await chromium.launch(); const p = await b.newPage(); const errs = []
p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => m.type() === 'error' && errs.push('console ' + m.text()))
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForSelector('.banner', { timeout: 15000 })
console.log(JSON.stringify({ url, banner: await p.textContent('.banner'), sample: await p.locator('.sample-ribbon').count() > 0, cap: await p.locator('.panel.cap').count() > 0, errs }))
await b.close()
