import { spineColor, spineWidth } from './spineUtils.js';

export default function BookSpine({ book, onClick, selected, highlighted, height = 180 }) {
  const color = spineColor(book);
  const width = spineWidth(book);
  const unreviewed = book.needs_review;

  return (
    <div
      data-spine
      onClick={onClick ? (e) => onClick(book, e) : undefined}
      title={book.title || 'Unknown — click to review'}
      style={{
        width,
        height,
        backgroundColor: color,
        flexShrink: 0,
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.12s ease, box-shadow 0.12s ease',
        transform: selected ? 'translateY(-10px)' : undefined,
        boxShadow: highlighted
          ? '0 0 0 2px #f59e0b, 0 0 12px rgba(245,158,11,0.6)'
          : selected
          ? '2px -6px 16px rgba(0,0,0,0.45)'
          : '1px 0 3px rgba(0,0,0,0.25)',
        ...(unreviewed && {
          backgroundImage:
            'repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(255,255,255,0.12) 5px, rgba(255,255,255,0.12) 10px)',
        }),
      }}
      className={onClick ? 'hover:-translate-y-2 hover:shadow-lg' : ''}
    >
      {/* Spine title */}
      <div
        style={{
          position: 'absolute',
          inset: '6px 2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            writingMode: 'vertical-rl',
            fontSize: Math.max(9, Math.min(11, width - 4)),
            color: 'rgba(255,255,255,0.88)',
            fontWeight: 600,
            letterSpacing: '0.03em',
            lineHeight: 1.15,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxHeight: '92%',
            userSelect: 'none',
          }}
        >
          {unreviewed ? '?' : (book.title || '?')}
        </span>
      </div>

      {/* Subtle top highlight */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.18), transparent)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
