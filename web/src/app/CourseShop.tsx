import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, List, Tag, Typography } from "antd";
import { billingApi, ApiError } from "../lib/api";
import { Nav } from "../components/Nav";
import { PaymentModal } from "../components/PaymentModal";
import { Skeleton } from "../components/Skeleton";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/Toast";

type Offering = {
  id: string;
  title: string;
  course_title?: string;
  price_fen: number;
  purchased?: boolean;
  enrolled?: boolean;
};

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

  const onBuy = async (offeringId: string) => {
    setBuyingId(offeringId);
    try {
      const res = await billingApi.checkout(offeringId);
      setOrderId(res.order_id);
      setCodeUrl(res.code_url || null);
      setAmountFen(res.amount_fen);
      setDevMode(!!res.dev_mode);
      setPayOpen(true);
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
      <div className="course-picker-page" style={{ maxWidth: 720, margin: "0 auto" }}>
        <Typography.Title level={3}>选购课程</Typography.Title>
        <Typography.Paragraph type="secondary">支付成功后自动开通报名，可在「我的课程」进入学习</Typography.Paragraph>
        {loading ? (
          <Skeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : (
          <List
            dataSource={items}
            locale={{ emptyText: "暂无可购课程" }}
            renderItem={(it) => {
              const owned = it.purchased || it.enrolled;
              return (
                <List.Item>
                  <Card style={{ width: "100%" }} size="small">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
                      <div>
                        <Typography.Text strong>{it.course_title || it.title}</Typography.Text>
                        {it.course_title && it.title !== it.course_title && (
                          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                            {it.title}
                          </Typography.Paragraph>
                        )}
                        <div style={{ marginTop: 8 }}>
                          <Tag color="blue">¥{(it.price_fen / 100).toFixed(2)}</Tag>
                          {owned && <Tag color="green">已拥有</Tag>}
                        </div>
                      </div>
                      {owned ? (
                        <Button onClick={() => nav("/app/courses")}>去学习</Button>
                      ) : (
                        <Button type="primary" loading={buyingId === it.id} onClick={() => void onBuy(it.id)}>
                          去支付
                        </Button>
                      )}
                    </div>
                  </Card>
                </List.Item>
              );
            }}
          />
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
