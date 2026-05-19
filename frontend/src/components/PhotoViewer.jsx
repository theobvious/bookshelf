import { useEffect, useRef, useState } from "react";

export default function PhotoViewer({ photoUrl, bbox, onClose }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [nat, setNat] = useState(null);

  // Zoom to spine bbox once image dimensions are known
  useEffect(() => {
    if (!nat || !bbox || !containerRef.current) return;
    const [x, y, w, h] = bbox;
    const container = containerRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    // Scale so the spine fills ~60% of the smaller viewport dimension
    const targetW = cw * 0.6;
    const scale = targetW / (w * nat.w);
    const scaledW = nat.w * scale;
    const scaledH = nat.h * scale;

    // Center the spine in the viewport
    const spineLeft = x * scaledW;
    const spineTop = y * scaledH;
    const scrollLeft = spineLeft - (cw - w * scaledW) / 2;
    const scrollTop = spineTop - (ch - h * scaledH) / 2;

    imgRef.current.style.width = `${scaledW}px`;
    imgRef.current.style.height = `${scaledH}px`;
    container.scrollLeft = scrollLeft;
    container.scrollTop = scrollTop;
  }, [nat, bbox]);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Pinch-to-zoom and wheel zoom
  const lastDist = useRef(null);
  function onWheel(e) {
    e.preventDefault();
    const img = imgRef.current;
    if (!img) return;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const rect = img.getBoundingClientRect();
    const container = containerRef.current;
    const ox = e.clientX - rect.left + container.scrollLeft;
    const oy = e.clientY - rect.top + container.scrollTop;
    const newW = img.offsetWidth * factor;
    const newH = img.offsetHeight * factor;
    const clampedW = Math.max(200, Math.min(newW, nat ? nat.w * 4 : 4000));
    const ratio = clampedW / img.offsetWidth;
    img.style.width = `${clampedW}px`;
    img.style.height = `${img.offsetHeight * ratio}px`;
    container.scrollLeft = ox * ratio - (e.clientX - container.getBoundingClientRect().left);
    container.scrollTop = oy * ratio - (e.clientY - container.getBoundingClientRect().top);
  }

  function onTouchStart(e) {
    if (e.touches.length === 2) {
      lastDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }

  function onTouchMove(e) {
    if (e.touches.length !== 2 || !lastDist.current) return;
    e.preventDefault();
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const factor = dist / lastDist.current;
    lastDist.current = dist;
    const img = imgRef.current;
    if (!img) return;
    const newW = Math.max(200, img.offsetWidth * factor);
    img.style.width = `${newW}px`;
    img.style.height = "auto";
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/90 flex flex-col animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex justify-end p-3 flex-shrink-0">
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white text-2xl leading-none px-2"
        >
          &times;
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-auto cursor-zoom-in"
        style={{ overscrollBehavior: "contain" }}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
      >
        <div style={{ position: "relative", display: "inline-block", minWidth: "100%", minHeight: "100%" }}>
          <img
            ref={imgRef}
            src={photoUrl}
            alt="shelf"
            draggable={false}
            style={{ display: "block", maxWidth: "none" }}
            onLoad={(e) => setNat({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
          />
          {nat && bbox && (() => {
            const [x, y, w, h] = bbox;
            const imgW = imgRef.current?.offsetWidth || nat.w;
            const imgH = imgRef.current?.offsetHeight || nat.h;
            return (
              <div
                style={{
                  position: "absolute",
                  left: x * imgW,
                  top: y * imgH,
                  width: w * imgW,
                  height: h * imgH,
                  border: "2px solid #f59e0b",
                  boxShadow: "0 0 0 2000px rgba(0,0,0,0.35)",
                  pointerEvents: "none",
                }}
              />
            );
          })()}
        </div>
      </div>

      <p className="text-center text-xs text-white/40 py-2 flex-shrink-0">
        Scroll or pinch to zoom · press Esc to close
      </p>
    </div>
  );
}
