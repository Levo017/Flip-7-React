import {
  cardsOf,
  giveCard,
  isBust,
  scoreOf,
  swapSecondOptions,
  takeCard,
} from './engine'
import type { Answer, Card, GameState, NumberCard, Player } from './types'

/** Round score a player is on track for, treating an illegal line as a bust. */
function projected(p: Player, brutal: boolean): number {
  if (p.status !== 'busted' && isBust(p.line)) return 0
  const flip7 = p.flip7 || (p.status !== 'busted' && p.line.length >= 7)
  return scoreOf({ ...p, flip7 }, brutal) + p.line.length * 0.5
}

/** How good the table looks for `me`: own projection minus the average opponent's. */
function utility(players: Player[], me: number, brutal: boolean): number {
  const others = players.filter((p) => p.id !== me)
  const avg = others.reduce((sum, p) => sum + projected(p, brutal), 0) / others.length
  return projected(players[me], brutal) - avg
}

function simulate(s: GameState, me: number, mutate: (players: Player[]) => void): number {
  const players = structuredClone(s.players)
  mutate(players)
  return utility(players, me, s.brutal)
}

function best<T>(items: T[], score: (item: T) => number): T {
  let top = items[0]
  let topScore = -Infinity
  for (const item of items) {
    const v = score(item)
    if (v > topScore) {
      top = item
      topScore = v
    }
  }
  return top
}

/** Unseen cards the next flip comes from (the discards, if the deck is about to be reshuffled). */
function pool(s: GameState): Card[] {
  return s.deck.length > 0 ? s.deck : s.discard
}

function withCard(p: Player, card: NumberCard): NumberCard[] {
  return card.special === 'unlucky7' ? [card] : [...p.line, card]
}

function bustChance(s: GameState, p: Player): number {
  const cards = pool(s)
  if (cards.length === 0) return 0
  const busts = cards.filter((c) => c.kind === 'number' && isBust(withCard(p, c))).length
  return busts / cards.length
}

/** Expected round score after one more flip. */
function hitValue(s: GameState, p: Player): number {
  const cards = pool(s)
  if (cards.length === 0) return 0
  const current = scoreOf(p, s.brutal)
  let sum = 0
  for (const c of cards) {
    if (c.kind !== 'number') {
      sum += current
      continue
    }
    const line = withCard(p, c)
    if (isBust(line)) continue
    const mods = c.special === 'unlucky7' ? [] : p.mods
    sum += scoreOf({ line, mods, status: p.status, flip7: line.length >= 7 }, s.brutal)
  }
  return sum / cards.length
}

function swapUtility(s: GameState, me: number, a: number, b: number): number {
  return simulate(s, me, (players) => {
    const x = takeCard(players, a)
    const y = takeCard(players, b)
    giveCard(x.owner, y.card)
    giveCard(y.owner, x.card)
  })
}

export function chooseAnswer(s: GameState): Answer {
  const prompt = s.prompt!
  const me = s.players[prompt.pid]
  const standing = (p: Player) => p.total + projected(p, s.brutal)

  switch (prompt.kind) {
    case 'hitStay': {
      if (prompt.mustHit) return 'hit'
      const current = scoreOf(me, s.brutal)
      return current === 0 || hitValue(s, me) > current ? 'hit' : 'stay'
    }

    case 'bonus': {
      const rival = best(
        s.players.filter((p) => p.id !== me.id),
        (p) => p.total + scoreOf(p, s.brutal),
      )
      const mine = me.total + scoreOf(me, s.brutal)
      return { player: rival.total + scoreOf(rival, s.brutal) >= mine ? rival.id : me.id }
    }

    case 'target': {
      const { card, options } = prompt
      const opponents = options.filter((id) => id !== me.id)
      if (card.kind === 'modifier') {
        const pickFrom = opponents.length > 0 ? opponents : options
        return {
          player: best(
            pickFrom,
            (id) =>
              simulate(s, me.id, (players) => players[id].mods.push(card)) +
              standing(s.players[id]) * 0.01,
          ),
        }
      }
      switch (card.action) {
        case 'jom':
        case 'flip4': {
          const flips = card.action === 'flip4' ? 4 : 1
          const value = (id: number) => {
            const p = s.players[id]
            const risk = 1 - (1 - bustChance(s, p)) ** flips
            const swing = risk * projected(p, s.brutal) - (1 - risk) * 8 * flips
            if (id !== me.id) return swing + standing(p) * 0.01
            // Just One More! on yourself also ends your round early.
            return -swing - (card.action === 'jom' && me.status === 'active' ? 5 : 0)
          }
          return { player: best(options, value) }
        }
        case 'steal': {
          if (options.includes(me.id)) {
            const base = utility(s.players, me.id, s.brutal)
            const gains = s.players
              .filter((p) => p.id !== me.id && p.status !== 'busted')
              .flatMap((p) => cardsOf(p))
              .map((c) => simulate(s, me.id, (players) => giveCard(players[me.id], takeCard(players, c.id).card)))
            if (opponents.length === 0 || Math.max(...gains) >= base - 1) return { player: me.id }
          }
          return { player: best(opponents, (id) => -standing(s.players[id])) }
        }
        case 'swap':
          return { player: options.includes(me.id) ? me.id : options[0] }
        case 'discard':
          return {
            player: best(options, (id) =>
              Math.max(
                ...cardsOf(s.players[id]).map((c) =>
                  simulate(s, me.id, (players) => void takeCard(players, c.id)),
                ),
              ),
            ),
          }
      }
      // Every action returns above; this only satisfies the fallthrough check.
      return { player: options[0] }
    }

    case 'pick': {
      const { options, purpose } = prompt
      if (purpose === 'steal') {
        return {
          card: best(options, (id) =>
            simulate(s, me.id, (players) => giveCard(players[me.id], takeCard(players, id).card)),
          ),
        }
      }
      if (purpose === 'discard') {
        return { card: best(options, (id) => simulate(s, me.id, (players) => void takeCard(players, id))) }
      }
      if (purpose === 'swap2') {
        return { card: best(options, (id) => swapUtility(s, me.id, prompt.first!, id)) }
      }
      return {
        card: best(options, (a) =>
          Math.max(...swapSecondOptions(s, a).map((b) => swapUtility(s, me.id, a, b))),
        ),
      }
    }
  }
}
