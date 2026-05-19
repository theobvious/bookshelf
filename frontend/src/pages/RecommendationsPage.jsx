import { useEffect, useState, useCallback } from 'react';
import { getRecommendations, updateRecommendation, recommendBook, getShelfRecommendations } from '../api.js';

function CoverPlaceholder() {
  return <div className="w-10 h-14 rounded bg-stone-200 flex-shrink-0" />;
}

function RecommendationCard({ rec, onAcquired, onDismissed, onRestore, showDismissed }) {
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
    <div className={`flex gap-3 p-3 rounded-lg border ${rec.dismissed ? 'border-stone-200 bg-stone-50 opacity-75' : 'border-parchment-200 bg-white'}`}>
      {rec.cover_url ? (
        <img src={rec.cover_url} alt="" className="w-10 h-14 object-cover rounded flex-shrink-0 shadow-sm" />
      ) : (
        <CoverPlaceholder />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-snug text-stone-900">{rec.title}</p>
        {rec.author && <p className="text-xs text-stone-500 mt-0.5">{rec.author}</p>}
        {rec.reason && <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">{rec.reason}</p>}
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        {rec.dismissed ? (
          <button
            onClick={handleRestore}
            disabled={dismissingLoading}
            className="text-xs px-2.5 py-1 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-600 disabled:opacity-50 whitespace-nowrap"
          >
            {dismissingLoading ? 'Restoring...' : 'Restore'}
          </button>
        ) : (
          <>
            {rec.acquired ? (
              <span className="text-xs px-2.5 py-1 rounded-lg bg-green-50 border border-green-200 text-green-700 font-medium whitespace-nowrap">
                Acquired
              </span>
            ) : (
              <button
                onClick={handleAcquire}
                disabled={acquiringLoading}
                className="text-xs px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-medium disabled:opacity-50 whitespace-nowrap"
              >
                {acquiringLoading ? 'Saving...' : 'Mark acquired'}
              </button>
            )}
            <button
              onClick={handleDismiss}
              disabled={dismissingLoading}
              className="text-xs px-2 py-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 disabled:opacity-50 whitespace-nowrap"
            >
              {dismissingLoading ? '...' : 'Dismiss'}
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

  function handleToggleDismissed() {
    setShowDismissed((prev) => !prev);
  }

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

  // Group by source — shelf recs keyed by "shelf:{id}", book recs by "book:{id}"
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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reading List</h1>
          <p className="text-stone-500 text-sm mt-1">
            Books recommended based on your catalog.
          </p>
        </div>
        <button
          onClick={handleToggleDismissed}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
            showDismissed
              ? 'border-stone-400 bg-stone-100 text-stone-700'
              : 'border-stone-200 text-stone-500 hover:bg-stone-50'
          }`}
        >
          {showDismissed ? 'Hide dismissed' : 'Show dismissed'}
        </button>
      </div>

      {loading && (
        <p className="text-stone-400 text-sm">Loading...</p>
      )}

      {!loading && groupList.length === 0 && (
        <div className="text-center py-16 text-stone-400">
          <p className="text-sm text-stone-500">
            {showDismissed
              ? 'No dismissed recommendations.'
              : 'No recommendations yet. Click "Recommend books" on a shelf, or open a book spine and choose "Recommend similar".'}
          </p>
        </div>
      )}

      {!loading && groupList.map((group) => (
        <div key={group.key} className="space-y-2">
          <div className="flex items-center justify-between gap-2 border-b border-parchment-200 pb-2">
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-widest mb-0.5">
                {group.isShelf ? 'Because of your shelf' : 'Because you have'}
              </p>
              <h2 className="text-sm font-semibold text-stone-800">{group.label}</h2>
              {group.sublabel && <p className="text-xs text-stone-400">{group.sublabel}</p>}
            </div>
            {!showDismissed && (
              <button
                onClick={() => handleRegenerate(group)}
                disabled={regeneratingId === group.key}
                className="text-xs px-2.5 py-1 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-500 disabled:opacity-50 whitespace-nowrap"
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
                showDismissed={showDismissed}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
