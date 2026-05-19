import { GoogleOAuthProvider } from '@react-oauth/google';
import { Navigate, Route, Routes, NavLink } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import Home from "./pages/Home.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ShelvesPage from "./pages/ShelvesPage.jsx";
import ShelfDetailPage from "./pages/ShelfDetailPage.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import ReviewPage from "./pages/ReviewPage.jsx";
import RecommendationsPage from "./pages/RecommendationsPage.jsx";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

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

function ProtectedApp() {
  const { isAuthenticated, user, logout } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-stone-900 border-b border-stone-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6">
          <span className="font-semibold text-base tracking-wide text-amber-200 italic">
            Bookshelf
          </span>
          <nav className="flex items-center gap-1 flex-1">
            <NavItem to="/">Home</NavItem>
            <NavItem to="/shelves">Shelves</NavItem>
            <NavItem to="/search">Search</NavItem>
            <NavItem to="/review">Review Queue</NavItem>
            <NavItem to="/recommendations">Reading List</NavItem>
          </nav>
          <div className="flex items-center gap-3">
            {user && <span className="text-stone-400 text-xs">{user.name || user.email}</span>}
            <button
              onClick={logout}
              className="text-xs text-stone-400 hover:text-stone-200 px-2 py-1 rounded hover:bg-stone-700 transition-colors"
            >
              Sign out
            </button>
          </div>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<ProtectedApp />} />
        </Routes>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
