import { expect, test } from 'claude-code/testing'
import type { EngineInterface, On } from 'claude-code'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, rows: 40 } } as const

const setup = (on: On) => {
  const fill = { percent: 0 }
  const plays: string[] = []
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { window: 200000, tokens: fill.percent * 2000, percent: fill.percent },
      rateLimits: [],
    },
  }))
  on('audio.play', (_$, e: any) => {
    plays.push(String(e.asset ?? e.clip?.asset))
    return { value: undefined }
  })
  on('turn.complete', () => ({ text: '' }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="engine" />
  })
  return { fill, plays }
}

const endTurn = ($: EngineInterface) =>
  $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })

const bandText = async ($: any) => {
  const ui = await $.ui.mount({ plugin: 'context-alarm', surface: 'terminal', ...BAND })
  const tree = JSON.stringify(await ui.drawn())
  await ui.unmount()
  return tree
}

test('quiet below 60%, yellow 60-80%, orange with one beep above 80%', async ($, on) => {
  const { fill, plays } = setup(on)

  fill.percent = 40
  await endTurn($)
  expect(await bandText($)).not.toContain('Context')

  fill.percent = 65
  await endTurn($)
  const yellow = await bandText($)
  expect(yellow).toContain('Context 65%')
  expect(yellow).toContain('#F5C518')
  expect(plays.length).toBe(0)

  fill.percent = 85
  await endTurn($)
  await endTurn($)
  const orange = await bandText($)
  expect(orange).toContain('Context 85%')
  expect(orange).toContain('#FF8C00')
  expect(orange).toContain('הזיכרון כמעט מלא')
  expect(plays).toEqual(['sounds/alarm.wav'])

  fill.percent = 30
  await endTurn($)
  fill.percent = 90
  await endTurn($)
  expect(plays.length).toBe(2)
})

test('/context reports the current fill', async ($, on) => {
  const { fill } = setup(on)
  on('command.run', () => ({ text: undefined }))
  fill.percent = 72
  const out = await $.command.run({ command: 'context', args: '' } as any)
  expect(out.text).toContain('72%')
})
