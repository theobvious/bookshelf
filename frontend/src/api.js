const BACKEND = import.meta.env.VITE_BACKEND_URL ?? "";
const BASE = `${BACKEND}/api`;

function getToken() {
  return localStorage.getItem("bookshelf_token");
}

async function request(path, options = {}, attempt = 0) {
  const token = getToken();
  const headers = { ...(options.headers ?? {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch (networkErr) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      return request(path, options, attempt + 1);
    }
    throw networkErr;
  }
  if (res.status === 401) {
    localStorage.removeItem("bookshelf_token");
    localStorage.removeItem("bookshelf_user");
    window.location.href = "/login";
    return;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

export const googleAuth = (credential) =>
  fetch(`${BASE}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Auth failed");
    }
    return res.json();
  });

// Shelves
export const getShelves = () => request("/shelves/");
export const getShelf = (id) => request(`/shelves/${id}`);
export const deleteShelf = (id) => request(`/shelves/${id}`, { method: "DELETE" });

export async function createShelf(label, photoFile) {
  const form = new FormData();
  form.append("label", label);
  if (photoFile) form.append("photo", photoFile);
  return request("/shelves/", { method: "POST", body: form });
}

export const getShelfRecommendations = (shelfId, regenerate = false) =>
  request(`/shelves/${shelfId}/recommendations${regenerate ? '?regenerate=true' : ''}`, { method: 'POST' });

export const recommendBook = (id, regenerate = false) =>
  request(`/books/${id}/recommend${regenerate ? '?regenerate=true' : ''}`, { method: 'POST' });

export const getRecommendations = (params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null));
  return request(`/recommendations/${qs.toString() ? '?' + qs : ''}`);
};

export const updateRecommendation = (id, data) =>
  request(`/recommendations/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

export const deleteRecommendation = (id) =>
  request(`/recommendations/${id}`, { method: 'DELETE' });

export const clearRecommendations = (params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null));
  return request(`/recommendations/${qs.toString() ? '?' + qs : ''}`, { method: 'DELETE' });
};

// Books
export const getBooks = (params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null));
  return request(`/books/${qs.toString() ? "?" + qs : ""}`);
};

export const getBook = (id) => request(`/books/${id}`);

export const createBook = (data) =>
  request("/books/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

export const updateBook = (id, data) =>
  request(`/books/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

export const confirmBook = (id) => request(`/books/${id}/confirm`, { method: "POST" });
export const enrichBook = (id) => request(`/books/${id}/enrich`, { method: "POST" });

export const deleteBook = (id) => request(`/books/${id}`, { method: "DELETE" });

export const searchBooks = (q) => request(`/books/search?q=${encodeURIComponent(q)}`);
