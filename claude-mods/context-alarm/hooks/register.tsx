import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Fill } from '../types'

const WARN_AT = 60
const ALARM_AT = 80
const YELLOW = '#F5C518'
const ORANGE = '#FF8C00'
const ALARM_TEXT = 'הזיכרון כמעט מלא - כדאי לסכם ולפתוח צ׳אט חדש'

const fill = atom({ plugin: 'context-alarm', key: 'fill' } as const, null)
const hasAlarmed = atom({ plugin: 'context-alarm', key: 'hasAlarmed' } as const, false)

type Level = 'ok' | 'warn' | 'alarm'

export const levelOf = (percent: number): Level =>
  percent >= ALARM_AT ? 'alarm' : percent >= WARN_AT ? 'warn' : 'ok'

export const describe = (now: Fill | null): string => {
  if (now === null) {
    return 'Context: no reading yet (no response since the session started or was compacted).'
  }
  const used = `Context: ${now.percent}% full (${now.tokens.toLocaleString()} of ${now.window.toLocaleString()} tokens).`
  const level = levelOf(now.percent)

  return level === 'alarm' ? `${used}\n${ALARM_TEXT}` : level === 'warn' ? `${used} Getting full.` : used
}

const readFill = async ($: EngineInterface): Promise<Fill | null> => {
  const { context } = await $.session.usage()

  return context.percent === undefined || context.tokens === undefined
    ? null
    : { percent: context.percent, tokens: context.tokens, window: context.window }
}

export const register: Register = on => {
  on('turn.complete', async ($, e, next) => {
    const now = await readFill($)
    await update($, fill, () => now)

    const isAlarm = now !== null && levelOf(now.percent) === 'alarm'
    if (!isAlarm) {
      // Below 80% again (after a compact or /clear): the next crossing alarms anew.
      await update($, hasAlarmed, () => false)
    } else if (!(await read($, hasAlarmed))) {
      await update($, hasAlarmed, () => true)
      void $.audio.play({ asset: 'sounds/alarm.wav' }).catch(() => undefined)
    }

    return next(e)
  })

  // /context is built in: let the built-in breakdown run, then put our reading above it.
  on('command.run', { command: 'context' }, async ($, e, next) => {
    const ran = await next(e)
    const mine = await readFill($)
      .then(async now => {
        await update($, fill, () => now)
        return describe(now)
      })
      .catch(() => undefined)
    if (mine === undefined) {
      return ran
    }

    return { ...ran, text: ran.text ? `${mine}\n\n${ran.text}` : mine }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const now = await read($, fill)
    if (e.props.hasSurvey || now === null || levelOf(now.percent) === 'ok') {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const isAlarm = levelOf(now.percent) === 'alarm'

    return (
      <Box>
        <Text backgroundColor={isAlarm ? ORANGE : YELLOW} color="black" bold>
          {` Context ${now.percent}% `}
        </Text>
        {isAlarm && <Text color={ORANGE}>{` ${ALARM_TEXT}`}</Text>}
      </Box>
    )
  })
}
