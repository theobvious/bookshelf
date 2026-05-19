import { useEffect, useState, useCallback } from 'react';
import { getRecommendations, updateRecommendation, recommendBook, getShelfRecommendations, clearRecommendations } from '../api.js';

function CoverPlaceholder() {
  return <div className="w-10 h-14 rounded-lg bg-float flex-shrink-0" />;
}

function RecommendationCard({ rec, onAcquired, onDismissed, onRestore }) {
  const [acquiringLoading, setAcquiringLoading] = useState(false);
  const [dismissingLoading, setDismissingLoading] = useState(false);

  async function handleAcquire() {
    setAcquiringLoading(true);
    try {
      const updated = await updateRecommendation(rec.id, { acquired: true });
      onAcquired(updated);
    } finally {
      setAcquiringLoading(false);
    }
  }

  async function handleDismiss() {
    setDismissingLoading(true);
    try {
      const updated = await updateRecommendation(rec.id, { dismissed: true });
      onDismissed(updated);
    } finally {
      setDismissingLoading(false);
    }
  }

  async function handleRestore() {
    setDismissingLoading(true);
    try {
      const updated = await updateRecommendation(rec.id, { dismissed: false });
      onRestore(updated);
    } finally {
      setDismissingLoading(false);
    }
  }

  return (
    <div className={`flex gap-3 p-3.5 rounded-2xl border transition-colors ${
      rec.dismissed
        ? 'border-line bg-raised opacity-50'
        : 'border-line bg-raised hover:border-edge'
    }`}>
      {rec.cover_url ? (
        <img src={rec.cover_url} alt="" className="w-10 h-14 object-cover rounded-lg flex-shrink-0" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }} />
      ) : (
        <CoverPlaceholder />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm leading-snug text-chalk">{rec.title}</p>
        {rec.author && <p className="text-xs text-mist mt-0.5">{rec.author}</p>}
        {rec.reason && <p className="text-xs text-smoke mt-1.5 leading-relaxed">{rec.reason}</p>}
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        {rec.dismissed ? (
          <button
            onClick={handleRestore}
            disabled={dismissingLoading}
            className="text-xs px-2.5 py-1 rounded-lg border border-line hover:bg-float text-mist disabled:opacity-40 whitespace-nowrap transition-colors"
          >
            {dismissingLoading ? 'Restoring…' : 'Restore'}
          </button>
        ) : (
          <>
            {rec.acquired ? (
              <span className="text-xs px-2.5 py-1 rounded-lg bg-ink-900 border border-ink-800 text-ink-300 font-medium whitespace-nowrap">
                Acquired
              </span>
            ) : (
              <button
                onClick={handleAcquire}
                disabled={acquiringLoading}
                className="text-xs px-2.5 py-1 rounded-lg bg-ink-900 border border-ink-800 text-ink-300 hover:bg-ink-800/60 disabled:opacity-40 whitespace-nowrap transition-colors"
              >
                {acquiringLoading ? 'Saving…' : 'Mark acquired'}
              </button>
            )}
            <button
              onClick={handleDismiss}
              disabled={dismissingLoading}
              className="text-xs px-2 py-1 rounded-lg text-smoke hover:text-mist hover:bg-float disabled:opacity-40 whitespace-nowrap transition-colors"
            >
              {dismissingLoading ? '…' : 'Dismiss'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function RecommendationsPage() {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDismissed, setShowDismissed] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState(null);
  const [clearing, setClearing] = useState(false);

  const fetchRecs = useCallback(async (includeDismissed) => {
    setLoading(true);
    try {
      const params = includeDismissed ? { dismissed: true } : { dismissed: false };
      const data = await getRecommendations(params);
      setRecs(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecs(showDismissed);
  }, [showDismissed, fetchRecs]);

  function handleAcquired(updated) {
    setRecs((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  function handleDismissed(updated) {
    if (!showDismissed) {
      setRecs((prev) => prev.filter((r) => r.id !== updated.id));
    } else {
      setRecs((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    }
  }

  function handleRestore(updated) {
    if (showDismissed) {
      setRecs((prev) => prev.filter((r) => r.id !== updated.id));
    } else {
      setRecs((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    }
  }

  async function handleRegenerate(group) {
    setRegeneratingId(group.key);
    try {
      if (group.source_shelf_id) {
        await getShelfRecommendations(group.source_shelf_id, true);
      } else {
        await recommendBook(group.source_book_id, true);
      }
      await fetchRecs(showDismissed);
    } finally {
      setRegeneratingId(null);
    }
  }

  const groupMap = {};
  recs.forEach((rec) => {
    const key = rec.source_shelf_id ? `shelf:${rec.source_shelf_id}` : `book:${rec.source_book_id}`;
    if (!groupMap[key]) {
      groupMap[key] = {
        key,
        source_book_id: rec.source_book_id,
        source_shelf_id: rec.source_shelf_id,
        label: rec.source_shelf_id
          ? rec.source_shelf_label || 'Shelf'
          : rec.source_book_title || 'Unknown book',
        sublabel: rec.source_shelf_id ? null : rec.source_book_author,
        isShelf: !!rec.source_shelf_id,
        items: [],
      };
    }
    groupMap[key].items.push(rec);
  });
  const groupList = Object.values(groupMap);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-chalk">Reading List</h1>
          <p className="text-mist text-sm mt-1">Books recommended based on your catalog.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDismissed((prev) => !prev)}
            className={`text-xs px-3 py-1.5 rounded-xl border transition-colors whitespace-nowrap ${
              showDismissed
                ? 'border-edge bg-float text-chalk'
                : 'border-line text-mist hover:bg-raised'
            }`}
          >
            {showDismissed ? 'Hide dismissed' : 'Show dismissed'}
          </button>
          {recs.length > 0 && (
            <button
              disabled={clearing}
              onClick={async () => {
                if (!confirm('Clear all recommendations? This cannot be undone.')) return;
                setClearing(true);
                try {
                  await clearRecommendations();
                  setRecs([]);
                } finally {
                  setClearing(false);
                }
              }}
              className="text-xs px-3 py-1.5 rounded-xl border border-ember-border hover:bg-ember-bg text-ember disabled:opacity-40 whitespace-nowrap transition-colors"
            >
              {clearing ? 'Clearing…' : 'Clear all'}
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 rounded-full border-2 border-ink-700 border-t-ink-300 animate-spin" />
        </div>
      )}

      {!loading && groupList.length === 0 && (
        <div className="text-center py-24 space-y-2">
          <p className="font-display italic text-2xl text-smoke">
            {showDismissed ? 'No dismissed recommendations' : 'Nothing here yet'}
          </p>
          {!showDismissed && (
            <p className="text-sm text-mist">
              Click "Recommend books" on a shelf, or open any book spine and choose "Recommend similar".
            </p>
          )}
        </div>
      )}

      {!loading && groupList.map((group) => (
        <div key={group.key} className="space-y-2">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-line">
            <div>
              <p className="text-xs text-smoke uppercase tracking-widest mb-0.5">
                {group.isShelf ? 'Because of your shelf' : 'Because you have'}
              </p>
              <h2 className="text-sm font-semibold text-chalk">{group.label}</h2>
              {group.sublabel && <p className="text-xs text-mist">{group.sublabel}</p>}
            </div>
            {!showDismissed && (
              <button
                onClick={() => handleRegenerate(group)}
                disabled={regeneratingId === group.key}
                className="text-xs px-2.5 py-1 rounded-lg border border-line hover:bg-raised text-mist disabled:opacity-40 whitespace-nowrap transition-colors"
              >
                {regeneratingId === group.key ? 'Refreshing…' : 'Refresh'}
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {group.items.map((rec) => (
              <RecommendationCard
                key={rec.id}
                rec={rec}
                onAcquired={handleAcquired}
                onDismissed={handleDismissed}
                onRestore={handleRestore}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
