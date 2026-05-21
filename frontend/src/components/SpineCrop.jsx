export default function SpineCrop({ photoUrl, bbox, width = 52, height = 110, onClick }) {
  const [x, y, bw, bh] = bbox;

  // Scale the image so the bbox fraction fills the container, then offset to that region.
  // Using percentage-based width/height relative to the container so no natural-size preload needed.
  return (
    <div
      onClick={onClick}
      style={{ width, height, borderRadius: 4, overflow: "hidden", flexShrink: 0, cursor: onClick ? "zoom-in" : "default", position: "relative" }}
      className="bg-stone-200"
    >
      <img
        src={photoUrl}
        alt=""
        style={{
          position: "absolute",
          width: `${(1 / bw) * 100}%`,
          height: `${(1 / bh) * 100}%`,
          maxWidth: "none",
          left: `${(-x / bw) * 100}%`,
          top: `${(-y / bh) * 100}%`,
        }}
      />
    </div>
  );
}
