import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Waiting } from '../types'

const COLORS: Record<string, string> = { '❓': '#4DA3FF', '✅': '#2EB872', '⚠️': '#FF8C00' }
// The commander's three "stop and wait" messages, as CLAUDE.md §3 spells them.
const MARK = /(❓|✅|⚠️)\s*\**\s*(צריך החלטה|מוכן לשחרור|נתקע)/

const waiting = atom({ plugin: 'commander-waiting', key: 'waiting' } as const, null)

export const findWaiting = (answer: string): Waiting | null => {
  const line = answer.split('\n').find(l => MARK.test(l))
  if (!line) return null
  const icon = line.match(MARK)![1]
  const text = line.replace(/\*/g, '').replace(/\s+/g, ' ').trim()
  return { icon, line: text.length > 90 ? `${text.slice(0, 89)}…` : text }
}

const alert = async ($: EngineInterface, now: Waiting) => {
  await update($, waiting, () => now)
  void $.audio.play({ asset: 'sounds/ping.wav' }).catch(() => undefined)
  const sent = await $.ui.notify(now.line).catch(() => ({ isSent: false }))
  if (!sent.isSent) $.ui.toast(now.line)
}

export const register: Register = on => {
  on('turn.complete', async ($, e, next) => {
    // Main loop only: a subagent's answer is not the commander talking to the owner.
    if (e.agentId === undefined && e.reason === 'answer') {
      const now = findWaiting(e.answer ?? '')
      if (now) await alert($, now)
    }
    return next(e)
  })

  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    const q = (e.input as { questions?: { question?: string }[] }).questions?.[0]?.question ?? 'שאלה'
    await alert($, { icon: '❓', line: `❓ צריך החלטה: ${q}` })
    try {
      return await next(e)
    } finally {
      await update($, waiting, () => null)
    }
  })

  on('prompt.submit', async ($, e, next) => {
    await update($, waiting, () => null)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const now = await read($, waiting)
    if (e.props.hasSurvey || now === null) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text backgroundColor={COLORS[now.icon] ?? '#4DA3FF'} color="black" bold>
          {' המפקד מחכה לך '}
        </Text>
        <Text>{` ${now.line}`}</Text>
      </Box>
    )
  })
}
