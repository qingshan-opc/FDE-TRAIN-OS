import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Collapse } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { billingApi, ApiError } from "../lib/api";
import { Nav } from "../components/Nav";
import { PaymentModal } from "../components/PaymentModal";
import { Skeleton } from "../components/Skeleton";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/Toast";
import { isMobilePhoneUa } from "../lib/device";
import {
  SHOP_DEFAULT_PITCH,
  SHOP_FIT,
  SHOP_HERO,
  SHOP_OUTCOMES,
  SHOP_TRUST,
  SHOP_WEEKS,
} from "./shopPitch";

type ModulePreview = { day_index: number; title: string };

type Offering = {
  id: string;
  title: string;
  course_title?: string;
  course_slug?: string;
  description?: string;
  price_fen: number;
  purchased?: boolean;
  enrolled?: boolean;
  module_count?: number;
  modules?: ModulePreview[];
  cover_image?: string;
  gallery?: string[];
};

function pitchFor(it: Offering): string {
  const d = (it.description || "").trim();
  if (d && !d.includes("迁移生成") && d.length >= 20) return d;
  return SHOP_DEFAULT_PITCH;
}

function formatPrice(fen: number) {
  const n = fen / 100;
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

export function CourseShop() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [items, setItems] = useState<Offering[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payOfferingId, setPayOfferingId] = useState<string | null>(null);
  const [amountFen, setAmountFen] = useState(0);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const autoPayRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await billingApi.listOfferings();
      const list = (res.items || []) as Offering[];
      setItems(list);
      setActiveId((prev) => {
        if (prev && list.some((x) => x.id === prev)) return prev;
        return list[0]?.id || null;
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const offering = useMemo(
    () => items.find((x) => x.id === activeId) || items[0] || null,
    [items, activeId],
  );

  const modules = offering?.modules || [];
  const owned = Boolean(offering?.purchased || offering?.enrolled);
  const priceLabel = offering ? formatPrice(offering.price_fen) : "—";

  const weekPanels = useMemo(() => {
    return SHOP_WEEKS.map((w) => {
      const days = modules
        .filter((m) => m.day_index >= w.dayFrom && m.day_index <= w.dayTo)
        .sort((a, b) => a.day_index - b.day_index);
      return {
        key: String(w.week),
        label: (
          <div className="shop-week__label">
            <strong>
              {w.title} · {w.subtitle}
            </strong>
            <span>{days.length ? `${days.length} 个学习日` : "课纲持续更新"}</span>
          </div>
        ),
        children:
          days.length > 0 ? (
            <ol className="shop-week__days">
              {days.map((m) => (
                <li key={m.day_index}>
                  <span className="mono">D{String(m.day_index).padStart(2, "0")}</span>
                  {m.title}
                </li>
              ))}
            </ol>
          ) : (
            <p className="shop-week__empty">该周课纲由教研持续更新，开营后可见完整日程。</p>
          ),
      };
    });
  }, [modules]);

  const onBuy = () => {
    if (!offering) return;
    setBuyingId(offering.id);
    setPayOfferingId(offering.id);
    setAmountFen(offering.price_fen);
    setPayOpen(true);
    setBuyingId(null);
  };

  useEffect(() => {
    if (autoPayRef.current) return;
    if (params.get("pay") !== "1") return;
    if (loading || !offering || owned) return;
    autoPayRef.current = true;
    setPayOfferingId(offering.id);
    setAmountFen(offering.price_fen);
    setPayOpen(true);
    const next = new URLSearchParams(params);
    next.delete("pay");
    setParams(next, { replace: true });
  }, [loading, offering, owned, params, setParams]);

  const onPaid = () => {
    setPayOpen(false);
    toast.push("支付成功，已开通课程", "success");
    void load();
    // 手机继续留在选购页；电脑再进学习台
    if (!isMobilePhoneUa()) {
      nav("/app/courses");
    } else {
      toast.push("学习请用电脑打开 fde.818cloud.com", "info");
    }
  };

  return (
    <div className="course-picker-shell shop-landing-shell">
      <Nav variant="learner" />
      <div className="shop-landing">
        {loading ? (
          <Skeleton rows={10} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : !offering ? (
          <div className="course-shop-empty">暂无可购课程，请稍后再来或联系运营开通营期。</div>
        ) : (
          <>
            {items.length > 1 && (
              <div className="shop-offering-tabs" role="tablist" aria-label="可选营期">
                {items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    role="tab"
                    aria-selected={it.id === offering.id}
                    className={`shop-offering-tabs__item${it.id === offering.id ? " is-active" : ""}`}
                    onClick={() => setActiveId(it.id)}
                  >
                    {it.course_title || it.title}
                  </button>
                ))}
              </div>
            )}

            <section className="shop-hero">
              <div
                className={`shop-hero__media${offering.cover_image ? "" : " shop-hero__media--ink"}`}
                style={
                  offering.cover_image
                    ? { backgroundImage: `url(${offering.cover_image})` }
                    : undefined
                }
              >
                <div className="shop-hero__fade" />
                <div className="shop-hero__content">
                  <p className="shop-hero__eyebrow">{SHOP_HERO.eyebrow}</p>
                  <h1 className="shop-hero__title">{SHOP_HERO.title}</h1>
                  <p className="shop-hero__subtitle">{SHOP_HERO.subtitle}</p>
                  <div className="shop-hero__chips">
                    {SHOP_HERO.chips.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                    {owned && <span className="is-owned">已拥有</span>}
                  </div>
                </div>
              </div>
              <p className="shop-hero__pitch">{pitchFor(offering)}</p>
            </section>

            <section className="shop-section">
              <h2 className="shop-section__title">你将带走</h2>
              <ul className="shop-outcomes">
                {SHOP_OUTCOMES.map((line) => (
                  <li key={line}>
                    <CheckCircleOutlined />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="shop-section">
              <h2 className="shop-section__title">三周路径</h2>
              <Collapse
                className="shop-weeks"
                bordered={false}
                defaultActiveKey={["1"]}
                items={weekPanels}
              />
            </section>

            <section className="shop-section shop-fit">
              <div className="shop-fit__col shop-fit__col--yes">
                <h3>适合谁</h3>
                <ul>
                  {SHOP_FIT.yes.map((t) => (
                    <li key={t}>
                      <CheckCircleOutlined />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="shop-fit__col shop-fit__col--no">
                <h3>不太适合</h3>
                <ul>
                  {SHOP_FIT.no.map((t) => (
                    <li key={t}>
                      <CloseCircleOutlined />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="shop-section shop-trust">
              <div className="shop-trust__cert">
                <SafetyCertificateOutlined />
                <div>
                  <strong>结业与背书</strong>
                  <p>{SHOP_TRUST.cert}</p>
                </div>
              </div>
              <blockquote className="shop-trust__quote">
                <p>“{SHOP_TRUST.quote}”</p>
                <footer>— {SHOP_TRUST.quoteBy}</footer>
              </blockquote>
            </section>

            <div className="shop-bottom-spacer" aria-hidden />
          </>
        )}
      </div>

      {offering && !loading && !error && (
        <div className="shop-sticky-cta">
          <div className="shop-sticky-cta__price">
            <span className="shop-sticky-cta__yen">¥</span>
            <span className="shop-sticky-cta__num">{priceLabel}</span>
            <span className="shop-sticky-cta__note">
              {owned ? "已开通本课程" : "支付成功立即开通"}
            </span>
          </div>
          {owned ? (
            <Button
              type="primary"
              size="large"
              className="shop-sticky-cta__btn"
              onClick={() => {
                if (isMobilePhoneUa()) {
                  toast.push("学习请用电脑浏览器打开 fde.818cloud.com", "info");
                  return;
                }
                nav("/app/courses");
              }}
            >
              {isMobilePhoneUa() ? "请用电脑学习" : "进入学习"}
            </Button>
          ) : (
            <Button
              type="primary"
              size="large"
              className="shop-sticky-cta__btn"
              loading={buyingId === offering.id}
              onClick={() => onBuy()}
            >
              立即开通
            </Button>
          )}
        </div>
      )}

      <PaymentModal
        open={payOpen}
        offeringId={payOfferingId}
        amountFen={amountFen}
        onClose={() => setPayOpen(false)}
        onPaid={onPaid}
      />
    </div>
  );
}
