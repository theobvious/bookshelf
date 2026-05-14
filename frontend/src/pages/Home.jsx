import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getShelves, getBooks } from "../api.js";

export default function Home() {
  const [shelves, setShelves] = useState([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getShelves(), getBooks({ needs_review: true })])
      .then(([s, r]) => {
        setShelves(s);
        setReviewCount(r.length);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalBooks = shelves.reduce((n, s) => n + s.book_count, 0);

  if (loading) return <p className="text-stone-400 text-sm">Loading…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your library</h1>
        <p className="text-stone-500 text-sm mt-1">
          {shelves.length} {shelves.length === 1 ? "shelf" : "shelves"} &middot; {totalBooks} books catalogued
          {reviewCount > 0 && (
            <> &middot; <Link to="/review" className="text-amber-700 hover:underline font-medium">{reviewCount} needing review</Link></>
          )}
        </p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: "/shelves", icon: "🗂️", label: "Shelves", desc: `${shelves.length} shelves` },
          { to: "/search", icon: "🔍", label: "Search", desc: "Find a book" },
          { to: "/review", icon: "✏️", label: "Review queue", desc: `${reviewCount} to review`, warn: reviewCount > 0 },
          { to: "/shelves", icon: "📷", label: "Add shelf", desc: "Upload a photo" },
        ].map(({ to, icon, label, desc, warn }) => (
          <Link
            key={label}
            to={to}
            className={`rounded-xl border p-4 flex flex-col gap-1 transition-colors hover:shadow-sm ${
              warn ? "border-amber-200 bg-amber-50 hover:bg-amber-100" : "border-stone-200 bg-white hover:bg-stone-50"
            }`}
          >
            <span className="text-2xl">{icon}</span>
            <span className="font-medium text-sm">{label}</span>
            <span className="text-xs text-stone-500">{desc}</span>
          </Link>
        ))}
      </div>

      {/* Recent shelves */}
      {shelves.length > 0 && (
        <div>
          <h2 className="font-medium text-sm text-stone-500 uppercase tracking-wide mb-3">Shelves</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {shelves.map((shelf) => (
              <Link
                key={shelf.id}
                to={`/shelves/${shelf.id}`}
                className="flex gap-3 p-3 rounded-xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all"
              >
                {shelf.photo_path ? (
                  <img
                    src={shelf.photo_path}
                    alt=""
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-stone-100 flex items-center justify-center text-2xl flex-shrink-0">
                    📚
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{shelf.label}</p>
                  <p className="text-xs text-stone-500 mt-0.5">{shelf.book_count} books</p>
                  {shelf.needs_review_count > 0 && (
                    <p className="text-xs text-amber-700 mt-0.5">{shelf.needs_review_count} need review</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {shelves.length === 0 && (
        <div className="text-center py-16 text-stone-400">
          <div className="text-5xl mb-3">📚</div>
          <p className="font-medium text-stone-600">No shelves yet</p>
          <p className="text-sm mt-1">Go to <Link to="/shelves" className="text-amber-700 hover:underline">Shelves</Link> to upload your first photo.</p>
        </div>
      )}
    </div>
  );
}
