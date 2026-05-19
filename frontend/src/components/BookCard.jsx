import { useState } from "react";
import BookEditModal from "./BookEditModal.jsx";

const LANG_NAMES = {
  en: "English", fr: "French", de: "German", es: "Spanish", it: "Italian",
  pt: "Portuguese", nl: "Dutch", ru: "Russian", ja: "Japanese", zh: "Chinese",
  ko: "Korean", ar: "Arabic", he: "Hebrew", pl: "Polish", sv: "Swedish",
  da: "Danish", fi: "Finnish", no: "Norwegian", cs: "Czech", hu: "Hungarian",
};

export default function BookCard({ book, onUpdate, onDelete, showShelf, shelfLabels }) {
  const [editing, setEditing] = useState(false);

  const langLabel = book.language ? (LANG_NAMES[book.language] || book.language.toUpperCase()) : null;

  return (
    <>
      <div
        className={`flex gap-3 p-3 rounded-lg border transition-colors ${
          book.needs_review
            ? "border-amber-300 bg-amber-50"
            : "border-stone-200 bg-white hover:border-stone-300"
        }`}
      >
        {/* Cover */}
        <div className="flex-shrink-0 w-10 h-14 rounded overflow-hidden bg-stone-100">
          {book.cover_url ? (
            <img src={book.cover_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-stone-200" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm leading-snug truncate">
            {book.title || <span className="italic text-stone-400">Unidentified book</span>}
          </p>
          {book.author && (
            <p className="text-xs text-stone-500 truncate">{book.author}</p>
          )}
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {langLabel && langLabel !== "English" && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                {langLabel}
              </span>
            )}
            {book.needs_review && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                Needs review
                {book.confidence != null && ` (${Math.round(book.confidence * 100)}%)`}
              </span>
            )}
            {showShelf && shelfLabels?.length > 0 && (
              <span className="text-xs text-stone-400">{shelfLabels.join(", ")}</span>
            )}
          </div>
          {book.needs_review && book.review_notes && (
            <p className="text-xs text-amber-700 mt-1 italic">{book.review_notes}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex flex-col gap-1">
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-2 py-1 rounded border border-stone-200 hover:bg-stone-50 text-stone-600"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(book.id)}
            className="text-xs px-2 py-1 rounded border border-red-100 hover:bg-red-50 text-red-600"
          >
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <BookEditModal
          book={book}
          onSave={(updated) => { onUpdate(updated); setEditing(false); }}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
