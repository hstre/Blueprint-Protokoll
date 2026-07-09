import { chromium } from 'playwright'

const SHOT = process.env.SHOT_DIR ?? '.'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? undefined })
const page = await browser.newPage({ viewport: { width: 1480, height: 940 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()))

const step = async (name, fn) => {
  try {
    await fn()
    console.log('OK  ', name)
  } catch (e) {
    console.log('FAIL', name, '—', e.message.split('\n')[0])
    await page.screenshot({ path: `${SHOT}/fail-${name.replace(/\W+/g, '_')}.png` })
    throw e
  }
}

await step('home lädt', async () => {
  await page.goto('http://127.0.0.1:8123/index.html')
  await page.waitForSelector('.home h1')
})
await page.screenshot({ path: `${SHOT}/01-home.png` })

await step('demo öffnen', async () => {
  await page.click('text=Demo öffnen')
  await page.waitForSelector('.toolbar .title')
})
await page.waitForTimeout(800)
await page.screenshot({ path: `${SHOT}/02-editor.png` })

await step('compiler ist grün', async () => {
  await page.waitForSelector('.validation-bar .ok')
})

await step('node anlegen: Annahme via Strukturpanel', async () => {
  const rows = page.locator('.block-row', { hasText: 'Annahmen' })
  await rows.first().locator('button').click()
  await page.waitForSelector('.modal')
  await page.fill('.modal input', 'Testannahme XYZ')
  await page.fill('.modal textarea >> nth=0', 'Inhalt der Annahme')
  await page.fill('.modal textarea >> nth=1', 'Weil Metastudien es stützen')
  await page.click('.modal button.primary')
  await page.waitForSelector('.modal', { state: 'detached' })
})

await step('adversarial: KI-Angriff auf Claim starten', async () => {
  await page.click('.mode-switch button:has-text("Adversarial")')
  await page.selectOption('.ai-zone select', { index: 1 })
  await page.click('button:has-text("⚔ Angriff")')
  await page.waitForSelector('.attack-card')
})
await page.screenshot({ path: `${SHOT}/03-attack.png` })

await step('offener Angriff blockiert den Compiler', async () => {
  await page.waitForSelector('.validation-bar .err')
})

await step('angriff verteidigen', async () => {
  const card = page.locator('.attack-card').first()
  const defendBtn = card.locator('button:has-text("Verteidigen")')
  if (await defendBtn.isEnabled()) {
    await defendBtn.click()
  } else {
    await card.locator('button:has-text("Präzisieren")').click()
    // refine opens the editor; close it (change tracked separately) then write response
    await page.click('.modal button:has-text("Abbrechen")')
  }
  await card.locator('textarea').fill('Der Einwand greift nicht, weil der Scope explizit Grenzregionen einschließt und der Test T1 genau das prüft.')
  await card.locator('button:has-text("Antwort festhalten")').click()
  await page.waitForSelector('.attack-card.responded')
})

await step('alle angriffe beantwortet → compiler wieder grün', async () => {
  // respond to remaining open attacks if any
  for (let i = 0; i < 5; i++) {
    const open = page.locator('.attack-card:not(.responded)')
    if ((await open.count()) === 0) break
    const card = open.first()
    const defendBtn = card.locator('button:has-text("Verteidigen")')
    if (await defendBtn.isEnabled()) await defendBtn.click()
    else {
      await card.locator('button:has-text("Präzisieren")').click()
      const modal = page.locator('.modal')
      if (await modal.count()) await page.click('.modal button:has-text("Abbrechen")')
    }
    await card.locator('textarea').fill('Beantwortet im Test: Begründung folgt der Protokollregel.')
    await card.locator('button:has-text("Antwort festhalten")').click()
    await page.waitForTimeout(200)
  }
  await page.waitForSelector('.validation-bar .ok', { timeout: 5000 })
})

await step('commit snapshot', async () => {
  await page.click('.toolbar button:has-text("Commit")')
  await page.fill('.modal textarea', 'Erste Revision nach Angriffsabwehr')
  await page.click('.modal button.primary')
  await page.waitForSelector('.modal', { state: 'detached' })
  await page.waitForSelector('.toolbar button:has-text("Snapshots (1)")')
})

await step('einreichen (draft → in_review)', async () => {
  await page.click('.toolbar button:has-text("Einreichen")')
  await page.fill('.modal textarea', 'Bereit für Review')
  await page.click('.modal button.primary')
  await page.waitForSelector('.status-chip.in_review')
})
await page.screenshot({ path: `${SHOT}/04-submitted.png` })

await step('Δ-log hat einträge', async () => {
  const count = await page.locator('.delta-entry').count()
  if (count < 4) throw new Error('zu wenige Δ-Einträge: ' + count)
})

await step('zurück zur übersicht, blueprint persistiert', async () => {
  await page.click('.toolbar button[title="Zur Übersicht"]')
  await page.waitForSelector('.bp-card')
})
await page.screenshot({ path: `${SHOT}/05-home-list.png` })

console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'no page errors')
await browser.close()
