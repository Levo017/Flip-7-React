import type { CSSProperties } from 'react'
import { cardLabel } from './engine'
import type { Card } from './types'

interface Props {
  card: Card
  small?: boolean
  pickable?: boolean
  selected?: boolean
  fresh?: boolean
  onClick?: () => void
}

function face(card: Card): { big: string; caption?: string; style?: CSSProperties } {
  if (card.kind === 'action') return { big: '⚡', caption: cardLabel(card) }
  if (card.kind === 'modifier') return { big: cardLabel(card), caption: 'modifier' }
  if (card.special === 'zero') return { big: '0', caption: 'The Zero' }
  if (card.special === 'unlucky7') return { big: '7', caption: 'Unlucky' }
  if (card.special === 'lucky13') return { big: '13', caption: 'Lucky' }
  return { big: String(card.value), style: { '--hue': card.value * 27 } as CSSProperties }
}

export default function CardView({ card, small, pickable, selected, fresh, onClick }: Props) {
  const { big, caption, style } = face(card)
  const kind = card.kind === 'number' && card.special ? `special ${card.special}` : card.kind
  const cls = ['card', kind, small && 'small', pickable && 'pickable', selected && 'selected', fresh && 'fresh']
    .filter(Boolean)
    .join(' ')
  const content = (
    <>
      <span className="card-big">{big}</span>
      {caption && <span className="card-caption">{caption}</span>}
    </>
  )
  return pickable ? (
    <button className={cls} style={style} onClick={onClick} aria-label={cardLabel(card)}>
      {content}
    </button>
  ) : (
    <div className={cls} style={style} title={cardLabel(card)}>
      {content}
    </div>
  )
}
