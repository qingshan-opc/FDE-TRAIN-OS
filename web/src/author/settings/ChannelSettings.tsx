import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  QRCode,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
  message,
} from "antd";
import { partnerAdminApi, partnerApi, ApiError } from "../../lib/api";
import { buildOrgRegisterUrl } from "../../lib/inviteLink";
import { SHARE_HOLD_COPY } from "../../lib/billingLabels";
import { wechatMpEntryUrl } from "../../lib/wechat";

type Org = Record<string, unknown> & {
  id: string;
  name: string;
  contact_name?: string;
  contact_email?: string;
  wx_receiver_type?: string;
  wx_receiver_account?: string;
  wx_receiver_name?: string;
  stats?: { invited_users: number; paid_users: number; current_rate_pct: number };
};

export function ChannelSettings() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [codes, setCodes] = useState<Record<string, unknown>[]>([]);
  const [attributions, setAttributions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgModal, setOrgModal] = useState(false);
  const [codeModal, setCodeModal] = useState(false);
  const [accountModal, setAccountModal] = useState(false);
  const [activationModal, setActivationModal] = useState(false);
  const [activationCodes, setActivationCodes] = useState<Record<string, unknown>[]>([]);
  const [activateEntryUrl, setActivateEntryUrl] = useState(
    () => `${window.location.origin}${wechatMpEntryUrl("/partner/activate")}`,
  );
  const [form] = Form.useForm();
  const [codeForm] = Form.useForm();
  const [accountForm] = Form.useForm();
  const [activationForm] = Form.useForm();
  const [tierRows, setTierRows] = useState<{ key: string; min_paid_users: number; rate_pct: number }[]>([]);

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await partnerAdminApi.listOrgs();
      const items = (res.items || []) as Org[];
      setOrgs(items);
      if (!selectedOrgId && items[0]) setSelectedOrgId(items[0].id);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId]);

  const loadActivationCodes = useCallback(async () => {
    try {
      const res = await partnerAdminApi.listActivationCodes();
      setActivationCodes(res.items || []);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "加载开通码失败");
    }
  }, []);

  const loadOrgDetail = useCallback(async (orgId: string) => {
    try {
      const [c, t, a] = await Promise.all([
        partnerAdminApi.listInviteCodes(orgId),
        partnerAdminApi.getTiers(orgId),
        partnerAdminApi.listAttributions(orgId),
      ]);
      setCodes(c.items || []);
      const tierItems = t.items || [];
      setTierRows(
        tierItems.map((row, i) => ({
          key: String(i),
          min_paid_users: row.min_paid_users,
          rate_pct: row.rate_bps / 100,
        })),
      );
      setAttributions(a.items || []);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "加载机构详情失败");
    }
  }, []);

  useEffect(() => {
    void loadOrgs();
    void loadActivationCodes();
    void partnerApi
      .activateEntry()
      .then((res) => setActivateEntryUrl(res.entry_url))
      .catch(() => {
        /* keep relative fallback */
      });
  }, [loadOrgs, loadActivationCodes]);

  useEffect(() => {
    if (selectedOrgId) void loadOrgDetail(selectedOrgId);
  }, [selectedOrgId, loadOrgDetail]);

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId);

  const saveOrg = async () => {
    const values = await form.validateFields();
    try {
      if (values.id) {
        await partnerAdminApi.updateOrg(values.id, values);
      } else {
        const res = await partnerAdminApi.createOrg(values);
        setSelectedOrgId(String(res.org.id));
      }
      setOrgModal(false);
      form.resetFields();
      void loadOrgs();
      message.success("已保存");
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "保存失败");
    }
  };

  const saveCode = async () => {
    if (!selectedOrgId) return;
    const values = await codeForm.validateFields();
    try {
      await partnerAdminApi.createInviteCode(selectedOrgId, values);
      setCodeModal(false);
      codeForm.resetFields();
      void loadOrgDetail(selectedOrgId);
      message.success("邀请码已创建");
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "创建失败");
    }
  };

  const saveAccount = async () => {
    if (!selectedOrgId) return;
    const values = await accountForm.validateFields();
    try {
      await partnerAdminApi.createAccount(selectedOrgId, values);
      setAccountModal(false);
      accountForm.resetFields();
      message.success("机构账号已创建");
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "创建失败");
    }
  };

  const saveActivationCode = async () => {
    const values = await activationForm.validateFields();
    try {
      const res = await partnerAdminApi.createActivationCode({
        note: values.note || undefined,
        code: values.code || undefined,
      });
      setActivationModal(false);
      activationForm.resetFields();
      void loadActivationCodes();
      const code = String(res.activation_code?.code || "");
      if (code) {
        void navigator.clipboard.writeText(code);
        message.success(`开通码 ${code} 已创建并复制`);
      } else {
        message.success("开通码已创建");
      }
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "创建失败");
    }
  };

  const saveTiers = async () => {
    if (!selectedOrgId) return;
    try {
      await partnerAdminApi.setTiers(
        selectedOrgId,
        tierRows.map((r) => ({ min_paid_users: r.min_paid_users, rate_bps: Math.round(r.rate_pct * 100) })),
      );
      void loadOrgDetail(selectedOrgId);
      message.success("阶梯已保存");
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "保存失败");
    }
  };

  return (
    <div>
      <Typography.Title level={4}>渠道与分账</Typography.Title>
      <Typography.Paragraph type="secondary">管理机构、邀请码与归因明细。邀请链接分润默认 30%。</Typography.Paragraph>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={SHARE_HOLD_COPY.org.message}
        description={SHARE_HOLD_COPY.org.description}
      />

      <Card size="small" title="机构开通" style={{ marginBottom: 16 }}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          生成一次性开通码发给对应人员；对方从公众号「机构平台」或扫码进入，输入开通码即可成为机构账号。开通后邀请链接默认 30% 分润。
        </Typography.Paragraph>
        <Space align="start" size="large" wrap style={{ marginBottom: 16 }}>
          <div style={{ textAlign: "center" }}>
            <QRCode value={activateEntryUrl} size={140} />
            <div style={{ marginTop: 8 }}>
              <Button
                size="small"
                type="link"
                onClick={() => {
                  void navigator.clipboard.writeText(activateEntryUrl);
                  message.success("开通入口链接已复制");
                }}
              >
                复制开通链接
              </Button>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <Typography.Paragraph style={{ marginBottom: 8 }} copyable={{ text: activateEntryUrl }}>
              {activateEntryUrl}
            </Typography.Paragraph>
            <Button
              type="primary"
              onClick={() => {
                activationForm.resetFields();
                setActivationModal(true);
              }}
            >
              生成开通码
            </Button>
          </div>
        </Space>
        <Table
          size="small"
          rowKey="id"
          pagination={{ pageSize: 8 }}
          dataSource={activationCodes}
          columns={[
            {
              title: "开通码",
              dataIndex: "code",
              render: (v: string) => <Typography.Text className="mono">{v}</Typography.Text>,
            },
            { title: "备注", dataIndex: "note", render: (v) => v || "—" },
            { title: "状态", dataIndex: "status" },
            {
              title: "兑换人",
              key: "used",
              render: (_, row) =>
                row.used_by_name || row.used_by_email
                  ? `${row.used_by_name || ""} ${row.used_by_email || ""}`.trim()
                  : "—",
            },
            { title: "机构", dataIndex: "org_name", render: (v) => v || "—" },
            { title: "创建时间", dataIndex: "created_at" },
            {
              title: "操作",
              key: "copy",
              render: (_, row) => (
                <Button
                  size="small"
                  type="link"
                  onClick={() => {
                    void navigator.clipboard.writeText(String(row.code || ""));
                    message.success("开通码已复制");
                  }}
                >
                  复制码
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          style={{ minWidth: 220 }}
          placeholder="选择机构"
          value={selectedOrgId || undefined}
          onChange={setSelectedOrgId}
          options={orgs.map((o) => ({ value: o.id, label: o.name }))}
          loading={loading}
        />
        <Button
          type="primary"
          onClick={() => {
            form.resetFields();
            setOrgModal(true);
          }}
        >
          新建机构
        </Button>
        <Button
          disabled={!selectedOrg}
          onClick={() => {
            if (!selectedOrg) return;
            form.setFieldsValue({
              id: selectedOrg.id,
              name: selectedOrg.name,
              contact_name: selectedOrg.contact_name,
              contact_email: selectedOrg.contact_email,
              wx_receiver_type: selectedOrg.wx_receiver_type || "PERSONAL_OPENID",
              wx_receiver_account: selectedOrg.wx_receiver_account,
              wx_receiver_name: selectedOrg.wx_receiver_name,
            });
            setOrgModal(true);
          }}
        >
          编辑机构 / 分账接收方
        </Button>
        <Button
          disabled={!selectedOrgId}
          onClick={() => {
            codeForm.resetFields();
            setCodeModal(true);
          }}
        >
          发邀请码
        </Button>
        <Button
          disabled={!selectedOrgId}
          onClick={() => {
            accountForm.resetFields();
            setAccountModal(true);
          }}
        >
          创建机构账号
        </Button>
      </Space>

      {selectedOrg?.stats && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space size="large" wrap>
            <span>邀请 {selectedOrg.stats.invited_users} 人</span>
            <span>付费 {selectedOrg.stats.paid_users} 人</span>
            <span>当前比例 {selectedOrg.stats.current_rate_pct}%</span>
            <span>
              微信接收方{" "}
              {selectedOrg.wx_receiver_account
                ? `${String(selectedOrg.wx_receiver_type || "")} / ${String(selectedOrg.wx_receiver_name || "")} / ${String(selectedOrg.wx_receiver_account).slice(0, 4)}****`
                : "未绑定（机构后台可扫码）"}
            </span>
          </Space>
        </Card>
      )}

      {selectedOrgId && (
        <Tabs
          items={[
            {
              key: "tiers",
              label: "分账阶梯",
              children: (
                <>
                  <Table
                    size="small"
                    pagination={false}
                    dataSource={tierRows}
                    columns={[
                      {
                        title: "累计付费人数 ≥",
                        dataIndex: "min_paid_users",
                        render: (_, row, idx) => (
                          <InputNumber
                            min={0}
                            value={row.min_paid_users}
                            onChange={(v) => {
                              const next = [...tierRows];
                              next[idx] = { ...next[idx], min_paid_users: Number(v) || 0 };
                              setTierRows(next);
                            }}
                          />
                        ),
                      },
                      {
                        title: "分账比例 %",
                        dataIndex: "rate_pct",
                        render: (_, row, idx) => (
                          <InputNumber
                            min={0}
                            max={30}
                            step={0.5}
                            value={row.rate_pct}
                            onChange={(v) => {
                              const next = [...tierRows];
                              next[idx] = { ...next[idx], rate_pct: Number(v) || 0 };
                              setTierRows(next);
                            }}
                          />
                        ),
                      },
                    ]}
                  />
                  <Space style={{ marginTop: 12 }}>
                    <Button
                      onClick={() =>
                        setTierRows([...tierRows, { key: String(Date.now()), min_paid_users: 0, rate_pct: 10 }])
                      }
                    >
                      添加阶梯
                    </Button>
                    <Button type="primary" onClick={() => void saveTiers()}>
                      保存阶梯
                    </Button>
                  </Space>
                </>
              ),
            },
            {
              key: "codes",
              label: "邀请码",
              children: (
                <Table
                  size="small"
                  rowKey="id"
                  dataSource={codes}
                  columns={[
                    { title: "码", dataIndex: "code" },
                    { title: "状态", dataIndex: "status" },
                    { title: "已用", dataIndex: "used_count" },
                    {
                      title: "注册链接",
                      key: "link",
                      render: (_, row) => {
                        const code = String(row.code || "");
                        const url = buildOrgRegisterUrl(code);
                        return (
                          <Space size={8}>
                            <Typography.Text className="mono" style={{ fontSize: 12 }} ellipsis={{ tooltip: url }}>
                              {url}
                            </Typography.Text>
                            <Button
                              size="small"
                              type="link"
                              onClick={() => {
                                void navigator.clipboard.writeText(url);
                                message.success("注册链接已复制");
                              }}
                            >
                              复制
                            </Button>
                          </Space>
                        );
                      },
                    },
                  ]}
                />
              ),
            },
            {
              key: "attr",
              label: "归因明细",
              children: (
                <Table
                  size="small"
                  rowKey="user_id"
                  dataSource={attributions}
                  columns={[
                    { title: "邮箱", dataIndex: "email" },
                    { title: "显示名", dataIndex: "display_name" },
                    { title: "邀请码", dataIndex: "invite_code" },
                    { title: "绑定时间", dataIndex: "bound_at" },
                    { title: "付费单数", dataIndex: "paid_orders" },
                  ]}
                />
              ),
            },
          ]}
        />
      )}

      <Modal
        title={form.getFieldValue("id") ? "编辑机构" : "新建机构"}
        open={orgModal}
        onOk={() => void saveOrg()}
        onCancel={() => {
          setOrgModal(false);
          form.resetFields();
        }}
      >
        <Form form={form} layout="vertical" initialValues={{ wx_receiver_type: "PERSONAL_OPENID" }}>
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="机构名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="contact_name" label="联系人">
            <Input />
          </Form.Item>
          <Form.Item name="contact_email" label="联系邮箱">
            <Input type="email" />
          </Form.Item>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
            分账接收方优先由机构后台扫码绑定个人微信；此处可手工修正 OpenID。
          </Typography.Paragraph>
          <Form.Item name="wx_receiver_type" label="微信接收方类型">
            <Select
              allowClear
              options={[
                { value: "PERSONAL_OPENID", label: "个人 OpenID（推荐）" },
                { value: "MERCHANT_ID", label: "商户号" },
              ]}
            />
          </Form.Item>
          <Form.Item name="wx_receiver_account" label="微信接收方账号">
            <Input placeholder="openid 或商户号" />
          </Form.Item>
          <Form.Item name="wx_receiver_name" label="接收方名称">
            <Input placeholder="个人微信昵称或商户名" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="邀请码" open={codeModal} onOk={() => void saveCode()} onCancel={() => setCodeModal(false)}>
        <Form form={codeForm} layout="vertical">
          <Form.Item name="code" label="邀请码" rules={[{ required: true }]}>
            <Input className="mono" placeholder="如 PARTNER-2026" />
          </Form.Item>
          <Form.Item name="max_uses" label="最大使用次数（可选）">
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="机构后台账号"
        open={accountModal}
        onOk={() => void saveAccount()}
        onCancel={() => setAccountModal(false)}
      >
        <Form form={accountForm} layout="vertical">
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: "email" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="display_name" label="显示名">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="生成机构开通码"
        open={activationModal}
        onOk={() => void saveActivationCode()}
        onCancel={() => setActivationModal(false)}
      >
        <Form form={activationForm} layout="vertical">
          <Form.Item name="note" label="备注（发给谁）">
            <Input placeholder="如：张老师 / 杭州渠道" />
          </Form.Item>
          <Form.Item name="code" label="自定义码（可选，留空自动生成）">
            <Input className="mono" placeholder="6–16 位大写字母数字" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
