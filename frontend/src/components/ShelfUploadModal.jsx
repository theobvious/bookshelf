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

  const inputCls = "w-full px-3 py-2.5 text-sm bg-float border border-line rounded-xl text-chalk placeholder:text-smoke focus:outline-none focus:ring-1 focus:ring-ink-500/50 focus:border-ink-600/60 transition-colors disabled:opacity-40";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div className="bg-raised rounded-2xl shadow-2xl border border-line w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base text-chalk">Add a shelf</h2>
          {!loading && (
            <button onClick={onClose} className="text-smoke hover:text-mist text-xl leading-none transition-colors">×</button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-mist mb-1.5">Shelf label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Living Room — Top, Office Shelf 2"
              disabled={loading}
              className={inputCls}
            />
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => !loading && inputRef.current?.click()}
            className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
              loading ? "opacity-50 pointer-events-none" : "hover:border-ink-600"
            } ${file ? "border-ink-700 bg-ink-900/30" : "border-line bg-float/50"}`}
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
                <img src={preview} alt="Preview" className="w-full max-h-56 object-cover rounded-2xl" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/50 rounded-2xl transition-opacity">
                  <span className="text-chalk text-sm font-medium">Change photo</span>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm text-mist">Drop a shelf photo here, or click to choose</p>
                <p className="text-xs text-smoke mt-1">JPG, PNG, WEBP — Claude will read the spines</p>
              </div>
            )}
          </div>

          {!file && (
            <p className="text-xs text-smoke text-center">
              You can add a shelf without a photo and add books manually.
            </p>
          )}

          {loading && (
            <div className="p-4 rounded-xl bg-ink-900/40 border border-ink-800/60 text-sm text-ink-300 flex items-center gap-3">
              <div className="w-4 h-4 rounded-full border-2 border-ink-700 border-t-ink-300 animate-spin flex-shrink-0" />
              Analysing shelf photo… this may take 15–30 seconds.
            </div>
          )}

          {error && <p className="text-sm text-ember">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm rounded-xl border border-line hover:bg-float text-mist disabled:opacity-40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !label.trim()}
              className="px-4 py-2 text-sm rounded-xl bg-chalk text-deep font-medium hover:bg-chalk/90 disabled:opacity-40 transition-colors"
            >
              {loading ? "Processing…" : file ? "Upload & scan" : "Add shelf"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
