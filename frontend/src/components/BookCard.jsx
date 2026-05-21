import { useState } from "react";
import BookEditModal from "./BookEditModal.jsx";
import { assetUrl } from "../api.js";

const LANG_NAMES = {
  en: "English", fr: "French", de: "German", es: "Spanish", it: "Italian",
  pt: "Portuguese", nl: "Dutch", ru: "Russian", ja: "Japanese", zh: "Chinese",
  ko: "Korean", ar: "Arabic", he: "Hebrew", pl: "Polish", sv: "Swedish",
  da: "Danish", fi: "Finnish", no: "Norwegian", cs: "Czech", hu: "Hungarian",
};

export default function BookCard({ book, onUpdate, onDelete, showShelf, shelfLabels, shelfPhotoUrl }) {
  const [editing, setEditing] = useState(false);

  const langLabel = book.language ? (LANG_NAMES[book.language] || book.language.toUpperCase()) : null;

  return (
    <>
      <div className={`flex gap-3 p-3.5 rounded-2xl border transition-colors ${
        book.needs_review
          ? 'border-glow-border bg-glow-bg'
          : 'border-line bg-raised hover:border-edge'
      }`}>
        <div className="flex-shrink-0 w-10 h-14 rounded-lg overflow-hidden bg-float">
          {book.cover_url ? (
            <img src={book.cover_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm leading-snug truncate text-chalk">
            {book.title || <span className="italic text-smoke">Unidentified book</span>}
          </p>
          {book.author && (
            <p className="text-xs text-mist truncate mt-0.5">{book.author}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {langLabel && langLabel !== "English" && (
              <span className="text-xs px-1.5 py-0.5 rounded-md bg-ink-900 border border-ink-800 text-ink-300">
                {langLabel}
              </span>
            )}
            {book.needs_review && (
              <span className="text-xs px-1.5 py-0.5 rounded-md bg-glow-bg border border-glow-border text-glow-dim">
                Needs review
                {book.confidence != null && ` · ${Math.round(book.confidence * 100)}%`}
              </span>
            )}
            {book.lent_to && (
              <span className="text-xs px-1.5 py-0.5 rounded-md bg-glow-bg border border-glow-border text-glow">
                Lent to {book.lent_to}
              </span>
            )}
            {showShelf && shelfLabels?.length > 0 && (
              <span className="text-xs text-smoke">{shelfLabels.join(", ")}</span>
            )}
          </div>
          {book.needs_review && book.review_notes && (
            <p className="text-xs text-glow-dim mt-1 italic">{book.review_notes}</p>
          )}
        </div>

        <div className="flex-shrink-0 flex flex-col gap-1">
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-2.5 py-1 rounded-lg border border-line hover:bg-float text-mist hover:text-chalk transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(book.id)}
            className="text-xs px-2.5 py-1 rounded-lg border border-ember-border hover:bg-ember-bg text-ember transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <BookEditModal
          book={book}
          shelfPhotoUrl={assetUrl(shelfPhotoUrl || book.shelf_photo_url)}
          onSave={(updated) => { onUpdate(updated); setEditing(false); }}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
