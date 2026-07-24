export function Empty({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="panel stack" style={{ textAlign: "center", padding: 32 }}>
      <h3>{title}</h3>
      {description && <p className="muted">{description}</p>}
      {actionLabel && onAction && (
        <div>
          <button type="button" className="btn-primary" onClick={onAction}>
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
