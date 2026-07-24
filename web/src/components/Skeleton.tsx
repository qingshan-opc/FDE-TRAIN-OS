export function Skeleton({ rows = 4, height = 16 }: { rows?: number; height?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="加载中">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height, width: i === rows - 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  );
}
