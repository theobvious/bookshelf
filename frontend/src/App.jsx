import { Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home.jsx";
import ShelvesPage from "./pages/ShelvesPage.jsx";
import ShelfDetailPage from "./pages/ShelfDetailPage.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import ReviewPage from "./pages/ReviewPage.jsx";
import RecommendationsPage from "./pages/RecommendationsPage.jsx";

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-1.5 rounded text-sm transition-colors ${
          isActive
            ? "bg-amber-800 text-amber-100"
            : "text-stone-300 hover:text-amber-100 hover:bg-stone-700"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-stone-900 border-b border-stone-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6">
          <span className="font-semibold text-base tracking-wide text-amber-200 italic">
            Bookshelf
          </span>
          <nav className="flex items-center gap-1">
            <NavItem to="/">Home</NavItem>
            <NavItem to="/shelves">Shelves</NavItem>
            <NavItem to="/search">Search</NavItem>
            <NavItem to="/review">Review Queue</NavItem>
            <NavItem to="/recommendations">Reading List</NavItem>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shelves" element={<ShelvesPage />} />
          <Route path="/shelves/:id" element={<ShelfDetailPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
        </Routes>
      </main>
    </div>
  );
}
