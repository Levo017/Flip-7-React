export default function Rules({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal rules" onClick={(e) => e.stopPropagation()}>
        <h2>How to play</h2>
        <p>
          Race to <strong>200 points</strong>. Each round everyone is dealt one face-up card, then players
          take turns choosing to <strong>Hit</strong> (flip another card) or <strong>Stay</strong> (lock in
          their cards). Flip a number you already have and you <strong>bust</strong> — zero for the round.
          Collect <strong>7 number cards</strong> to Flip 7: the round ends on the spot and you score +15.
        </p>

        <h3>The deck (108 cards)</h3>
        <p>
          Twelve 13s, twelve 12s, eleven 11s, ten 10s, nine 9s, eight 8s, six 7s, six 6s, five 5s … down to
          one 1 — plus three special numbers, six modifiers and ten actions.
        </p>

        <h3>Special numbers</h3>
        <ul>
          <li>
            <strong>The Zero</strong> — your round is worth 0 unless you Flip 7, and you must keep hitting.
            It counts as one of your seven.
          </li>
          <li>
            <strong>Unlucky 7</strong> — discard all your other number and modifier cards and keep just the
            7. You can't bust when you flip it.
          </li>
          <li>
            <strong>Lucky 13</strong> — you may hold one more 13. Both score and both count toward Flip 7;
            a third 13 busts you.
          </li>
        </ul>
        <p>These effects only apply to whoever holds the card — they can be stolen or swapped away.</p>

        <h3>Modifiers (−2, −4, −6, −8, −10, ÷2)</h3>
        <p>
          Whoever flips one puts it on any player who hasn't busted (themself included, and they must keep
          it if nobody else is left). ÷2 halves the number total, rounded down, before minus cards are
          subtracted. A round score can't drop below 0.
        </p>

        <h3>Actions</h3>
        <p>Whoever flips one plays it on any player who hasn't busted, including players who stayed.</p>
        <ul>
          <li>
            <strong>Just One More!</strong> — that player takes the next card, then must stay.
          </li>
          <li>
            <strong>Flip Four!</strong> — that player takes four cards one at a time, stopping on a bust or
            Flip 7. Actions and modifiers among them resolve afterwards, in order.
          </li>
          <li>
            <strong>Steal</strong> — that player takes any face-up card from another player.
          </li>
          <li>
            <strong>Swap</strong> — that player exchanges any two face-up cards belonging to different
            players. Yes, this can bust people.
          </li>
          <li>
            <strong>Discard</strong> — that player loses one card; whoever played the action picks which.
          </li>
        </ul>
        <p>An action with no valid target is discarded.</p>

        <h3>Scoring</h3>
        <p>Add your numbers → apply ÷2 → subtract minus cards → floor at 0 → add 15 for a Flip 7.</p>

        <h3>Brutal Mode</h3>
        <p>
          Round scores can go negative, modifiers can be dumped on busted players, and a Flip 7 lets you
          either take +15 or give another player −15.
        </p>

        <button className="primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  )
}
