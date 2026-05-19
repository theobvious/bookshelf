import { useState, useEffect } from "react";

export default function SpineCrop({ photoUrl, bbox, width = 52, height = 110, onClick }) {
  const [nat, setNat] = useState(null);
  const [x, y, w, h] = bbox;

  useEffect(() => {
    const img = new Image();
    img.onload = () => setNat({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setNat(null);
    img.src = photoUrl;
  }, [photoUrl]);

  const divStyle = nat
    ? (() => {
        const scale = width / (w * nat.w);
        return {
          backgroundImage: `url(${photoUrl})`,
          backgroundSize: `${nat.w * scale}px ${nat.h * scale}px`,
          backgroundPosition: `${-(x * nat.w * scale)}px ${-(y * nat.h * scale)}px`,
          backgroundRepeat: "no-repeat",
        };
      })()
    : {};

  return (
    <div
      onClick={onClick}
      style={{ width, height, borderRadius: 4, flexShrink: 0, cursor: onClick ? "zoom-in" : "default", ...divStyle }}
      className="bg-stone-200"
    />
  );
}
