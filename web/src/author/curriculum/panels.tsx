import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Typography,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined, HolderOutlined } from "@ant-design/icons";
import type { AuthorCapsule, AuthorDayPackage, AuthorNodeSpec, AuthorNodeType, AuthorQuizQuestion, AuthorRubricCheck, CapsuleEditorTab } from "./dayPackage";
import { newCapsuleId } from "./dayPackage";
import { CapsuleEditorTabs } from "./CapsuleEditorTabs";
import { NODE_TYPE_OPTIONS } from "./nodeTypes";
import { useAuth } from "../../lib/auth";
import { authorApi, ApiError } from "../../lib/api";
import { authorSelectPopup, useAuthorLayout } from "../../lib/authorLayoutContext";
import { useState } from "react";
import {
  LabRubricModal,
  NodeModal,
  QuizQuestionModal,
  ResourceModal,
  type LabRubricModalValues,
  type NodeModalValues,
  type QuizQuestionModalValues,
  type ResourceModalValues,
} from "./modals";

type SetPkg = (updater: (prev: AuthorDayPackage) => AuthorDayPackage) => void;

export function DayMetaPanel({
  pkg,
  readonly,
  onChange,
  onEdit,
}: {
  pkg: AuthorDayPackage;
  readonly: boolean;
  onChange: SetPkg;
  onEdit?: () => void;
}) {
  const { getContentPopupContainer } = useAuthorLayout();
  const selectPopup = authorSelectPopup(getContentPopupContainer);
  return (
    <Card
      title="本课信息"
      size="small"
      extra={
        !readonly && onEdit ? (
          <Button size="small" icon={<EditOutlined />} onClick={onEdit}>
            编辑基础信息
          </Button>
        ) : null
      }
    >
      <Form layout="vertical" disabled={readonly}>
        <Form.Item label="课次编号">
          <InputNumber value={pkg.day} disabled style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item label="课次标题" required>
          <Input
            value={pkg.title}
            onChange={(e) => onChange((p) => ({ ...p, title: e.target.value }))}
            placeholder="例如：FDE 角色认知与武器分发"
          />
        </Form.Item>
        <Space size="large" wrap style={{ width: "100%" }}>
          <Form.Item label="所属周">
            <Select
              style={{ width: 160 }}
              value={pkg.week ?? 1}
              options={[
                { value: 1, label: "第 1 周" },
                { value: 2, label: "第 2 周" },
              ]}
              onChange={(week) => onChange((p) => ({ ...p, week }))}
              getPopupContainer={selectPopup}
            />
          </Form.Item>
          <Form.Item label="预估学习分钟">
            <InputNumber
              min={0}
              value={pkg.learn?.estimated_minutes}
              onChange={(v) =>
                onChange((p) => ({
                  ...p,
                  learn: { ...(p.learn || {}), estimated_minutes: Number(v) || 0 },
                }))
              }
            />
          </Form.Item>
          <Form.Item label="必须学完全部课节">
            <Switch
              checked={pkg.learn?.require_capsules !== false}
              onChange={(v) => onChange((p) => ({ ...p, learn: { ...(p.learn || {}), require_capsules: v } }))}
            />
          </Form.Item>
        </Space>
        <Form.Item label="企业项目名">
          <Input value={pkg.project || ""} onChange={(e) => onChange((p) => ({ ...p, project: e.target.value }))} />
        </Form.Item>
        <Form.Item label="企业任务说明（project_brief）">
          <Input.TextArea
            rows={5}
            value={pkg.project_brief || ""}
            onChange={(e) => onChange((p) => ({ ...p, project_brief: e.target.value }))}
          />
        </Form.Item>
        <Form.Item label="自检清单（每行一项）">
          <Input.TextArea
            rows={4}
            value={(pkg.review_checklist || []).join("\n")}
            onChange={(e) =>
              onChange((p) => ({
                ...p,
                review_checklist: e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              }))
            }
          />
        </Form.Item>
        <Form.Item label="灵知标签（逗号分隔）">
          <Input
            value={(pkg.learn?.lingzhi_tags || []).join(", ")}
            onChange={(e) =>
              onChange((p) => ({
                ...p,
                learn: {
                  ...(p.learn || {}),
                  lingzhi_tags: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
              }))
            }
          />
        </Form.Item>
      </Form>
    </Card>
  );
}

export function CapsulePanel({
  pkg,
  capsuleId,
  readonly,
  versionId,
  onChange,
  activeTab,
  onTabChange,
}: {
  pkg: AuthorDayPackage;
  capsuleId: string;
  readonly: boolean;
  versionId: string;
  onChange: SetPkg;
  activeTab?: CapsuleEditorTab;
  onTabChange?: (tab: CapsuleEditorTab) => void;
}) {
  const capsules = pkg.learn?.capsules || [];
  const idx = capsules.findIndex((c) => c.id === capsuleId);
  const capsule = idx >= 0 ? capsules[idx] : null;
  if (!capsule) {
    return <Typography.Text type="secondary">课节不存在，请从左侧重新选择。</Typography.Text>;
  }

  const patch = (partial: Partial<AuthorCapsule>) => {
    onChange((p) => {
      const list = [...(p.learn?.capsules || [])];
      const i = list.findIndex((c) => c.id === capsuleId);
      if (i < 0) return p;
      list[i] = { ...list[i], ...partial };
      return { ...p, learn: { ...(p.learn || {}), capsules: list } };
    });
  };

  const moveCapsule = (from: number, to: number) => {
    onChange((p) => {
      const list = [...(p.learn?.capsules || [])];
      if (from < 0 || to < 0 || from >= list.length || to >= list.length) return p;
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item);
      return { ...p, learn: { ...(p.learn || {}), capsules: list } };
    });
  };

  return (
    <Card
      title={`课节 · ${capsule.id}`}
      size="small"
      extra={
        !readonly && (
          <Space>
            <Button size="small" disabled={idx <= 0} onClick={() => moveCapsule(idx, idx - 1)}>
              上移
            </Button>
            <Button size="small" disabled={idx >= capsules.length - 1} onClick={() => moveCapsule(idx, idx + 1)}>
              下移
            </Button>
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() =>
                onChange((p) => ({
                  ...p,
                  learn: {
                    ...(p.learn || {}),
                    capsules: (p.learn?.capsules || []).filter((c) => c.id !== capsuleId),
                  },
                }))
              }
            >
              删除本节
            </Button>
          </Space>
        )
      }
    >
      <CapsuleEditorTabs
        capsule={capsule}
        pkg={pkg}
        capsuleId={capsuleId}
        versionId={versionId}
        readonly={readonly}
        patch={patch}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />
    </Card>
  );
}

export function CapsuleReorderPanel({
  pkg,
  readonly,
  onChange,
  onOpen,
}: {
  pkg: AuthorDayPackage;
  readonly: boolean;
  onChange: SetPkg;
  onOpen: (capsuleId: string) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const capsules = pkg.learn?.capsules || [];

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    onChange((p) => {
      const list = [...(p.learn?.capsules || [])];
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item);
      return { ...p, learn: { ...(p.learn || {}), capsules: list } };
    });
  };

  return (
    <Card title="课节排序（拖拽）" size="small">
      <Typography.Paragraph type="secondary">拖动手柄调整学员侧栏中的节顺序。</Typography.Paragraph>
      <Space direction="vertical" style={{ width: "100%" }}>
        {capsules.map((c, i) => (
          <div
            key={c.id}
            draggable={!readonly}
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex == null) return;
              reorder(dragIndex, i);
              setDragIndex(null);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              background: dragIndex === i ? "#f0fdfa" : "#fff",
              cursor: readonly ? "default" : "grab",
            }}
          >
            <HolderOutlined />
            <Typography.Text code>{c.id}</Typography.Text>
            <Typography.Text style={{ flex: 1 }}>{c.title}</Typography.Text>
            <Button size="small" type="link" onClick={() => onOpen(c.id)}>
              编辑
            </Button>
          </div>
        ))}
      </Space>
    </Card>
  );
}

export function NodesPanel({ pkg, readonly, onChange }: { pkg: AuthorDayPackage; readonly: boolean; onChange: SetPkg }) {
  const { getContentPopupContainer } = useAuthorLayout();
  const selectPopup = authorSelectPopup(getContentPopupContainer);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [nodeModal, setNodeModal] = useState<{ index: number | null } | null>(null);
  const nodes = pkg.nodes || [];
  const update = (next: AuthorNodeSpec[]) => onChange((p) => ({ ...p, nodes: next }));

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    const next = [...nodes];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    update(next);
  };

  return (
    <Card title="学习流程（学员树顺序）" size="small">
      <Typography.Paragraph type="secondary">
        节点 id 在运行时按 <Typography.Text code>d{"{day}"}-{"{type}"}</Typography.Text> 生成。同类型勿重复。可拖拽排序。
      </Typography.Paragraph>
      <Space direction="vertical" style={{ width: "100%" }}>
        {nodes.map((n, i) => (
          <div
            key={`${n.type}-${i}`}
            draggable={!readonly}
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex == null) return;
              reorder(dragIndex, i);
              setDragIndex(null);
            }}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              background: dragIndex === i ? "#f0fdfa" : "#fff",
              cursor: readonly ? "default" : "grab",
            }}
          >
            <HolderOutlined />
            <Select
              disabled={readonly}
              style={{ width: 140 }}
              value={n.type}
              options={NODE_TYPE_OPTIONS}
              onChange={(type) => {
                const next = [...nodes];
                next[i] = { ...next[i], type: type as AuthorNodeType };
                update(next);
              }}
              getPopupContainer={selectPopup}
            />
            <Input
              disabled={readonly}
              style={{ width: 280 }}
              value={n.title}
              onChange={(e) => {
                const next = [...nodes];
                next[i] = { ...next[i], title: e.target.value };
                update(next);
              }}
            />
            {!readonly && (
              <>
                <Button
                  size="small"
                  disabled={i === 0}
                  onClick={() => {
                    const next = [...nodes];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    update(next);
                  }}
                >
                  上移
                </Button>
                <Button
                  size="small"
                  disabled={i === nodes.length - 1}
                  onClick={() => {
                    const next = [...nodes];
                    [next[i + 1], next[i]] = [next[i], next[i + 1]];
                    update(next);
                  }}
                >
                  下移
                </Button>
                <Button size="small" icon={<EditOutlined />} onClick={() => setNodeModal({ index: i })}>
                  编辑
                </Button>
                <Button size="small" danger onClick={() => update(nodes.filter((_, j) => j !== i))}>
                  删除
                </Button>
              </>
            )}
          </div>
        ))}
        {!readonly && (
          <Button icon={<PlusOutlined />} onClick={() => setNodeModal({ index: null })}>
            添加流程节点
          </Button>
        )}
      </Space>
      <NodeModal
        open={nodeModal != null}
        initial={nodeModal?.index != null ? nodes[nodeModal.index] : undefined}
        existingTypes={nodes
          .filter((_, j) => j !== nodeModal?.index)
          .map((n) => n.type)}
        onCancel={() => setNodeModal(null)}
        onSubmit={(values: NodeModalValues) => {
          const next = [...nodes];
          const nodeSpec: AuthorNodeSpec = { type: values.type as AuthorNodeType, title: values.title };
          if (nodeModal?.index != null) next[nodeModal.index] = nodeSpec;
          else next.push(nodeSpec);
          update(next);
          setNodeModal(null);
        }}
      />
    </Card>
  );
}

export function QuizPanel({ pkg, readonly, onChange }: { pkg: AuthorDayPackage; readonly: boolean; onChange: SetPkg }) {
  const [quizModal, setQuizModal] = useState<{ index: number | null } | null>(null);
  const questions = pkg.quiz?.questions || [];
  const setQuestions = (qs: AuthorQuizQuestion[]) =>
    onChange((p) => ({ ...p, quiz: { ...(p.quiz || {}), questions: qs } }));

  return (
    <Card
      title="整日测验"
      size="small"
      extra={<Typography.Text type="secondary">整日绑定；课节还可单独配置节测验</Typography.Text>}
    >
      <Form layout="vertical" disabled={readonly}>
        <Form.Item label="通过率（0–1）">
          <InputNumber
            min={0}
            max={1}
            step={0.1}
            value={pkg.quiz?.pass_rate ?? 0.8}
            onChange={(v) => onChange((p) => ({ ...p, quiz: { ...(p.quiz || {}), pass_rate: Number(v) || 0.8 } }))}
          />
        </Form.Item>
      </Form>
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        {questions.map((q, i) => (
          <Card
            key={i}
            size="small"
            type="inner"
            title={`第 ${i + 1} 题`}
            extra={
              !readonly && (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => setQuizModal({ index: i })}>
                    编辑
                  </Button>
                  <Button size="small" danger onClick={() => setQuestions(questions.filter((_, j) => j !== i))}>
                    删除
                  </Button>
                </Space>
              )
            }
          >
            <Typography.Paragraph style={{ marginBottom: 8 }}>{q.q || <Typography.Text type="secondary">（无题干）</Typography.Text>}</Typography.Paragraph>
            <Typography.Text type="secondary">
              {q.options?.length || 0} 个选项 · 答案序号 {q.answer ?? 0}
              {q.explain ? ` · 有解析` : ""}
            </Typography.Text>
            {!!q.options?.length && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {q.options.map((opt, oi) => (
                  <li key={oi}>
                    <Typography.Text type={oi === (q.answer ?? 0) ? undefined : "secondary"}>
                      {oi === (q.answer ?? 0) ? "✓ " : ""}
                      {opt}
                    </Typography.Text>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
        {!readonly && (
          <Button icon={<PlusOutlined />} onClick={() => setQuizModal({ index: null })}>
            添加整日测验题
          </Button>
        )}
      </Space>
      <QuizQuestionModal
        open={quizModal != null}
        initialValues={quizModal?.index != null ? questions[quizModal.index] : undefined}
        onCancel={() => setQuizModal(null)}
        onSubmit={(values: QuizQuestionModalValues) => {
          const next = [...questions];
          if (quizModal?.index != null) next[quizModal.index] = values;
          else next.push(values);
          setQuestions(next);
          setQuizModal(null);
        }}
      />
    </Card>
  );
}

export function LabPanel({ pkg, readonly, onChange }: { pkg: AuthorDayPackage; readonly: boolean; onChange: SetPkg }) {
  const { getContentPopupContainer } = useAuthorLayout();
  const selectPopup = authorSelectPopup(getContentPopupContainer);
  const [rubricModal, setRubricModal] = useState<{ index: number | null } | null>(null);
  const lab = pkg.lab || {};
  const rubric = lab.rubric || [];
  const setLab = (partial: NonNullable<AuthorDayPackage["lab"]>) =>
    onChange((p) => ({ ...p, lab: { ...(p.lab || {}), ...partial } }));

  return (
    <Card
      title="整日实训"
      size="small"
      extra={<Typography.Text type="secondary">整日绑定；课节还可单独配置节实训</Typography.Text>}
    >
      <Form layout="vertical" disabled={readonly}>
        <Space wrap size="large">
          <Form.Item label="运行器">
            <Select
              style={{ width: 160 }}
              value={lab.runner || "agent"}
              options={[
                { value: "agent", label: "Agent 代理" },
                { value: "sim", label: "Sim 仿真" },
                { value: "none", label: "无" },
              ]}
              onChange={(runner) => setLab({ runner })}
              getPopupContainer={selectPopup}
            />
          </Form.Item>
          <Form.Item label="仿真类型">
            <Select
              allowClear
              style={{ width: 180 }}
              value={lab.sim_kind}
              options={[
                { value: "server", label: "服务端" },
                { value: "arch_design", label: "架构设计" },
                { value: "web_dev", label: "Web 开发" },
                { value: "k8s", label: "K8s" },
              ]}
              onChange={(sim_kind) => setLab({ sim_kind })}
              getPopupContainer={selectPopup}
            />
          </Form.Item>
          <Form.Item label="工作区模式">
            <Select
              style={{ width: 160 }}
              value={lab.workspace_mode || "cumulative"}
              options={[
                { value: "cumulative", label: "累积模式" },
                { value: "isolated", label: "隔离模式" },
              ]}
              onChange={(workspace_mode) => setLab({ workspace_mode })}
              getPopupContainer={selectPopup}
            />
          </Form.Item>
        </Space>
        <Form.Item label="本日主文件（每行一个）">
          <Input.TextArea
            rows={3}
            className="mono"
            value={(lab.primary_files || []).join("\n")}
            onChange={(e) =>
              setLab({
                primary_files: e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </Form.Item>
        <Form.Item label="Agent Prompt 模板">
          <Input.TextArea
            rows={8}
            className="mono"
            value={lab.agent?.prompt_template || ""}
            onChange={(e) => setLab({ agent: { ...(lab.agent || {}), prompt_template: e.target.value } })}
          />
        </Form.Item>
      </Form>
      <Typography.Title level={5}>评分规则</Typography.Title>
      <Space direction="vertical" style={{ width: "100%" }}>
        {rubric.map((r, i) => (
          <Card
            key={i}
            size="small"
            type="inner"
            title={r.title_zh || `检查 #${i + 1}`}
            extra={
              !readonly && (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => setRubricModal({ index: i })}>
                    编辑
                  </Button>
                  <Button
                    size="small"
                    danger
                    onClick={() => setLab({ rubric: rubric.filter((_, j) => j !== i) })}
                  >
                    删除
                  </Button>
                </Space>
              )
            }
          >
            <Typography.Text code>{r.check}</Typography.Text>
            {r.description_zh && (
              <Typography.Paragraph type="secondary" style={{ margin: "6px 0 0" }}>
                {r.description_zh}
              </Typography.Paragraph>
            )}
            {!!r.args && Object.keys(r.args).length > 0 && (
              <pre className="mono" style={{ margin: "8px 0 0", fontSize: 12, whiteSpace: "pre-wrap" }}>
                {JSON.stringify(r.args, null, 2)}
              </pre>
            )}
            {r.hint && (
              <Typography.Text type="secondary" style={{ display: "block", marginTop: 6 }}>
                提示：{r.hint}
              </Typography.Text>
            )}
          </Card>
        ))}
        {!readonly && (
          <Button icon={<PlusOutlined />} onClick={() => setRubricModal({ index: null })}>
            添加检查
          </Button>
        )}
      </Space>
      <LabRubricModal
        open={rubricModal != null}
        initialValues={rubricModal?.index != null ? rubric[rubricModal.index] : undefined}
        onCancel={() => setRubricModal(null)}
        onSubmit={(values: LabRubricModalValues) => {
          const next = [...rubric] as AuthorRubricCheck[];
          if (rubricModal?.index != null) next[rubricModal.index] = values;
          else next.push(values);
          setLab({ rubric: next });
          setRubricModal(null);
        }}
      />
    </Card>
  );
}

export function ResourcesPanel({
  pkg,
  readonly,
  onChange,
}: {
  pkg: AuthorDayPackage;
  readonly: boolean;
  onChange: SetPkg;
}) {
  const { campId } = useAuth();
  const { message } = App.useApp();
  const [resourceModal, setResourceModal] = useState<{ index: number | null } | null>(null);
  const [packImportOpen, setPackImportOpen] = useState(false);
  const [packs, setPacks] = useState<{ value: string; label: string }[]>([]);
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const resources = pkg.resources || [];

  const openPackImport = async () => {
    setPackImportOpen(true);
    try {
      const res = await authorApi.listResourcePacks({ camp_id: campId || undefined, page: 1, page_size: 50 });
      setPacks((res.items || []).map((p: { id: string; name: string }) => ({ value: p.id, label: p.name })));
    } catch {
      setPacks([]);
    }
  };

  const importFromPack = async () => {
    if (!selectedPack) return;
    try {
      const res = await authorApi.listPackResources(selectedPack, { page: 1, page_size: 100 });
      const items = (res.items || []) as Array<Record<string, unknown>>;
      const dayFiltered = items.filter((r) => !r.day_index || Number(r.day_index) === pkg.day);
      const imported = dayFiltered.map((r, i) => ({
        id: String(r.id || `pack-${i}`),
        title: String(r.title || "未命名"),
        kind: String(r.kind || "link"),
        url: r.url ? String(r.url) : undefined,
        object_key: r.object_key ? String(r.object_key) : undefined,
      }));
      const existingIds = new Set(resources.map((x) => x.id));
      const merged = [...resources, ...imported.filter((x) => !existingIds.has(x.id))];
      onChange((p) => ({ ...p, resources: merged }));
      message.success(`已从素材包导入 ${imported.length} 项`);
      setPackImportOpen(false);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "导入失败");
    }
  };

  return (
    <Card
      title="整日资源池"
      size="small"
      extra={<Typography.Text type="secondary">整日绑定；课节还可引用或附加资源</Typography.Text>}
    >
      <Space direction="vertical" style={{ width: "100%" }}>
        {resources.map((r, i) => (
          <Card
            key={r.id || i}
            size="small"
            type="inner"
            title={
              <Space size={8}>
                <Typography.Text code>{r.id || `resource-${i + 1}`}</Typography.Text>
                {r.kind && <Typography.Text type="secondary">{r.kind}</Typography.Text>}
              </Space>
            }
            extra={
              !readonly && (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => setResourceModal({ index: i })}>
                    编辑
                  </Button>
                  <Button
                    size="small"
                    danger
                    onClick={() => onChange((p) => ({ ...p, resources: (p.resources || []).filter((_, j) => j !== i) }))}
                  >
                    删除
                  </Button>
                </Space>
              )
            }
          >
            <Typography.Text strong>{r.title || "（无标题）"}</Typography.Text>
            {r.summary && (
              <Typography.Paragraph type="secondary" style={{ margin: "6px 0 0" }}>
                {r.summary}
              </Typography.Paragraph>
            )}
            {(r.url || r.object_key) && (
              <Typography.Text type="secondary" className="mono" style={{ display: "block", marginTop: 6, fontSize: 12 }}>
                {r.url || r.object_key}
              </Typography.Text>
            )}
          </Card>
        ))}
        {!readonly && (
          <Space>
            <Button icon={<PlusOutlined />} onClick={() => setResourceModal({ index: null })}>
              添加资源
            </Button>
            <Button onClick={() => void openPackImport()}>从素材包导入</Button>
          </Space>
        )}
      </Space>
      <Modal
        title="从素材包导入"
        open={packImportOpen}
        onCancel={() => setPackImportOpen(false)}
        onOk={() => void importFromPack()}
        okText="导入"
      >
        <Select
          style={{ width: "100%" }}
          placeholder="选择素材包"
          options={packs}
          value={selectedPack || undefined}
          onChange={setSelectedPack}
        />
        <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
          将导入包内资源到本课整日资源池（优先匹配 Day {pkg.day} 或未指定课次的条目）。
        </Typography.Text>
      </Modal>
      <ResourceModal
        open={resourceModal != null}
        campId={campId || undefined}
        initialValues={
          resourceModal?.index != null ? resources[resourceModal.index] : { kind: "guide" }
        }
        onCancel={() => setResourceModal(null)}
        onSubmit={(values: ResourceModalValues) => {
          const item = {
            id: values.id || `res-${resources.length + 1}`,
            title: values.title || "",
            kind: values.kind,
            summary: values.summary,
            url: values.url,
            object_key: values.object_key,
          };
          const next = [...resources];
          if (resourceModal?.index != null) next[resourceModal.index] = item;
          else next.push(item);
          onChange((p) => ({ ...p, resources: next }));
          setResourceModal(null);
        }}
      />
    </Card>
  );
}

export function addCapsule(pkg: AuthorDayPackage): AuthorDayPackage {
  const list = [...(pkg.learn?.capsules || [])];
  const id = newCapsuleId(list);
  list.push({ id, title: `第 ${list.length + 1} 节`, minutes: 15, content: "", practice: "" });
  return { ...pkg, learn: { ...(pkg.learn || {}), capsules: list } };
}
