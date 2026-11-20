// List every external href on the page. Usage: node qa/links.mjs <url>
import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage()
await p.goto(process.argv[2] ?? 'http://localhost:4173/', { waitUntil: 'networkidle' }); await p.waitForSelector('.banner')
const hrefs = await p.$$eval('a[href^="http"]', as => [...new Set(as.map(a => a.href))])
console.log(hrefs.join('\n')); await b.close()
