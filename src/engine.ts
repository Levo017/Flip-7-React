import type {
  ActionKind,
  Answer,
  Card,
  GameState,
  HeldCard,
  NumberCard,
  Player,
  PlayerConfig,
} from './types'

export const TARGET_SCORE = 200
export const FLIP7_BONUS = 15

const ACTION_NAMES: Record<ActionKind, string> = {
  jom: 'Just One More!',
  swap: 'Swap',
  steal: 'Steal',
  discard: 'Discard',
  flip4: 'Flip Four!',
}

export function cardLabel(c: Card): string {
  if (c.kind === 'action') return ACTION_NAMES[c.action]
  if (c.kind === 'modifier') return c.mod === 'div2' ? '÷2' : `−${c.mod}`
  if (c.special === 'zero') return 'The Zero'
  if (c.special === 'unlucky7') return 'Unlucky 7'
  if (c.special === 'lucky13') return 'Lucky 13'
  return String(c.value)
}

/** The 108-card deck: 89 numbers, 3 special numbers, 6 modifiers, 10 actions. */
export function buildDeck(): Card[] {
  const cards: Card[] = []
  let id = 0
  for (let v = 1; v <= 13; v++) {
    const count = v === 7 ? 6 : v === 13 ? 12 : v
    for (let i = 0; i < count; i++) cards.push({ id: id++, kind: 'number', value: v })
  }
  cards.push({ id: id++, kind: 'number', value: 0, special: 'zero' })
  cards.push({ id: id++, kind: 'number', value: 7, special: 'unlucky7' })
  cards.push({ id: id++, kind: 'number', value: 13, special: 'lucky13' })
  for (const mod of [2, 4, 6, 8, 10, 'div2'] as const) cards.push({ id: id++, kind: 'modifier', mod })
  for (const action of ['jom', 'swap', 'steal', 'discard', 'flip4'] as const) {
    for (let i = 0; i < 2; i++) cards.push({ id: id++, kind: 'action', action })
  }
  return cards
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** A line busts on a duplicate number; Lucky 13 allows one extra 13. */
export function isBust(line: NumberCard[]): boolean {
  const counts = new Map<number, number>()
  for (const c of line) counts.set(c.value, (counts.get(c.value) ?? 0) + 1)
  const lucky = line.some((c) => c.special === 'lucky13')
  for (const [value, n] of counts) {
    if (n > (value === 13 && lucky ? 2 : 1)) return true
  }
  return false
}

export function hasZero(p: Pick<Player, 'line'>): boolean {
  return p.line.some((c) => c.special === 'zero')
}

/** Numbers, then ÷2 (rounded down), then minus modifiers, then the Flip 7 bonus. */
export function scoreOf(
  p: Pick<Player, 'line' | 'mods' | 'status' | 'flip7'>,
  brutal: boolean,
  bonus = true,
): number {
  const dead = p.status === 'busted' || (hasZero(p) && !p.flip7)
  let n = dead ? 0 : p.line.reduce((sum, c) => sum + c.value, 0)
  if (p.mods.some((m) => m.mod === 'div2')) n = Math.floor(n / 2)
  for (const m of p.mods) if (m.mod !== 'div2') n -= m.mod
  if (!brutal) n = Math.max(0, n)
  if (p.flip7 && bonus) n += FLIP7_BONUS
  return n
}

export function cardsOf(p: Player): Card[] {
  return [...p.mods, ...p.line]
}

export function findOwner(players: Player[], cardId: number): Player | undefined {
  return players.find((p) => cardsOf(p).some((c) => c.id === cardId))
}

export function giveCard(p: Player, card: Card) {
  if (card.kind === 'number') p.line.push(card)
  else if (card.kind === 'modifier') p.mods.push(card)
}

export function takeCard(players: Player[], cardId: number): { card: Card; owner: Player } {
  const owner = findOwner(players, cardId)!
  const card = cardsOf(owner).find((c) => c.id === cardId)!
  owner.line = owner.line.filter((c) => c.id !== cardId)
  owner.mods = owner.mods.filter((c) => c.id !== cardId)
  return { card, owner }
}

const live = (s: GameState) => s.players.filter((p) => p.status !== 'busted')

export function stealOptions(s: GameState, pid: number): number[] {
  return live(s)
    .filter((p) => p.id !== pid)
    .flatMap((p) => cardsOf(p).map((c) => c.id))
}

export function swapFirstOptions(s: GameState): number[] {
  const holders = live(s).filter((p) => cardsOf(p).length > 0)
  return holders.length < 2 ? [] : holders.flatMap((p) => cardsOf(p).map((c) => c.id))
}

export function swapSecondOptions(s: GameState, first: number): number[] {
  const owner = findOwner(s.players, first)
  return live(s)
    .filter((p) => p !== owner)
    .flatMap((p) => cardsOf(p).map((c) => c.id))
}

function validReceivers(s: GameState, card: HeldCard): number[] {
  const ids = live(s).map((p) => p.id)
  if (card.kind === 'modifier') return s.brutal ? s.players.map((p) => p.id) : ids
  switch (card.action) {
    case 'jom':
    case 'flip4':
      return ids
    case 'steal':
      return ids.filter((id) => stealOptions(s, id).length > 0)
    case 'swap':
      return swapFirstOptions(s).length > 0 ? ids : []
    case 'discard':
      return ids.filter((id) => cardsOf(s.players[id]).length > 0)
  }
}

function log(s: GameState, msg: string) {
  s.log.push(msg)
  if (s.log.length > 80) s.log.shift()
}

function drawCard(s: GameState): Card | null {
  if (s.deck.length === 0 && s.discard.length > 0) {
    s.deck = shuffle(s.discard)
    s.discard = []
    log(s, 'The deck ran out — the discards are shuffled into a new deck.')
  }
  return s.deck.pop() ?? null
}

function flushStack(s: GameState) {
  for (const t of s.stack) {
    if (t.t === 'resolve') s.discard.push(t.card)
    if (t.t === 'flip4') s.discard.push(...t.held)
  }
  s.stack = []
}

function finalizeRound(s: GameState, penaltyTo: number | null) {
  for (const p of s.players) {
    p.roundScore = scoreOf(p, s.brutal, penaltyTo === null)
    if (p.id === penaltyTo) p.roundScore -= FLIP7_BONUS
    p.total += p.roundScore
  }
  s.prompt = null
  const best = Math.max(...s.players.map((p) => p.total))
  const leaders = s.players.filter((p) => p.total === best)
  if (best >= TARGET_SCORE && leaders.length === 1) {
    s.phase = 'gameOver'
    s.winner = leaders[0].id
    log(s, `${leaders[0].name} wins the game with ${best} points!`)
  } else {
    s.phase = 'roundEnd'
    if (best >= TARGET_SCORE) log(s, `Tied at ${best} — play another round to break the tie.`)
  }
}

function endRound(s: GameState) {
  flushStack(s)
  s.roundOver = true
  const flipper = s.players.find((p) => p.flip7)
  if (s.brutal && flipper) {
    s.prompt = { kind: 'bonus', pid: flipper.id, options: s.players.map((p) => p.id) }
    return
  }
  finalizeRound(s, null)
}

function bust(s: GameState, p: Player) {
  s.discard.push(...p.line, ...p.mods)
  p.line = []
  p.mods = []
  p.status = 'busted'
  log(s, `💥 ${p.name} busts!`)
}

function checkStatus(s: GameState, p: Player) {
  if (p.status === 'busted' || s.roundOver) return
  if (isBust(p.line)) bust(s, p)
  else if (p.line.length >= 7) {
    p.flip7 = true
    log(s, `🎉 ${p.name} FLIPS 7! The round ends immediately.`)
    endRound(s)
  }
}

/** Hand a freshly flipped card to a player. Actions/modifiers go to `hold` during a Flip Four. */
function receive(s: GameState, p: Player, card: Card, hold: HeldCard[] | null) {
  s.lastCard = card.id
  log(s, `${p.name} flips ${cardLabel(card)}.`)
  if (card.kind !== 'number') {
    if (hold) hold.push(card)
    else s.stack.push({ t: 'resolve', pid: p.id, card })
    return
  }
  if (card.special === 'unlucky7' && cardsOf(p).length > 0) {
    s.discard.push(...p.line, ...p.mods)
    p.line = []
    p.mods = []
    log(s, `Unlucky 7! ${p.name} discards everything else.`)
  }
  p.line.push(card)
  checkStatus(s, p)
}

function applyTarget(s: GameState, pid: number, card: HeldCard, targetId: number) {
  const from = s.players[pid]
  const target = s.players[targetId]
  const who = target === from ? 'themself' : target.name
  if (card.kind === 'modifier') {
    target.mods.push(card)
    log(s, `${from.name} puts ${cardLabel(card)} on ${who}.`)
    return
  }
  s.discard.push(card)
  log(s, `${from.name} plays ${cardLabel(card)} on ${who}.`)
  switch (card.action) {
    case 'jom':
      s.stack.push({ t: 'forceStay', pid: targetId })
      s.stack.push({ t: 'draw', pid: targetId, via: 'jom' })
      break
    case 'flip4':
      s.stack.push({ t: 'flip4', pid: targetId, left: 4, held: [] })
      break
    case 'steal':
      s.prompt = { kind: 'pick', pid: targetId, purpose: 'steal', options: stealOptions(s, targetId) }
      break
    case 'swap':
      s.prompt = { kind: 'pick', pid: targetId, purpose: 'swap1', options: swapFirstOptions(s) }
      break
    case 'discard':
      s.prompt = {
        kind: 'pick',
        pid,
        purpose: 'discard',
        options: cardsOf(target).map((c) => c.id),
      }
      break
  }
}

function nextTurn(s: GameState) {
  const n = s.players.length
  for (let i = 1; i <= n; i++) {
    const p = s.players[(s.turn + i) % n]
    if (p.status === 'active') {
      s.turn = p.id
      s.prompt = { kind: 'hitStay', pid: p.id, mustHit: hasZero(p) }
      return
    }
  }
  endRound(s)
}

function startRound(s: GameState) {
  for (const p of s.players) {
    s.discard.push(...p.line, ...p.mods)
    p.line = []
    p.mods = []
    p.status = 'active'
    p.flip7 = false
    p.roundScore = null
  }
  const n = s.players.length
  s.round++
  s.dealer = (s.dealer + 1) % n
  s.turn = s.dealer
  s.phase = 'playing'
  s.roundOver = false
  s.prompt = null
  s.lastCard = null
  s.stack = []
  for (let i = n; i >= 1; i--) s.stack.push({ t: 'draw', pid: (s.dealer + i) % n, via: 'deal' })
  log(s, `— Round ${s.round} — ${s.players[s.dealer].name} deals.`)
}

export function newGame(configs: PlayerConfig[], brutal: boolean): GameState {
  const s: GameState = {
    players: configs.map((c, id) => ({
      id,
      name: c.name,
      bot: c.bot,
      total: 0,
      line: [],
      mods: [],
      status: 'active',
      flip7: false,
      roundScore: null,
    })),
    deck: shuffle(buildDeck()),
    discard: [],
    dealer: Math.floor(Math.random() * configs.length),
    turn: 0,
    round: 0,
    phase: 'playing',
    roundOver: false,
    stack: [],
    prompt: null,
    log: [],
    brutal,
    winner: null,
    lastCard: null,
  }
  startRound(s)
  return s
}

export function nextRound(s0: GameState): GameState {
  if (s0.phase !== 'roundEnd') return s0
  const s = structuredClone(s0)
  startRound(s)
  return s
}

/** Advance the game by one automatic step. Returns the same object when waiting on a prompt. */
export function step(s0: GameState): GameState {
  if (s0.phase !== 'playing' || s0.prompt || s0.roundOver) return s0
  const s = structuredClone(s0)
  const task = s.stack.pop()
  if (!task) {
    nextTurn(s)
    return s
  }
  const p = s.players[task.pid]
  switch (task.t) {
    case 'draw': {
      if (task.via === 'deal' ? p.status !== 'active' : p.status === 'busted') break
      const card = drawCard(s)
      if (!card) {
        log(s, 'No cards left anywhere — the round ends.')
        endRound(s)
        break
      }
      receive(s, p, card, null)
      break
    }
    case 'forceStay':
      if (p.status === 'active') {
        p.status = 'stayed'
        log(s, `${p.name} must stay.`)
      }
      break
    case 'flip4': {
      if (p.status === 'busted') {
        s.discard.push(...task.held)
        break
      }
      if (task.left === 0) {
        for (const card of task.held.toReversed()) s.stack.push({ t: 'resolve', pid: p.id, card })
        break
      }
      const card = drawCard(s)
      if (!card) {
        s.discard.push(...task.held)
        log(s, 'No cards left anywhere — the round ends.')
        endRound(s)
        break
      }
      receive(s, p, card, task.held)
      if (s.roundOver || s.players[task.pid].status === 'busted') s.discard.push(...task.held)
      else s.stack.push({ ...task, left: task.left - 1 })
      break
    }
    case 'resolve': {
      const options = p.status === 'busted' ? [] : validReceivers(s, task.card)
      if (options.length === 0) {
        s.discard.push(task.card)
        log(s, `${cardLabel(task.card)} has no valid target and is discarded.`)
      } else if (options.length === 1) {
        applyTarget(s, p.id, task.card, options[0])
      } else {
        s.prompt = { kind: 'target', pid: p.id, card: task.card, options }
      }
      break
    }
  }
  return s
}

/** Apply a player's response to the current prompt. Invalid answers are ignored. */
export function answer(s0: GameState, a: Answer): GameState {
  const prompt = s0.prompt
  if (!prompt) return s0
  const s = structuredClone(s0)
  const p = s.players[prompt.pid]
  switch (prompt.kind) {
    case 'hitStay':
      if (a === 'hit') {
        s.prompt = null
        s.stack.push({ t: 'draw', pid: p.id, via: 'hit' })
      } else if (a === 'stay' && !prompt.mustHit) {
        s.prompt = null
        p.status = 'stayed'
        log(s, `${p.name} stays with ${scoreOf(p, s.brutal)}.`)
      } else return s0
      return s
    case 'target':
      if (typeof a !== 'object' || !('player' in a) || !prompt.options.includes(a.player)) return s0
      s.prompt = null
      applyTarget(s, p.id, prompt.card, a.player)
      return s
    case 'bonus':
      if (typeof a !== 'object' || !('player' in a) || !prompt.options.includes(a.player)) return s0
      if (a.player === p.id) log(s, `${p.name} takes the +${FLIP7_BONUS} Flip 7 bonus.`)
      else log(s, `${p.name} hits ${s.players[a.player].name} with −${FLIP7_BONUS} instead of taking the bonus.`)
      finalizeRound(s, a.player === p.id ? null : a.player)
      return s
    case 'pick': {
      if (typeof a !== 'object' || !('card' in a) || !prompt.options.includes(a.card)) return s0
      s.prompt = null
      if (prompt.purpose === 'swap1') {
        s.prompt = {
          kind: 'pick',
          pid: p.id,
          purpose: 'swap2',
          first: a.card,
          options: swapSecondOptions(s, a.card),
        }
      } else if (prompt.purpose === 'swap2') {
        const x = takeCard(s.players, prompt.first!)
        const y = takeCard(s.players, a.card)
        giveCard(x.owner, y.card)
        giveCard(y.owner, x.card)
        log(
          s,
          `${p.name} swaps ${x.owner.name}'s ${cardLabel(x.card)} with ${y.owner.name}'s ${cardLabel(y.card)}.`,
        )
        // Resolve busts for both before a Flip 7 can end the round.
        for (const o of [x.owner, y.owner]) if (isBust(o.line)) bust(s, o)
        checkStatus(s, x.owner)
        checkStatus(s, y.owner)
      } else if (prompt.purpose === 'steal') {
        const { card, owner } = takeCard(s.players, a.card)
        giveCard(p, card)
        log(s, `${p.name} steals ${cardLabel(card)} from ${owner.name}.`)
        checkStatus(s, p)
      } else {
        const { card, owner } = takeCard(s.players, a.card)
        s.discard.push(card)
        log(s, `${p.name} discards ${owner.name}'s ${cardLabel(card)}.`)
      }
      return s
    }
  }
}
