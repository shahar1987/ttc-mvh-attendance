import { expect, test } from 'claude-code/testing'
import type { EngineInterface, On } from 'claude-code'

import { findWaiting } from './register'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, rows: 40 } } as const

const setup = (on: On) => {
  const plays: string[] = []
  on('audio.play', (_$, e: any) => {
    plays.push(String(e.asset ?? e.clip?.asset))
    return { value: undefined }
  })
  on('ui.notify', () => ({ value: { isSent: true } }) as any)
  on('turn.complete', () => ({ text: '' }))
  on('prompt.submit', (_$, e: any) => e as any)
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="engine" />
  })
  return { plays }
}

const endTurn = ($: EngineInterface, answer: string) =>
  $.turn.complete({ answer, durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })

const bandText = async ($: any) => {
  const ui = await $.ui.mount({ plugin: 'commander-waiting', surface: 'terminal', ...BAND })
  const tree = JSON.stringify(await ui.drawn())
  await ui.unmount()
  return tree
}

test('finds the three waiting messages and ignores the rest', () => {
  expect(findWaiting('📥 **קיבלתי** — באג')).toBe(null)
  expect(findWaiting('סתם ✅ סיימתי')).toBe(null)
  expect(findWaiting('שלום\n✅ **מוכן לשחרור** — כפתור חדש')?.icon).toBe('✅')
  expect(findWaiting('⚠️ נתקע: הבדיקה נכשלה')?.icon).toBe('⚠️')
  expect(findWaiting('❓ **צריך החלטה** — א או ב?')?.line).toBe('❓ צריך החלטה — א או ב?')
})

test('band + sound on release-ready, cleared by the next prompt', async ($, on) => {
  const { plays } = setup(on)

  await endTurn($, 'עבדתי על זה')
  expect(await bandText($)).not.toContain('המפקד מחכה לך')
  expect(plays.length).toBe(0)

  await endTurn($, '✅ **מוכן לשחרור** — כפתור חדש במסך')
  const band = await bandText($)
  expect(band).toContain('המפקד מחכה לך')
  expect(band).toContain('כפתור חדש')
  expect(plays).toEqual(['sounds/ping.wav'])

  await $.prompt.submit({ text: 'כן' } as any)
  expect(await bandText($)).not.toContain('המפקד מחכה לך')
})
