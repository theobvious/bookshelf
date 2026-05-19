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

  if (loading) return <p className="text-stone-400 text-sm">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Shelves</h1>
        <button
          onClick={() => setShowUpload(true)}
          className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 font-medium"
        >
          + Add shelf
        </button>
      </div>

      {shelves.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <div className="text-5xl mb-3">📷</div>
          <p className="font-medium text-stone-600">No shelves yet</p>
          <p className="text-sm mt-1">Upload a photo of your bookshelf to get started.</p>
          <button
            onClick={() => setShowUpload(true)}
            className="mt-4 px-5 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700"
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
              className="group rounded-xl border border-stone-200 bg-white overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Mini spine preview */}
              <div className="bg-stone-900 px-3 pt-3">
                <MiniShelfPreview shelfId={shelf.id} bookCount={shelf.book_count} height={64} />
              </div>

              <div className="p-3 flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm group-hover:underline">{shelf.label}</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {shelf.book_count} books
                    {shelf.needs_review_count > 0 && (
                      <span className="ml-2 text-amber-700">{shelf.needs_review_count} to review</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.preventDefault(); handleDelete(shelf.id, shelf.label); }}
                  className="text-xs text-red-400 hover:text-red-700 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
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
