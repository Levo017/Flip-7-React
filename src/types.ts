export type ActionKind = 'jom' | 'swap' | 'steal' | 'discard' | 'flip4'

export interface NumberCard {
  id: number
  kind: 'number'
  value: number
  special?: 'zero' | 'unlucky7' | 'lucky13'
}

export interface ModifierCard {
  id: number
  kind: 'modifier'
  /** 'div2' halves the number total; a number is subtracted from it. */
  mod: 'div2' | number
}

export interface ActionCard {
  id: number
  kind: 'action'
  action: ActionKind
}

export type Card = NumberCard | ModifierCard | ActionCard
export type HeldCard = ModifierCard | ActionCard

export type Status = 'active' | 'stayed' | 'busted'

export interface Player {
  id: number
  name: string
  bot: boolean
  total: number
  line: NumberCard[]
  mods: ModifierCard[]
  status: Status
  flip7: boolean
  /** Score of the last finished round, null while a round is in progress. */
  roundScore: number | null
}

export type Task =
  | { t: 'draw'; pid: number; via: 'deal' | 'hit' | 'jom' }
  | { t: 'forceStay'; pid: number }
  | { t: 'flip4'; pid: number; left: number; held: HeldCard[] }
  | { t: 'resolve'; pid: number; card: HeldCard }

export type Prompt =
  | { kind: 'hitStay'; pid: number; mustHit: boolean }
  | { kind: 'target'; pid: number; card: HeldCard; options: number[] }
  | {
      kind: 'pick'
      pid: number
      purpose: 'steal' | 'discard' | 'swap1' | 'swap2'
      options: number[]
      first?: number
    }
  | { kind: 'bonus'; pid: number; options: number[] }

export type Answer = 'hit' | 'stay' | { player: number } | { card: number }

export interface GameState {
  players: Player[]
  deck: Card[]
  discard: Card[]
  dealer: number
  turn: number
  round: number
  phase: 'playing' | 'roundEnd' | 'gameOver'
  roundOver: boolean
  stack: Task[]
  prompt: Prompt | null
  log: string[]
  brutal: boolean
  winner: number | null
  lastCard: number | null
}

export interface PlayerConfig {
  name: string
  bot: boolean
}
