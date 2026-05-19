import { useState } from "react";

export default function SpineCrop({ photoUrl, bbox, width = 52, height = 110 }) {
  const [nat, setNat] = useState(null);
  const [x, y, w, h] = bbox;

  let imgStyle = { position: "absolute", opacity: 0 };
  if (nat) {
    const scale = width / (w * nat.w);
    imgStyle = {
      position: "absolute",
      width: nat.w * scale,
      height: nat.h * scale,
      left: -x * nat.w * scale,
      top: -y * nat.h * scale,
      opacity: 1,
    };
  }

  return (
    <div
      style={{ width, height, overflow: "hidden", position: "relative", borderRadius: 4 }}
      className="bg-stone-200 flex-shrink-0"
    >
      <img
        src={photoUrl}
        onLoad={(e) => setNat({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
        style={imgStyle}
        alt="book spine"
        draggable={false}
      />
    </div>
  );
}
