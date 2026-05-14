const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

// Shelves
export const getShelves = () => request("/shelves");
export const getShelf = (id) => request(`/shelves/${id}`);
export const deleteShelf = (id) => request(`/shelves/${id}`, { method: "DELETE" });

export async function createShelf(label, photoFile) {
  const form = new FormData();
  form.append("label", label);
  if (photoFile) form.append("photo", photoFile);
  return request("/shelves", { method: "POST", body: form });
}

export const getRecommendations = (shelfId) =>
  request(`/shelves/${shelfId}/recommendations`);

// Books
export const getBooks = (params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null));
  return request(`/books${qs.toString() ? "?" + qs : ""}`);
};

export const getBook = (id) => request(`/books/${id}`);

export const createBook = (data) =>
  request("/books", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

export const updateBook = (id, data) =>
  request(`/books/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

export const confirmBook = (id) => request(`/books/${id}/confirm`, { method: "POST" });

export const deleteBook = (id) => request(`/books/${id}`, { method: "DELETE" });

export const searchBooks = (q) => request(`/books/search?q=${encodeURIComponent(q)}`);
