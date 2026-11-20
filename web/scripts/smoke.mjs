// npm run test:smoke — build, then server-render the page with the sample and with broken inputs.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

execSync('npm run build', { stdio: 'inherit' })

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
let failed = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`); if (!ok) failed++ }
try {
  const React = await import('react')
  const { renderToString } = await import('react-dom/server')
  const { Page, validate } = await vite.ssrLoadModule('/src/App.tsx')
  const sample = JSON.parse(readFileSync(new URL('../public/result.sample.json', import.meta.url), 'utf8'))
  const render = (data, sampleFlag) => renderToString(React.createElement(Page, { data, sample: sampleFlag })).replaceAll('<!-- -->', '')

  const html = render(validate(sample), true)
  check('sample renders', html.includes('Deep Thought') && html.includes('4.00 USDC') && html.includes('referee-attested'))
  check('sample shows SAMPLE DATA', html.includes('SAMPLE DATA'))
  check('no raw base units', !html.includes('4000000'))

  check('empty result rejected', validate({}) === null && validate(null) === null && validate('') === null)
  check('partial result rejected', validate({ bots: [], pgn: '' }) === null)
  check('bad pgn rejected', validate({ ...sample, pgn: '1. e5 e4 2. Kxe8' }) === null)

  const noBase = validate({ ...sample, explorerBaseUrl: undefined, balances: undefined })
  const h2 = render(noBase, false)
  check('missing explorer base + balances render', h2.includes('https://explorer.testnet.arc.io/tx/') && h2.includes('LIVE ON ARC'))

  const short = render(validate({ ...sample, pgn: '', plies: 0 }), false)
  check('zero-move game renders', short.includes('ply 0/0'))
  let pgn = ''; for (let i = 1; i <= 150; i++) pgn += `${2 * i - 1}. Nf3 Nf6 ${2 * i}. Ng1 Ng8 `
  check('300-ply game renders', render(validate({ ...sample, pgn: pgn.trim(), plies: 600 }), false).includes('ply 0/600'))

  const fenB = '[SetUp "1"]\n[FEN "8/8/8/4k3/8/8/8/3QK3 b - - 0 30"]\n\n30... Kf4 31. Qd5 Ke3 1-0'
  const hb = render(validate({ ...sample, pgn: fenB, plies: 4 }), false)
  check('black-to-move FEN numbers from 30', hb.includes('>30.<') && hb.includes('>31.<') && hb.includes('Move 30, black Kf4') && !hb.includes('>1.<'))
  const fenW = '[SetUp "1"]\n[FEN "8/8/8/4k3/8/8/8/3QK3 w - - 0 1"]\n\n1. Qd3 Ke6 2. Kd2 Ke5 3. Ke3 Kf6 4. Qd5 Ke7 5. Ke4 Kf8 6. Kf5 Ke7 7. Kg6 Ke8 8. Kf6 Kf8 9. Qf7# 1-0'
  check('17-ply demo FEN renders', render(validate({ ...sample, pgn: fenW, plies: 17 }), false).includes('ply 0/17'))
} catch (e) {
  check('smoke run', false, e?.stack ?? String(e))
} finally {
  await vite.close()
}
if (failed) { console.error(`${failed} smoke check(s) failed`); process.exit(1) }
console.log('smoke: all green')
