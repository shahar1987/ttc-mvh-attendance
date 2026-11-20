export type Waiting = { icon: string; line: string }

declare module 'claude-code' {
  interface PluginState {
    'commander-waiting': { waiting: Waiting | null }
  }
}
