import { useState, useRef } from "react";
import { createShelf } from "../api.js";

export default function ShelfUploadModal({ onCreated, onClose }) {
  const [label, setLabel] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function handleDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) handleFile(f);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!label.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await createShelf(label.trim(), file);
      onCreated(result);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-base">Add a shelf</h2>
          {!loading && (
            <button onClick={onClose} className="text-stone-400 hover:text-stone-700 text-xl leading-none">&times;</button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Shelf label *</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Living Room — Top, Office Shelf 2"
              disabled={loading}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50"
            />
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => !loading && inputRef.current?.click()}
            className={`relative rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
              loading ? "opacity-50 pointer-events-none" : "hover:border-amber-400"
            } ${file ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-stone-50"}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => handleFile(e.target.files[0])}
            />

            {preview ? (
              <div className="relative">
                <img src={preview} alt="Preview" className="w-full max-h-56 object-cover rounded-lg" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/30 rounded-lg transition-opacity">
                  <span className="text-white text-sm font-medium">Change photo</span>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm text-stone-500">Drop a shelf photo here, or click to choose</p>
                <p className="text-xs text-stone-400 mt-1">JPG, PNG, WEBP — Claude will read the spines</p>
              </div>
            )}
          </div>

          {!file && (
            <p className="text-xs text-stone-400 text-center">
              You can also add a shelf without a photo and add books manually.
            </p>
          )}

          {loading && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-amber-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <span>Analysing shelf photo… this may take 15–30 seconds.</span>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm rounded-lg border border-stone-200 hover:bg-stone-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !label.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? "Processing…" : file ? "Upload & scan" : "Add shelf"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
