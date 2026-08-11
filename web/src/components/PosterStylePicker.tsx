import { POSTER_STYLES, type PosterStyleId } from "../lib/sharePosters";

export function PosterStylePicker({
  value,
  onChange,
  disabled,
}: {
  value: PosterStyleId;
  onChange: (id: PosterStyleId) => void;
  disabled?: boolean;
}) {
  return (
    <div className="poster-style-picker" role="radiogroup" aria-label="海报风格">
      {POSTER_STYLES.map((s) => {
        const active = value === s.id;
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            className={`poster-style-picker__item${active ? " is-active" : ""}`}
            onClick={() => onChange(s.id)}
          >
            <span className="poster-style-picker__swatches" aria-hidden="true">
              {s.swatch.map((c) => (
                <i key={c} style={{ background: c }} />
              ))}
            </span>
            <span className="poster-style-picker__meta">
              <strong>{s.name}</strong>
              <em>{s.blurb}</em>
            </span>
          </button>
        );
      })}
    </div>
  );
}
