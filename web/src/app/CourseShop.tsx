import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, QRCode, Tag, Typography } from "antd";
import { CheckCircleOutlined, RocketOutlined, SafetyCertificateOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { billingApi, ApiError } from "../lib/api";
import { Nav } from "../components/Nav";
import { PaymentModal } from "../components/PaymentModal";
import { Skeleton } from "../components/Skeleton";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/Toast";

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

type PaySlot = {
  orderId: string;
  codeUrl: string | null;
  amountFen: number;
  devMode: boolean;
  loading: boolean;
  error: string | null;
};

const HIGHLIGHTS = [
  { icon: <RocketOutlined />, title: "任务驱动", desc: "每天一个可验收交付，不是听课刷课" },
  { icon: <ThunderboltOutlined />, title: "Agent 实训", desc: "真实隔离工作区，全程留痕可复盘" },
  { icon: <SafetyCertificateOutlined />, title: "可核验证书", desc: "结业证书公开可查，附带证据链" },
] as const;

const DEFAULT_PITCH =
  "两周任务驱动训练营：从组建 AI 项目团队，到做出可验收交付与 Agent Skill，成为懂业务的技术落地者（FDE）。";

function pitchFor(it: Offering): string {
  const d = (it.description || "").trim();
  if (d && !d.includes("迁移生成") && d.length >= 20) return d;
  return DEFAULT_PITCH;
}

export function CourseShop() {
  const nav = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [codeUrl, setCodeUrl] = useState<string | null>(null);
  const [amountFen, setAmountFen] = useState(0);
  const [devMode, setDevMode] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [paySlots, setPaySlots] = useState<Record<string, PaySlot>>({});
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await billingApi.listOfferings();
      setItems((res.items || []) as Offering[]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ensurePayQr = useCallback(async (offeringId: string) => {
    setPaySlots((prev) => ({
      ...prev,
      [offeringId]: {
        orderId: prev[offeringId]?.orderId || "",
        codeUrl: prev[offeringId]?.codeUrl || null,
        amountFen: prev[offeringId]?.amountFen || 0,
        devMode: prev[offeringId]?.devMode || false,
        loading: true,
        error: null,
      },
    }));
    try {
      const res = await billingApi.checkout(offeringId);
      setPaySlots((prev) => ({
        ...prev,
        [offeringId]: {
          orderId: res.order_id,
          codeUrl: res.code_url || null,
          amountFen: res.amount_fen,
          devMode: !!res.dev_mode,
          loading: false,
          error: null,
        },
      }));
    } catch (err) {
      setPaySlots((prev) => ({
        ...prev,
        [offeringId]: {
          orderId: "",
          codeUrl: null,
          amountFen: 0,
          devMode: false,
          loading: false,
          error: err instanceof ApiError ? err.message : "无法生成支付码",
        },
      }));
    }
  }, []);

  // Auto-create pay QR for unowned offerings
  useEffect(() => {
    for (const it of items) {
      if (it.purchased || it.enrolled) continue;
      if (paySlots[it.id]?.orderId || paySlots[it.id]?.loading) continue;
      void ensurePayQr(it.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when items change
  }, [items, ensurePayQr]);

  // Poll pending inline orders
  useEffect(() => {
    const pending = Object.values(paySlots).filter((s) => s.orderId && !s.devMode);
    if (pending.length === 0) return;
    const tick = async () => {
      for (const s of pending) {
        try {
          const res = await billingApi.syncOrder(s.orderId);
          if (res.status === "paid") {
            toast.push("支付成功，已开通课程", "success");
            void load();
            nav("/app/courses");
            return;
          }
        } catch {
          /* ignore */
        }
      }
    };
    void tick();
    pollRef.current = window.setInterval(() => void tick(), 2500);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [paySlots, load, nav, toast]);

  const onBuy = async (offeringId: string) => {
    setBuyingId(offeringId);
    try {
      const existing = paySlots[offeringId];
      if (existing?.orderId && existing.codeUrl) {
        setOrderId(existing.orderId);
        setCodeUrl(existing.codeUrl);
        setAmountFen(existing.amountFen);
        setDevMode(existing.devMode);
        setPayOpen(true);
        return;
      }
      const res = await billingApi.checkout(offeringId);
      setOrderId(res.order_id);
      setCodeUrl(res.code_url || null);
      setAmountFen(res.amount_fen);
      setDevMode(!!res.dev_mode);
      setPayOpen(true);
      setPaySlots((prev) => ({
        ...prev,
        [offeringId]: {
          orderId: res.order_id,
          codeUrl: res.code_url || null,
          amountFen: res.amount_fen,
          devMode: !!res.dev_mode,
          loading: false,
          error: null,
        },
      }));
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "下单失败", "error");
    } finally {
      setBuyingId(null);
    }
  };

  const onPaid = () => {
    setPayOpen(false);
    toast.push("支付成功，已开通课程", "success");
    void load();
    nav("/app/courses");
  };

  return (
    <div className="course-picker-shell">
      <Nav variant="learner" />
      <div className="course-picker-page course-shop-page">
        <header className="course-shop-hero">
          <p className="course-dashboard-kicker">COURSE CATALOG</p>
          <Typography.Title level={2} className="course-shop-hero__title">
            选购课程
          </Typography.Title>
          <Typography.Paragraph className="course-shop-hero__lead">
            支付成功后自动开通报名。用真实任务练出交付力——不只是「会用 AI」，而是能把业务做成可验收结果。
          </Typography.Paragraph>
          <div className="course-shop-trust">
            {HIGHLIGHTS.map((h) => (
              <div className="course-shop-trust__item" key={h.title}>
                <span className="course-shop-trust__icon">{h.icon}</span>
                <div>
                  <strong>{h.title}</strong>
                  <p>{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </header>

        {loading ? (
          <Skeleton rows={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : items.length === 0 ? (
          <div className="course-shop-empty">暂无可购课程，请稍后再来或联系运营开通营期。</div>
        ) : (
          <div className="course-shop-list">
            {items.map((it) => {
              const owned = it.purchased || it.enrolled;
              const title = it.course_title || it.title;
              const price = (it.price_fen / 100).toFixed(2);
              const modules = it.modules || [];
              const gallery = it.gallery?.length
                ? it.gallery
                : ["/landing/story-task.png", "/landing/story-agent.png", "/landing/story-cert.png"];
              const slot = paySlots[it.id];
              return (
                <article className="course-shop-card" key={it.id}>
                  <div className="course-shop-card__media">
                    <img
                      className="course-shop-card__cover"
                      src={it.cover_image || "/landing/hero.png"}
                      alt={title}
                      loading="lazy"
                    />
                    <div className="course-shop-card__media-fade" />
                    <div className="course-shop-card__badges">
                      <Tag color="cyan">两周集训</Tag>
                      {(it.module_count || modules.length) > 0 && (
                        <Tag color="blue">{it.module_count || modules.length} 天课纲</Tag>
                      )}
                      {owned && <Tag color="success">已拥有</Tag>}
                    </div>
                  </div>

                  <div className="course-shop-card__body">
                    <div className="course-shop-card__main">
                      <h3 className="course-shop-card__title">{title}</h3>
                      {it.title && it.title !== title && (
                        <p className="course-shop-card__subtitle">{it.title}</p>
                      )}
                      <p className="course-shop-card__desc">{pitchFor(it)}</p>

                      <ul className="course-shop-card__bullets">
                        <li>
                          <CheckCircleOutlined /> 每天一个可验收交付，做完就能展示
                        </li>
                        <li>
                          <CheckCircleOutlined /> Agent / Skill 实训，把工作方式教给 AI
                        </li>
                        <li>
                          <CheckCircleOutlined /> 结业答辩 + 可核验证书，组织敢认
                        </li>
                      </ul>

                      {modules.length > 0 && (
                        <div className="course-shop-syllabus">
                          <p className="course-shop-syllabus__label">课纲速览</p>
                          <ol className="course-shop-syllabus__list">
                            {modules.slice(0, 6).map((m) => (
                              <li key={m.day_index}>
                                <span className="mono">D{String(m.day_index).padStart(2, "0")}</span>
                                {m.title}
                              </li>
                            ))}
                          </ol>
                          {(it.module_count || modules.length) > 6 && (
                            <p className="course-shop-syllabus__more">
                              另有 {(it.module_count || modules.length) - 6} 天进阶内容…
                            </p>
                          )}
                        </div>
                      )}

                      <div className="course-shop-gallery" aria-hidden="true">
                        {gallery.map((src, idx) => (
                          <img key={src} src={src} alt="" loading="lazy" className={`is-${idx}`} />
                        ))}
                      </div>
                    </div>

                    <aside className="course-shop-card__cta">
                      {!owned && (
                        <div className="course-shop-payqr">
                          {slot?.loading && (
                            <Typography.Text type="secondary">正在生成支付码…</Typography.Text>
                          )}
                          {slot?.error && (
                            <Alert
                              type="warning"
                              showIcon
                              message={slot.error}
                              action={
                                <Button size="small" onClick={() => void ensurePayQr(it.id)}>
                                  重试
                                </Button>
                              }
                            />
                          )}
                          {slot?.devMode && (
                            <Alert type="info" showIcon message="开发模式：可点下方按钮模拟支付" />
                          )}
                          {slot?.codeUrl && !slot.codeUrl.startsWith("dev://") && (
                            <>
                              <QRCode value={slot.codeUrl} size={168} />
                              <p className="course-shop-payqr__tip">微信扫一扫 · 支付后自动开通</p>
                            </>
                          )}
                        </div>
                      )}
                      <div className="course-shop-price">
                        <span className="course-shop-price__label">优惠价</span>
                        <div className="course-shop-price__row">
                          <span className="course-shop-price__yen">¥</span>
                          <span className="course-shop-price__num">{price}</span>
                        </div>
                        <p className="course-shop-price__note">
                          {owned ? "已开通本课程" : "支付成功立即开通 · 微信扫码"}
                        </p>
                      </div>
                      {owned ? (
                        <Button type="primary" size="large" block onClick={() => nav("/app/courses")}>
                          已开通 · 去学习
                        </Button>
                      ) : (
                        <Button
                          type="primary"
                          size="large"
                          block
                          loading={buyingId === it.id}
                          onClick={() => void onBuy(it.id)}
                        >
                          {slot?.devMode ? "模拟支付 / 放大支付码" : "放大支付码"}
                        </Button>
                      )}
                      <Button type="link" block onClick={() => nav("/app/courses")}>
                        先看看我的课程
                      </Button>
                    </aside>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      <PaymentModal
        open={payOpen}
        orderId={orderId}
        codeUrl={codeUrl}
        amountFen={amountFen}
        devMode={devMode}
        onClose={() => setPayOpen(false)}
        onPaid={onPaid}
      />
    </div>
  );
}
