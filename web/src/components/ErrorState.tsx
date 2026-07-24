export function ErrorState({
  title = "加载失败",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="panel stack" role="alert" style={{ borderColor: "var(--color-danger)" }}>
      <h3 style={{ color: "var(--color-danger)" }}>{title}</h3>
      {message && <p className="muted">{message}</p>}
      {onRetry && (
        <div>
          <button type="button" className="btn-primary" onClick={onRetry}>
            重试
          </button>
        </div>
      )}
    </div>
  );
}
