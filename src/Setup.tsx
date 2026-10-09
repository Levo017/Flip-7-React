import { useState } from 'react'
import type { PlayerConfig } from './types'

const MIN_PLAYERS = 2
const MAX_PLAYERS = 8

interface Props {
  onStart: (players: PlayerConfig[], brutal: boolean) => void
  onShowRules: () => void
}

export default function Setup({ onStart, onShowRules }: Props) {
  const [players, setPlayers] = useState<PlayerConfig[]>([
    { name: 'Player 1', bot: false },
    { name: 'Ash', bot: true },
    { name: 'Blaze', bot: true },
    { name: 'Cinder', bot: true },
  ])
  const [brutal, setBrutal] = useState(false)

  const update = (i: number, patch: Partial<PlayerConfig>) =>
    setPlayers((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  const start = () =>
    onStart(
      players.map((p, i) => ({ ...p, name: p.name.trim() || `Player ${i + 1}` })),
      brutal,
    )

  return (
    <div className="setup">
      <h1>
        FLIP <span className="seven">7</span>
        <small>With a Vengeance</small>
      </h1>
      <p className="tagline">Press your luck. Ruin theirs. First to 200 wins.</p>

      <div className="panel">
        <h2>Players</h2>
        {players.map((p, i) => (
          <div className="setup-row" key={i}>
            <input
              value={p.name}
              maxLength={14}
              onChange={(e) => update(i, { name: e.target.value })}
              aria-label={`Player ${i + 1} name`}
            />
            <label>
              <input type="checkbox" checked={p.bot} onChange={(e) => update(i, { bot: e.target.checked })} />
              CPU
            </label>
            <button
              className="ghost"
              disabled={players.length <= MIN_PLAYERS}
              onClick={() => setPlayers((ps) => ps.filter((_, j) => j !== i))}
              aria-label={`Remove player ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          className="ghost"
          disabled={players.length >= MAX_PLAYERS}
          onClick={() => setPlayers((ps) => [...ps, { name: `Player ${ps.length + 1}`, bot: true }])}
        >
          + Add player
        </button>

        <label className="brutal-toggle">
          <input type="checkbox" checked={brutal} onChange={(e) => setBrutal(e.target.checked)} />
          <span>
            <strong>Brutal Mode</strong> — scores can go negative, modifiers can hit busted players, and a
            Flip 7 can cost someone 15 instead.
          </span>
        </label>
      </div>

      <div className="setup-actions">
        <button className="primary" onClick={start}>
          Start game
        </button>
        <button className="ghost" onClick={onShowRules}>
          How to play
        </button>
      </div>
    </div>
  )
}
