/** HTML course cover — scales in the spotlight and the list card. */

export function CoursePosterArt({ variant = "card" }: { variant?: "hero" | "card" }) {
  return (
    <div className={`fde-poster fde-poster--${variant}`} aria-hidden>
      <div className="fde-poster__sky" />
      <div className="fde-poster__copy">
        <span className="fde-poster__kicker">零基础</span>
        <span className="fde-poster__row">
          <em className="fde-poster__of">of</em>
          <span className="fde-poster__badge">企业AI</span>
        </span>
        <strong className="fde-poster__title">项目实战训练营</strong>
      </div>
      <div className="fde-poster__scene">
        <span className="fde-poster__hud fde-poster__hud--a">
          <i />
          <i />
          <i />
        </span>
        <span className="fde-poster__hud fde-poster__hud--b">
          <b />
          <b />
        </span>
        <svg className="fde-poster__bot" viewBox="0 0 160 180" fill="none">
          <ellipse cx="80" cy="170" rx="54" ry="9" fill="#7ec8ff" opacity="0.5" />
          <ellipse cx="80" cy="168" rx="36" ry="5" fill="#fff" opacity="0.85" />
          <rect x="50" y="82" width="60" height="66" rx="20" fill="#f4f9ff" stroke="#c5e2ff" strokeWidth="2" />
          <rect x="66" y="100" width="28" height="18" rx="5" fill="#d9edff" />
          <rect x="70" y="106" width="8" height="3" rx="1" fill="#2f86ff" />
          <rect x="81" y="106" width="8" height="3" rx="1" fill="#7ec8ff" />
          <path d="M50 22c0-18 60-18 60 0" stroke="#2f86ff" strokeWidth="9" strokeLinecap="round" />
          <circle cx="48" cy="56" r="11" fill="#2f86ff" />
          <circle cx="112" cy="56" r="11" fill="#2f86ff" />
          <rect x="44" y="30" width="72" height="58" rx="26" fill="#fff" stroke="#c5e2ff" strokeWidth="2" />
          <ellipse cx="66" cy="56" rx="8" ry="10" fill="#2f86ff" />
          <ellipse cx="94" cy="56" rx="8" ry="10" fill="#2f86ff" />
          <circle cx="64" cy="53" r="2.6" fill="#fff" />
          <circle cx="92" cy="53" r="2.6" fill="#fff" />
          <path d="M72 72c5 7 12 7 17 0" stroke="#9bbfe8" strokeWidth="3" strokeLinecap="round" />
          <circle cx="42" cy="108" r="8" fill="#eef6ff" stroke="#c5e2ff" strokeWidth="2" />
          <circle cx="118" cy="108" r="8" fill="#eef6ff" stroke="#c5e2ff" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}
