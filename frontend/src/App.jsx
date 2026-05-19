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
        `text-sm transition-colors px-1 py-0.5 border-b-2 ${
          isActive
            ? "text-chalk border-ink-400"
            : "text-mist hover:text-chalk border-transparent"
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
    <div className="min-h-screen flex flex-col bg-base">
      <header className="bg-deep border-b border-line sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-8">
          <span className="font-display italic text-chalk text-lg tracking-wide select-none">
            Bookshelf
          </span>
          <nav className="flex items-center gap-6 flex-1">
            <NavItem to="/">Home</NavItem>
            <NavItem to="/shelves">Shelves</NavItem>
            <NavItem to="/search">Search</NavItem>
            <NavItem to="/review">Review</NavItem>
            <NavItem to="/recommendations">Reading List</NavItem>
          </nav>
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-mist text-xs hidden sm:block">
                {user.name || user.email}
              </span>
            )}
            <button
              onClick={logout}
              className="text-xs text-smoke hover:text-mist transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
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
