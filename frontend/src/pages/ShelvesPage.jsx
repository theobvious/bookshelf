import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getShelves, deleteShelf } from '../api.js';
import ShelfUploadModal from '../components/ShelfUploadModal.jsx';
import MiniShelfPreview from '../components/MiniShelfPreview.jsx';

export default function ShelvesPage() {
  const [shelves, setShelves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    getShelves().then(setShelves).finally(() => setLoading(false));
  }, []);

  function handleCreated(result) {
    setShelves((prev) => [...prev, result.shelf]);
    setShowUpload(false);
  }

  async function handleDelete(id, label) {
    if (!confirm(`Delete shelf "${label}" and all its books?`)) return;
    await deleteShelf(id);
    setShelves((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-5 h-5 rounded-full border-2 border-ink-700 border-t-ink-300 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-chalk">Shelves</h1>
          <p className="text-mist text-sm mt-1">
            {shelves.length} {shelves.length === 1 ? 'shelf' : 'shelves'}
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="px-4 py-2 text-sm rounded-xl bg-ink-900 border border-ink-800 text-ink-300 hover:bg-ink-800/60 font-medium transition-colors"
        >
          Add shelf
        </button>
      </div>

      {shelves.length === 0 ? (
        <div className="text-center py-24 space-y-4">
          <p className="font-display italic text-2xl text-smoke">No shelves yet</p>
          <p className="text-sm text-mist">Upload a photo of your bookshelf to get started.</p>
          <button
            onClick={() => setShowUpload(true)}
            className="mt-2 px-5 py-2.5 text-sm rounded-xl bg-ink-900 border border-ink-800 text-ink-300 hover:bg-ink-800/60 transition-colors"
          >
            Add your first shelf
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {shelves.map((shelf) => (
            <Link
              key={shelf.id}
              to={`/shelves/${shelf.id}`}
              className="group rounded-2xl border border-line bg-raised overflow-hidden hover:border-edge transition-all"
            >
              <div className="bg-deep px-3 pt-3">
                <MiniShelfPreview shelfId={shelf.id} bookCount={shelf.book_count} height={68} />
              </div>
              <div className="p-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-sm text-chalk group-hover:text-ink-200 transition-colors">
                    {shelf.label}
                  </p>
                  <p className="text-xs text-mist mt-0.5">
                    {shelf.book_count} books
                    {shelf.needs_review_count > 0 && (
                      <span className="ml-2 text-glow">{shelf.needs_review_count} to review</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.preventDefault(); handleDelete(shelf.id, shelf.label); }}
                  className="text-xs text-smoke hover:text-ember flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all"
                >
                  Delete
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showUpload && (
        <ShelfUploadModal onCreated={handleCreated} onClose={() => setShowUpload(false)} />
      )}
    </div>
  );
}
