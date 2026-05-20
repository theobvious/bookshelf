import { useState } from "react";
import { diffShelf, applyDiff, mergeRow, createShelfFromAnalysis } from "../api.js";

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? "";

function BookList({ books, checked, onToggle, emptyText }) {
  if (!books || books.length === 0) {
    return <p className="text-xs text-smoke italic py-2">{emptyText}</p>;
  }
  return (
    <ul className="space-y-1 max-h-52 overflow-y-auto pr-1">
      {books.map((book, i) => {
        const key = book.id ?? i;
        const isChecked = checked(book, i);
        return (
          <li
            key={key}
            className={`flex items-start gap-2 text-xs py-1 cursor-pointer select-none ${
              onToggle ? "hover:text-chalk" : ""
            } ${isChecked ? "text-mist" : "text-smoke line-through"}`}
            onClick={() => onToggle && onToggle(book, i)}
          >
            {onToggle && (
              <input
                type="checkbox"
                className="mt-0.5 flex-shrink-0 accent-ink-400"
                checked={isChecked}
                onChange={() => onToggle(book, i)}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <span className="truncate">{book.title || "(untitled)"}</span>
          </li>
        );
      })}
    </ul>
  );
}

function ConfidencePill({ value, label }) {
  const pct = Math.round(value * 100);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-ink-900/60 border border-ink-800/60 text-ink-300">
      {label}: {pct}%
    </span>
  );
}

export default function ShelfSimilarityModal({ analyzeResult, label, onCreated, onClose }) {
  const [view, setView] = useState("decision"); // "decision" | "diff"
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState(null);
  const [diffResult, setDiffResult] = useState(null);
  const [removeIds, setRemoveIds] = useState(new Set());
  const [addIndices, setAddIndices] = useState(new Set());

  const match = analyzeResult.similar_shelves[0];
  const { extracted_books: extractedBooks, photo_hash: photoHash, temp_photo_path: tempPhotoPath } = analyzeResult;
  const matchPhotoUrl = match.shelf.photo_path ? `${BACKEND}${match.shelf.photo_path}` : null;

  function toggleRemove(book) {
    setRemoveIds((prev) => {
      const next = new Set(prev);
      next.has(book.id) ? next.delete(book.id) : next.add(book.id);
      return next;
    });
  }

  function toggleAdd(_book, i) {
    setAddIndices((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  async function handleUpdateShelf() {
    setLoading(true);
    setLoadingMsg("Computing changes…");
    setError(null);
    try {
      const diff = await diffShelf(match.shelf.id, extractedBooks);
      setDiffResult(diff);
      setRemoveIds(new Set(diff.removed.map((b) => b.id)));
      setAddIndices(new Set(diff.added.map((_, i) => i)));
      setView("diff");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  }

  async function handleMergeRow() {
    setLoading(true);
    setLoadingMsg("Adding row…");
    setError(null);
    try {
      const result = await mergeRow(match.shelf.id, extractedBooks, tempPhotoPath, photoHash);
      onCreated(result);
    } catch (e) {
      setError(e.message);
      setLoading(false);
      setLoadingMsg("");
    }
  }

  async function handleCreateNew() {
    setLoading(true);
    setLoadingMsg("Creating shelf…");
    setError(null);
    try {
      const result = await createShelfFromAnalysis(label, extractedBooks, tempPhotoPath, photoHash);
      onCreated(result);
    } catch (e) {
      setError(e.message);
      setLoading(false);
      setLoadingMsg("");
    }
  }

  async function handleApplyDiff() {
    setLoading(true);
    setLoadingMsg("Applying changes…");
    setError(null);
    try {
      const add = [...addIndices].map((i) => diffResult.added[i]);
      const remove = [...removeIds];
      const result = await applyDiff(match.shelf.id, add, remove, tempPhotoPath, photoHash);
      onCreated(result);
    } catch (e) {
      setError(e.message);
      setLoading(false);
      setLoadingMsg("");
    }
  }

  const btnPrimary =
    "px-4 py-2 text-sm rounded-xl bg-chalk text-deep font-medium hover:bg-chalk/90 disabled:opacity-40 transition-colors";
  const btnSecondary =
    "px-4 py-2 text-sm rounded-xl border border-line hover:bg-float text-mist disabled:opacity-40 transition-colors";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div className="bg-raised rounded-2xl shadow-2xl border border-line w-full max-w-2xl mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base text-chalk">
            {view === "decision" ? "Similar shelf detected" : `Update "${match.shelf.label}"`}
          </h2>
          {!loading && (
            <button
              onClick={onClose}
              className="text-smoke hover:text-mist text-xl leading-none transition-colors"
            >
              ×
            </button>
          )}
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="p-4 rounded-xl bg-ink-900/40 border border-ink-800/60 text-sm text-ink-300 flex items-center gap-3 mb-4">
            <div className="w-4 h-4 rounded-full border-2 border-ink-700 border-t-ink-300 animate-spin flex-shrink-0" />
            {loadingMsg}
          </div>
        )}

        {error && <p className="text-sm text-ember mb-4">{error}</p>}

        {/* Decision view */}
        {view === "decision" && !loading && (
          <>
            {/* Match card */}
            <div className="flex gap-4 p-4 rounded-xl bg-float border border-line mb-5">
              {matchPhotoUrl && (
                <img
                  src={matchPhotoUrl}
                  alt={match.shelf.label}
                  className="w-24 h-16 object-cover rounded-lg flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="font-medium text-chalk text-sm mb-1 truncate">{match.shelf.label}</p>
                <p className="text-xs text-smoke mb-2">
                  {match.shelf.book_count} book{match.shelf.book_count !== 1 ? "s" : ""}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <ConfidencePill value={match.confidence} label="Confidence" />
                  {match.photo_similarity > 0 && (
                    <ConfidencePill value={match.photo_similarity} label="Photo" />
                  )}
                  {match.book_overlap > 0 && (
                    <ConfidencePill value={match.book_overlap} label="Books" />
                  )}
                </div>
              </div>
            </div>

            <p className="text-sm text-mist mb-4">
              This photo looks like a shelf you've already catalogued. What would you like to do?
            </p>

            <div className="space-y-2">
              <button
                onClick={handleUpdateShelf}
                disabled={loading}
                className={`w-full text-left px-4 py-3 rounded-xl border border-line hover:bg-float transition-colors ${
                  loading ? "opacity-40 pointer-events-none" : ""
                }`}
              >
                <p className="text-sm font-medium text-chalk">Update this shelf</p>
                <p className="text-xs text-smoke mt-0.5">
                  See what's changed — added, removed, unchanged — and apply selectively
                </p>
              </button>

              <button
                onClick={handleMergeRow}
                disabled={loading}
                className={`w-full text-left px-4 py-3 rounded-xl border border-line hover:bg-float transition-colors ${
                  loading ? "opacity-40 pointer-events-none" : ""
                }`}
              >
                <p className="text-sm font-medium text-chalk">Add as new row</p>
                <p className="text-xs text-smoke mt-0.5">
                  You photographed another row of the same shelf — merge as row {(match.shelf.book_count > 0 ? 2 : 1) + 1}
                </p>
              </button>

              <button
                onClick={handleCreateNew}
                disabled={loading}
                className={`w-full text-left px-4 py-3 rounded-xl border border-line hover:bg-float transition-colors ${
                  loading ? "opacity-40 pointer-events-none" : ""
                }`}
              >
                <p className="text-sm font-medium text-chalk">Create as new shelf</p>
                <p className="text-xs text-smoke mt-0.5">Treat this as a separate shelf named "{label}"</p>
              </button>
            </div>
          </>
        )}

        {/* Diff view */}
        {view === "diff" && diffResult && !loading && (
          <>
            <p className="text-xs text-smoke mb-4">
              Select which changes to apply. Unchecked items will be left as-is.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-5">
              {/* Removed column */}
              <div className="bg-float/50 rounded-xl p-3">
                <p className="text-xs font-semibold text-ember mb-2">
                  Removed ({diffResult.removed.length})
                </p>
                <BookList
                  books={diffResult.removed}
                  checked={(book) => removeIds.has(book.id)}
                  onToggle={toggleRemove}
                  emptyText="Nothing removed"
                />
              </div>

              {/* Unchanged column */}
              <div className="bg-float/50 rounded-xl p-3">
                <p className="text-xs font-semibold text-smoke mb-2">
                  Unchanged ({diffResult.matched.length})
                </p>
                <BookList
                  books={diffResult.matched}
                  checked={() => true}
                  onToggle={null}
                  emptyText="No overlap found"
                />
              </div>

              {/* Added column */}
              <div className="bg-float/50 rounded-xl p-3">
                <p className="text-xs font-semibold text-green-400 mb-2">
                  Added ({diffResult.added.length})
                </p>
                <BookList
                  books={diffResult.added}
                  checked={(_book, i) => addIndices.has(i)}
                  onToggle={toggleAdd}
                  emptyText="Nothing new"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-between items-center">
              <button
                onClick={() => setView("decision")}
                disabled={loading}
                className="text-xs text-smoke hover:text-mist transition-colors disabled:opacity-40"
              >
                ← Back
              </button>
              <div className="flex gap-2">
                <button onClick={onClose} disabled={loading} className={btnSecondary}>
                  Cancel
                </button>
                <button
                  onClick={handleApplyDiff}
                  disabled={loading || (removeIds.size === 0 && addIndices.size === 0)}
                  className={btnPrimary}
                >
                  Apply changes ({removeIds.size + addIndices.size})
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
