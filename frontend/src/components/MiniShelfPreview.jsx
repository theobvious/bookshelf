import { miniSpineColor, miniSpineWidth } from './spineUtils.js';

export default function MiniShelfPreview({ shelfId, bookCount, height = 56 }) {
  const count = Math.min(bookCount, 60);

  return (
    <div>
      <div className="flex items-end gap-px overflow-hidden" style={{ height }}>
        {count === 0 ? (
          <div className="flex-1 flex items-end justify-center pb-1 text-xs text-stone-300 italic">
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
                  boxShadow: '1px 0 2px rgba(0,0,0,0.2)',
                }}
              />
            );
          })
        )}
      </div>
      {/* Plank */}
      <div
        style={{
          height: 8,
          background: 'linear-gradient(to bottom, #d4aa72, #8b6330)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  );
}
