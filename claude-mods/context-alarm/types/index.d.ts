export type Fill = { percent: number; tokens: number; window: number }

declare module 'claude-code' {
  interface PluginState {
    'context-alarm': { fill: Fill | null; hasAlarmed: boolean }
  }
}
