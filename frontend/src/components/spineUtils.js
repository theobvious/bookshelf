export const SPINE_COLORS = [
  '#1e3a5f', // navy
  '#8b2020', // dark red
  '#1e5c2a', // forest green
  '#5c3a1a', // warm brown
  '#4a1a5c', // deep purple
  '#1a5c50', // teal
  '#6b4c1a', // tan / antique
  '#1a2a6b', // royal blue
  '#6b1a3a', // burgundy
  '#3a6b1a', // olive
  '#1a6b4a', // emerald
  '#6b2020', // maroon
  '#2c4a7a', // steel blue
  '#7a3030', // brick red
  '#2c6e3a', // medium green
  '#7a4a20', // copper
  '#4a2c7a', // violet
  '#20504a', // dark teal
  '#6b6b20', // olive gold
  '#2a2a7a', // indigo
  '#5c1a4a', // plum
  '#1a4a2a', // deep green
  '#7a2c4a', // raspberry
  '#3a5c3a', // sage
];

function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function spineColor(book) {
  const h = djb2((book.title || '') + (book.author || ''));
  return SPINE_COLORS[h % SPINE_COLORS.length];
}

export function spineWidth(book) {
  // Simulate realistic book thickness: 20–42px
  const h = djb2(book.title || book.id?.toString() || '');
  return 20 + (h % 22);
}

export function miniSpineColor(shelfId, index) {
  const h = Math.abs((shelfId * 997 + index * 37) * 1000003);
  return SPINE_COLORS[h % SPINE_COLORS.length];
}

export function miniSpineWidth(shelfId, index) {
  return 7 + (Math.abs(shelfId * 1009 + index * 41) % 10);
}
