import { useCallback, useEffect, useState } from "react";
import { App, Button, Form, Input, Select, Tag, Tooltip } from "antd";
import { PlusOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { authorApi, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { Paginated } from "../../lib/listQuery";
import { useListQuery } from "../../lib/useListQuery";
import { PageHeader, SearchToolbar, ServerTable, EntityModal, useDeleteConfirm, type EntityModalMode } from "../../components/crud";
import { authorSelectPopup, useAuthorLayout } from "../../lib/authorLayoutContext";

type EnrollmentRow = {
  id: string;
  user_id: string;
  display_name?: string;
  email?: string;
  course_title?: string;
  version_tag?: string;
  status: string;
  progress_pct?: number;
  offering_id?: string;
  identity_status?: string;
  cert_id?: string | null;
  cert_status?: string | null;
  on_chain?: boolean;
};

const IDENTITY_LABEL: Record<string, string> = {
  unverified: "未认证",
  pending: "审核中",
  verified: "已认证",
  rejected: "未通过",
};

export function LearnerCourses() {
  const { campId } = useAuth();
  const { getContentPopupContainer } = useAuthorLayout();
  const selectPopup = authorSelectPopup(getContentPopupContainer);
  const { message, modal } = App.useApp();
  const confirmDelete = useDeleteConfirm();
  const { page, page_size, q, filters, hasFilters, setPage, setFilter, reset } = useListQuery();
  const [data, setData] = useState<Paginated<EnrollmentRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<EntityModalMode>({ kind: "closed" });
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<{ value: string; label: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(
        await authorApi.listEnrollments({
          camp_id: campId || undefined,
          q: q || undefined,
          status: filters.status,
          page,
          page_size,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [campId, q, filters.status, page, page_size]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void authorApi
      .listOfferings({ camp_id: campId || undefined, page: 1, page_size: 50 })
      .then((res) =>
        setOfferings(
          (res.items || []).map((o: { id: string; course_title?: string; version_tag?: string }) => ({
            value: o.id,
            label: `${o.course_title || o.id} · ${o.version_tag || ""}`,
          })),
        ),
      )
      .catch(() => setOfferings([]));
  }, [campId]);

  const onIssueCertificate = (row: EnrollmentRow) => {
    modal.confirm({
      title: "颁发结业证书",
      content: (
        <div>
          <p>
            将为 <strong>{row.display_name || row.email || row.user_id}</strong> 颁发
            <strong> {row.course_title || "结业"}</strong> 结业证书。
          </p>
          <p style={{ marginBottom: 0, color: "var(--ant-color-text-secondary)" }}>
            颁证后将自动上链存证；学员可在「结业证书」页查看，公众可通过官网三要素核验。
          </p>
          {row.identity_status !== "verified" && (
            <p style={{ color: "#b45309", marginTop: 8 }}>
              该学员尚未完成实名认证，颁证可能失败（生产环境必须实名）。
            </p>
          )}
          {row.cert_id && row.cert_status === "issued" && (
            <p style={{ color: "#059669", marginTop: 8 }}>
              已有证书 {row.cert_id}
              {row.on_chain ? "（已上链）" : ""}
            </p>
          )}
        </div>
      ),
      okText: "确认颁证",
      cancelText: "取消",
      onOk: async () => {
        setIssuingId(row.id);
        try {
          const res = await authorApi.issueCertificate({ enrollment_id: row.id });
          message.success(`已颁发证书 ${res.cert_id || ""}`);
          await load();
        } catch (err) {
          message.error(err instanceof ApiError ? err.message : "颁证失败");
          throw err;
        } finally {
          setIssuingId(null);
        }
      },
    });
  };

  return (
    <div>
      <PageHeader
        title="学员与课程"
        description="查看学员报名、实名与结业证书；完成学习后可一键颁证上链"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              setMode({ kind: "create" });
            }}
          >
            分配课程
          </Button>
        }
      />
      <SearchToolbar
        fields={[
          { key: "q", type: "search", label: "搜索", placeholder: "姓名 / 邮箱" },
          {
            key: "status",
            type: "select",
            label: "状态",
            placeholder: "报名状态",
            options: [
              { value: "active", label: "active" },
              { value: "dropped", label: "dropped" },
              { value: "completed", label: "completed" },
            ],
          },
        ]}
        values={{ q: q || undefined, status: filters.status }}
        onChange={setFilter}
        onReset={hasFilters ? reset : undefined}
      />
      <ServerTable<EnrollmentRow>
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={() => void load()}
        data={data}
        onPageChange={setPage}
        columns={[
          { title: "学员", render: (_, r) => r.display_name || r.email || r.user_id },
          { title: "邮箱", dataIndex: "email", responsive: ["md"] },
          { title: "课程", dataIndex: "course_title" },
          {
            title: "实名",
            dataIndex: "identity_status",
            responsive: ["md"],
            render: (s?: string) => (
              <Tag color={s === "verified" ? "success" : s === "pending" ? "processing" : "default"}>
                {IDENTITY_LABEL[s || "unverified"] || s}
              </Tag>
            ),
          },
          { title: "版本", dataIndex: "version_tag", responsive: ["lg"] },
          { title: "状态", dataIndex: "status", render: (s: string) => <Tag>{s}</Tag> },
          {
            title: "进度",
            dataIndex: "progress_pct",
            render: (n?: number) => (n != null ? `${Math.round(n)}%` : "—"),
          },
          {
            title: "证书",
            responsive: ["lg"],
            render: (_, r) =>
              r.cert_id && r.cert_status === "issued" ? (
                <Tooltip title={r.on_chain ? "已上链" : "已颁发"}>
                  <Tag color="green">{r.cert_id}</Tag>
                </Tooltip>
              ) : (
                <span style={{ color: "#999" }}>—</span>
              ),
          },
          {
            title: "操作",
            render: (_, r) => (
              <>
                <Button
                  type="link"
                  icon={<SafetyCertificateOutlined />}
                  loading={issuingId === r.id}
                  onClick={() => onIssueCertificate(r)}
                >
                  颁证
                </Button>
                {r.cert_id && (
                  <Link to={`/verify?cert_id=${encodeURIComponent(r.cert_id)}`} target="_blank">
                    核验
                  </Link>
                )}
                <Button
                  type="link"
                  onClick={() =>
                    confirmDelete({
                      name: r.display_name || r.email || r.id,
                      impact: r.status === "dropped" ? "将恢复为 active" : "将标记为 dropped（不删除历史进度）",
                      onOk: async () => {
                        await authorApi.patchEnrollment(r.id, {
                          status: r.status === "dropped" ? "active" : "dropped",
                        });
                        message.success("已更新");
                        await load();
                      },
                    })
                  }
                >
                  {r.status === "dropped" ? "恢复" : "停用"}
                </Button>
              </>
            ),
          },
        ]}
      />
      <EntityModal
        mode={mode}
        title={{ create: "分配课程", edit: "分配", view: "查看" }}
        form={form}
        submitting={submitting}
        onClose={() => setMode({ kind: "closed" })}
        onSubmit={async (values: { user_id: string; offering_id: string }) => {
          setSubmitting(true);
          try {
            await authorApi.createEnrollment(values);
            message.success("已分配");
            setMode({ kind: "closed" });
            await load();
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item name="user_id" label="学员用户 ID" rules={[{ required: true }]}>
          <Input placeholder="users.id" />
        </Form.Item>
        <Form.Item name="offering_id" label="课程 Offering" rules={[{ required: true }]}>
          <Select options={offerings} showSearch optionFilterProp="label" getPopupContainer={selectPopup} />
        </Form.Item>
      </EntityModal>
    </div>
  );
}
