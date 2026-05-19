import { miniSpineColor, miniSpineWidth } from './spineUtils.js';

export default function MiniShelfPreview({ shelfId, bookCount, height = 56 }) {
  const count = Math.min(bookCount, 60);

  return (
    <div>
      <div className="flex items-end gap-px overflow-hidden" style={{ height }}>
        {count === 0 ? (
          <div className="flex-1 flex items-end justify-center pb-2 text-xs text-smoke italic">
            Empty
          </div>
        ) : (
          Array.from({ length: count }, (_, i) => {
            const spineH = Math.round(height * 0.78) + (Math.abs(shelfId * 503 + i * 13) % Math.round(height * 0.18));
            return (
              <div
                key={i}
                style={{
                  width: miniSpineWidth(shelfId, i),
                  height: spineH,
                  backgroundColor: miniSpineColor(shelfId, i),
                  flexShrink: 0,
                  alignSelf: 'flex-end',
                  boxShadow: '1px 0 3px rgba(0,0,0,0.3)',
                }}
              />
            );
          })
        )}
      </div>
      {/* Architectural shelf edge */}
      <div
        style={{
          height: 8,
          background: 'linear-gradient(to bottom, #2a2f42 0%, #181c28 100%)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}
      />
    </div>
  );
}
