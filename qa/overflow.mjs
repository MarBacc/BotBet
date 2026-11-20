import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
await p.goto(process.argv[2] ?? 'http://localhost:4173/', { waitUntil: 'networkidle' }); await p.waitForSelector('.banner')
console.log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && ![...e.children].some(c => c.getBoundingClientRect().right > innerWidth + 1)).slice(0, 8).map(e => ({ tag: e.tagName, cls: e.className, right: Math.round(e.getBoundingClientRect().right), text: (e.textContent || '').slice(0, 50) }))), null, 1))
await b.close()
