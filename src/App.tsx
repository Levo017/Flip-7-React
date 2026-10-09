import { useEffect, useState } from 'react'
import { chooseAnswer } from './bot'
import CardView from './CardView'
import {
  FLIP7_BONUS,
  TARGET_SCORE,
  answer,
  cardLabel,
  hasZero,
  newGame,
  nextRound,
  scoreOf,
  step,
} from './engine'
import Rules from './Rules'
import Setup from './Setup'
import type { Answer, GameState, Player } from './types'

const STEP_MS = 650
const BOT_MS = 1000

const PICK_TEXT = {
  steal: 'choose a card to steal',
  discard: 'choose a card to discard',
  swap1: 'choose the first card to swap',
  swap2: "choose another player's card to swap it with",
}

function PromptBar({ game, act }: { game: GameState; act: (a: Answer) => void }) {
  const prompt = game.prompt
  if (!prompt) {
    const flip4 = game.stack.findLast((t) => t.t === 'flip4')
    return (
      <div className="prompt-bar">
        {flip4 ? (
          <>
            <span>
              Flip Four! on <strong>{game.players[flip4.pid].name}</strong> — {flip4.left} to go
            </span>
            {flip4.held.map((c) => (
              <CardView key={c.id} card={c} small />
            ))}
          </>
        ) : (
          <span className="muted">Dealing…</span>
        )}
      </div>
    )
  }

  const chooser = game.players[prompt.pid]
  const name = <strong>{chooser.name}</strong>
  const nameOf = (id: number) => (id === chooser.id ? 'Myself' : game.players[id].name)

  if (chooser.bot) {
    return (
      <div className="prompt-bar">
        {'card' in prompt && <CardView card={prompt.card} small />}
        <span className="muted">{name} is thinking…</span>
      </div>
    )
  }

  switch (prompt.kind) {
    case 'hitStay':
      return (
        <div className="prompt-bar mine">
          <span>
            {name}, you have <strong>{scoreOf(chooser, game.brutal)}</strong>.
            {prompt.mustHit && ' The Zero forces you to keep hitting!'}
          </span>
          <button className="primary" onClick={() => act('hit')}>
            Hit
          </button>
          <button disabled={prompt.mustHit} onClick={() => act('stay')}>
            Stay
          </button>
        </div>
      )
    case 'target':
      return (
        <div className="prompt-bar mine">
          <CardView card={prompt.card} small />
          <span>
            {name}, who gets <strong>{cardLabel(prompt.card)}</strong>?
          </span>
          {prompt.options.map((id) => (
            <button key={id} onClick={() => act({ player: id })}>
              {nameOf(id)}
            </button>
          ))}
        </div>
      )
    case 'pick':
      return (
        <div className="prompt-bar mine">
          <span>
            {name}, {PICK_TEXT[prompt.purpose]} — click a glowing card.
          </span>
        </div>
      )
    case 'bonus':
      return (
        <div className="prompt-bar mine">
          <span>{name}, Flip 7! Take the bonus or take revenge?</span>
          <button className="primary" onClick={() => act({ player: chooser.id })}>
            +{FLIP7_BONUS} for me
          </button>
          {prompt.options
            .filter((id) => id !== chooser.id)
            .map((id) => (
              <button key={id} onClick={() => act({ player: id })}>
                −{FLIP7_BONUS} to {game.players[id].name}
              </button>
            ))}
        </div>
      )
  }
}

function PlayerPanel({ game, player, act }: { game: GameState; player: Player; act: (a: Answer) => void }) {
  const prompt = game.prompt
  const humanPrompt = prompt && !game.players[prompt.pid].bot ? prompt : null
  const pick = humanPrompt?.kind === 'pick' ? humanPrompt : null
  const targetable = humanPrompt?.kind === 'target' && humanPrompt.options.includes(player.id)
  const acting = prompt?.pid === player.id
  const round = player.roundScore ?? scoreOf(player, game.brutal)

  const cls = ['player', player.status, acting && 'acting', targetable && 'targetable'].filter(Boolean).join(' ')

  const renderCards = (cards: Player['line'] | Player['mods']) =>
    cards.map((c) => (
      <CardView
        key={c.id}
        card={c}
        fresh={c.id === game.lastCard}
        selected={pick?.first === c.id}
        pickable={pick?.options.includes(c.id)}
        onClick={() => act({ card: c.id })}
      />
    ))

  return (
    <section className={cls} onClick={targetable ? () => act({ player: player.id }) : undefined}>
      <header>
        <h3>
          {player.name}
          {player.bot && <span className="tag">CPU</span>}
          {game.dealer === player.id && <span className="tag">Dealer</span>}
        </h3>
        <div className="scores">
          <span className="round-score">{round > 0 && game.phase === 'playing' ? `+${round}` : round}</span>
          <span className="total">{player.total}</span>
        </div>
      </header>
      <div className="status-line">
        {player.flip7 ? (
          <span className="badge flip7">FLIP 7!</span>
        ) : player.status === 'busted' ? (
          <span className="badge bust">BUSTED</span>
        ) : player.status === 'stayed' ? (
          <span className="badge stay">STAYED</span>
        ) : (
          <span className="badge">{player.line.length}/7 numbers</span>
        )}
        {hasZero(player) && !player.flip7 && <span className="badge bust">Zero: must Flip 7</span>}
      </div>
      {player.mods.length > 0 && <div className="cards mods">{renderCards(player.mods)}</div>}
      <div className="cards">{renderCards(player.line)}</div>
    </section>
  )
}

function Summary({ game, onNext, onNew }: { game: GameState; onNext: () => void; onNew: () => void }) {
  const over = game.phase === 'gameOver'
  const ranked = [...game.players].sort((a, b) => b.total - a.total)
  return (
    <div className="overlay">
      <div className="modal">
        <h2>{over ? `🏆 ${game.players[game.winner!].name} wins!` : `Round ${game.round} results`}</h2>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Round</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p) => (
              <tr key={p.id} className={p.id === game.winner ? 'winner' : undefined}>
                <td>
                  {p.name}
                  {p.flip7 && ' 🎉'}
                  {p.status === 'busted' && ' 💥'}
                </td>
                <td>{p.roundScore}</td>
                <td>{p.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {over ? (
          <button className="primary" onClick={onNew}>
            New game
          </button>
        ) : (
          <button className="primary" onClick={onNext}>
            Deal round {game.round + 1}
          </button>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [game, setGame] = useState<GameState | null>(null)
  const [fast, setFast] = useState(false)
  const [showRules, setShowRules] = useState(false)

  // Drive the game: auto-step dealing and let CPU players answer their prompts.
  useEffect(() => {
    if (!game || game.phase !== 'playing') return
    const speed = fast ? 0.3 : 1
    const prompt = game.prompt
    if (prompt && !game.players[prompt.pid].bot) return
    const timer = setTimeout(
      () => setGame((g) => (g !== game ? g : prompt ? answer(g, chooseAnswer(g)) : step(g))),
      (prompt ? BOT_MS : STEP_MS) * speed,
    )
    return () => clearTimeout(timer)
  }, [game, fast])

  if (!game) {
    return (
      <>
        <Setup onStart={(players, brutal) => setGame(newGame(players, brutal))} onShowRules={() => setShowRules(true)} />
        {showRules && <Rules onClose={() => setShowRules(false)} />}
      </>
    )
  }

  const act = (a: Answer) => setGame((g) => (g ? answer(g, a) : g))

  return (
    <div className="table">
      <header className="topbar">
        <h1>
          FLIP <span className="seven">7</span> <small>With a Vengeance</small>
        </h1>
        <div className="stats">
          <span>Round {game.round}</span>
          <span>Deck {game.deck.length}</span>
          <span>Discards {game.discard.length}</span>
          <span>Goal {TARGET_SCORE}</span>
          {game.brutal && <span className="brutal">BRUTAL</span>}
        </div>
        <div className="controls">
          <label>
            <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} /> Fast
          </label>
          <button className="ghost" onClick={() => setShowRules(true)}>
            Rules
          </button>
          <button className="ghost" onClick={() => setGame(null)}>
            Quit
          </button>
        </div>
      </header>

      <PromptBar game={game} act={act} />

      <main className="players">
        {game.players.map((p) => (
          <PlayerPanel key={p.id} game={game} player={p} act={act} />
        ))}
      </main>

      <aside className="log" aria-label="Game log">
        {game.log
          .slice(-14)
          .reverse()
          .map((line, i) => (
            <div key={game.log.length - i}>{line}</div>
          ))}
      </aside>

      {game.phase !== 'playing' && (
        <Summary game={game} onNext={() => setGame((g) => g && nextRound(g))} onNew={() => setGame(null)} />
      )}
      {showRules && <Rules onClose={() => setShowRules(false)} />}
    </div>
  )
}
