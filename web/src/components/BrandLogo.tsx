import { Link } from "react-router-dom";

const MARK = "/brand/qingshanzai-mark.svg";
const MARK_LIGHT = "/brand/qingshanzai-mark-light.svg";

export function BrandLogo({
  name = "青山在",
  to = "/",
  variant = "default",
  showText = true,
  className = "",
  seal = false,
  subtitle,
}: {
  name?: string;
  to?: string;
  variant?: "default" | "light";
  showText?: boolean;
  className?: string;
  /** 营销页朱文印章变体 */
  seal?: boolean;
  subtitle?: string;
}) {
  if (seal) {
    const cls = ["ink-brand-logo", variant === "light" ? "ink-brand-logo--light" : "", className]
      .filter(Boolean)
      .join(" ");
    const content = (
      <>
        <span className="ink-seal-mark" aria-hidden="true">
          青
          <br />
          山
        </span>
        {showText ? (
          <span>
            <span className="ink-brand-logo__name">{name}</span>
            {subtitle ? <span className="ink-brand-logo__sub">{subtitle}</span> : null}
          </span>
        ) : null}
      </>
    );
    if (to) {
      return (
        <Link to={to} className={cls} aria-label={name}>
          {content}
        </Link>
      );
    }
    return <span className={cls}>{content}</span>;
  }

  const markSrc = variant === "light" ? MARK_LIGHT : MARK;
  const content = (
    <>
      <img className="brand-logo__mark" src={markSrc} alt="" aria-hidden="true" />
      {showText ? <span className="brand-logo__name">{name}</span> : null}
    </>
  );

  const cls = ["brand-logo", variant === "light" ? "brand-logo--light" : "", className]
    .filter(Boolean)
    .join(" ");

  if (to) {
    return (
      <Link to={to} className={cls} aria-label={name}>
        {content}
      </Link>
    );
  }

  return <span className={cls}>{content}</span>;
}
