import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  App,
  Breadcrumb,
  Button,
  Drawer,
  Empty,
  Input,
  Layout,
  Space,
  Spin,
  Tag,
  Tree,
  Typography,
  theme,
} from "antd";
import type { DataNode } from "antd/es/tree";

function collectExpandableKeys(nodes: DataNode[] | undefined, keys: string[] = []): string[] {
  for (const node of nodes || []) {
    if (node.children?.length) {
      keys.push(String(node.key));
      collectExpandableKeys(node.children, keys);
    }
  }
  return keys;
}
import {
  BookOutlined,
  FileTextOutlined,
  PlusOutlined,
  SaveOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  QuestionCircleOutlined,
  ApartmentOutlined,
  PaperClipOutlined,
  CodeOutlined,
  EyeOutlined,
  OrderedListOutlined,
  CloudSyncOutlined,
} from "@ant-design/icons";
import { authorApi, ApiError } from "../../lib/api";
import {
  type AuthorDayPackage,
  type AuthorCapsule,
  type CapsuleEditorTab,
  CAPSULE_EDITOR_TABS,
  type EditorPane,
  newCapsuleId,
  normalizeDayPackage,
  validateDayPackage,
} from "./dayPackage";
import {
  DayMetaPanel,
  CapsulePanel,
  CapsuleReorderPanel,
  NodesPanel,
  QuizPanel,
  LabPanel,
  ResourcesPanel,
} from "./panels";
import { CapsuleModal, DayModal, YamlImportModal, BootcampSyncModal, type DayModalValues } from "./modals";
import { LearnerPreview } from "./LearnerPreview";
import { useAuth } from "../../lib/auth";
import { useErrorModal } from "../../hooks/useErrorModal";

const { Sider, Content } = Layout;

type DayListItem = { day: number; title: string; project?: string | null };

export function CurriculumWorkbench() {
  const { courseId = "", versionId = "" } = useParams();
  const nav = useNavigate();
  const { message, modal } = App.useApp();
  const { token } = theme.useToken();
  const { campId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<Awaited<ReturnType<typeof authorApi.getCourseVersion>> | null>(null);
  const [days, setDays] = useState<DayListItem[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [pkg, setPkg] = useState<AuthorDayPackage | null>(null);
  const [baseline, setBaseline] = useState<string>("");
  const [pane, setPane] = useState<EditorPane>({ kind: "meta" });
  const [saving, setSaving] = useState(false);
  const [dayLoading, setDayLoading] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [dayModalMode, setDayModalMode] = useState<"create" | "edit">("create");
  const [creatingDay, setCreatingDay] = useState(false);
  const [capsuleModalOpen, setCapsuleModalOpen] = useState(false);
  const [yamlModalOpen, setYamlModalOpen] = useState(false);
  const [yamlImporting, setYamlImporting] = useState(false);
  const [bootcampSyncOpen, setBootcampSyncOpen] = useState(false);

  const readonly = version?.status === "published";
  const dirty = pkg ? JSON.stringify(pkg) !== baseline : false;

  const loadVersion = useCallback(async () => {
    if (!versionId) return;
    setLoading(true);
    setError(null);
    try {
      const [ver, dayRes] = await Promise.all([
        authorApi.getCourseVersion(versionId),
        authorApi.listCourseVersionDays(versionId),
      ]);
      setVersion(ver);
      const items = dayRes.items || [];
      setDays(items);
      if (items.length && selectedDay == null) {
        setSelectedDay(items[0].day);
      } else if (selectedDay != null && !items.some((d) => d.day === selectedDay)) {
        setSelectedDay(items[0]?.day ?? null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "加载版本失败");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId]);

  const loadDay = useCallback(
    async (day: number) => {
      if (!versionId) return;
      setDayLoading(true);
      try {
        const res = await authorApi.getCourseVersionDay(versionId, day);
        const normalized = normalizeDayPackage(res.package_json || {}, day);
        setPkg(normalized);
        setBaseline(JSON.stringify(normalized));
        setPane({ kind: "meta" });
      } catch (err) {
        message.error(err instanceof ApiError ? err.message : "加载课次失败");
        setPkg(null);
        setBaseline("");
      } finally {
        setDayLoading(false);
      }
    },
    [versionId, message],
  );

  useEffect(() => {
    void loadVersion();
  }, [loadVersion]);

  useEffect(() => {
    if (selectedDay != null) void loadDay(selectedDay);
  }, [selectedDay, loadDay]);

  const onChangePkg = (updater: (prev: AuthorDayPackage) => AuthorDayPackage) => {
    setPkg((prev) => (prev ? updater(prev) : prev));
  };

  const save = async () => {
    if (!pkg || !versionId || selectedDay == null) return;
    const errors = validateDayPackage(pkg);
    if (errors.length) {
      modal.error({ title: "无法保存", content: errors.map((e) => `· ${e}`).join("\n") });
      return;
    }
    setSaving(true);
    try {
      await authorApi.updateCourseVersionDay(versionId, selectedDay, {
        package_json: pkg as unknown as Record<string, unknown>,
        title: pkg.title,
        project: pkg.project || undefined,
      });
      setBaseline(JSON.stringify(pkg));
      setDays((prev) => prev.map((d) => (d.day === selectedDay ? { ...d, title: pkg.title, project: pkg.project } : d)));
      message.success(`第 ${selectedDay} 课已保存`);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const openCreateDay = async () => {
    if (!versionId || readonly) return;
    if (dirty) {
      const ok = await new Promise<boolean>((resolve) => {
        modal.confirm({
          title: "当前课次有未保存修改",
          content: "新建课次将丢弃未保存内容，是否继续？",
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
      if (!ok) return;
    }
    setDayModalMode("create");
    setDayModalOpen(true);
  };

  const openEditDayMeta = () => {
    if (!pkg || readonly) return;
    setDayModalMode("edit");
    setDayModalOpen(true);
  };

  const submitCreateDay = async (values: DayModalValues) => {
    if (!versionId) return;
    setCreatingDay(true);
    try {
      const res = await authorApi.createCourseVersionDay(versionId, {
        day: values.day,
        title: values.title,
        week: values.week,
        clone_from_day: values.clone_from_day,
      });
      message.success(`已创建第 ${res.day} 课`);
      setDayModalOpen(false);
      await loadVersion();
      setSelectedDay(res.day);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "创建失败");
    } finally {
      setCreatingDay(false);
    }
  };

  const submitDayModal = async (values: DayModalValues) => {
    if (dayModalMode === "edit") {
      if (!pkg) return;
      onChangePkg((p) => ({
        ...p,
        title: values.title || p.title,
        week: values.week ?? p.week,
      }));
      setDayModalOpen(false);
      message.success("课次基础信息已更新（记得保存）");
      return;
    }
    await submitCreateDay(values);
  };

  const importYamlDay = async (content: string) => {
    if (!versionId || readonly) return;
    setYamlImporting(true);
    try {
      const file = new File([content], "day-import.yaml", { type: "text/yaml" });
      const validated = await authorApi.validateCourseYaml([file]);
      if (!validated.ok || validated.errors?.length) {
        message.error((validated.errors || ["YAML 校验失败"]).join("; "));
        return;
      }
      const packages = (validated as { packages?: Record<string, unknown>[] }).packages || [];
      if (!packages.length) {
        message.error("校验通过但未解析到课次");
        return;
      }
      for (const raw of packages) {
        const dayNo = Number(raw.day || 0);
        if (dayNo < 1) continue;
        const normalized = normalizeDayPackage(raw, dayNo);
        const exists = days.some((d) => d.day === dayNo);
        if (exists) {
          const ok = await new Promise<boolean>((resolve) => {
            modal.confirm({
              title: `覆盖第 ${dayNo} 课？`,
              content: `将用 YAML 内容覆盖已有课次「${days.find((d) => d.day === dayNo)?.title || dayNo}」，此操作写入草稿版本。`,
              okType: "danger",
              onOk: () => resolve(true),
              onCancel: () => resolve(false),
            });
          });
          if (!ok) continue;
        } else {
          await authorApi.createCourseVersionDay(versionId, {
            day: dayNo,
            title: normalized.title,
            week: normalized.week,
          });
        }
        await authorApi.updateCourseVersionDay(versionId, dayNo, {
          package_json: normalized,
          title: normalized.title,
          project: normalized.project || null,
        });
      }
      message.success("YAML 已导入");
      setYamlModalOpen(false);
      await loadVersion();
      const first = Number(packages[0]?.day || 0);
      if (first) setSelectedDay(first);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "导入失败");
    } finally {
      setYamlImporting(false);
    }
  };

  const submitCreateCapsule = (capsule: AuthorCapsule) => {
    if (!pkg) return;
    const list = pkg.learn?.capsules || [];
    const id = (capsule.id || "").trim() || newCapsuleId(list);
    if (list.some((c) => c.id === id)) {
      message.error(`课节 ID「${id}」已存在`);
      return;
    }
    onChangePkg((p) => ({
      ...p,
      learn: {
        ...(p.learn || {}),
        capsules: [...(p.learn?.capsules || []), { ...capsule, id }],
      },
    }));
    setCapsuleModalOpen(false);
    setPane({ kind: "capsule", capsuleId: id, tab: "notes" });
  };

  const deleteDay = async (day: number) => {
    if (!versionId || readonly) return;
    modal.confirm({
      title: `删除第 ${day} 课？`,
      content: "删除后不可恢复（可从已发布版本回滚重建草稿）。",
      okType: "danger",
      onOk: async () => {
        try {
          await authorApi.deleteCourseVersionDay(versionId, day);
          message.success("已删除");
          if (selectedDay === day) {
            setSelectedDay(null);
            setPkg(null);
          }
          await loadVersion();
        } catch (err) {
          message.error(err instanceof ApiError ? err.message : "删除失败");
        }
      },
    });
  };

  const publish = async () => {
    if (!versionId || readonly) return;
    if (dirty) {
      message.warning("请先保存当前课次再发布");
      return;
    }
    modal.confirm({
      title: "发布此版本？",
      content: "发布后不可再改；若需修改请克隆/回滚为新草稿。",
      onOk: async () => {
        try {
          await authorApi.publishCourseVersionById(versionId);
          message.success("已发布");
          await loadVersion();
        } catch (err) {
          message.error(err instanceof ApiError ? err.message : "发布失败");
        }
      },
    });
  };

  const treeData: DataNode[] = useMemo(() => {
    return days.map((d) => {
      const isSel = d.day === selectedDay;
      const capsules = isSel && pkg ? pkg.learn?.capsules || [] : [];
      return {
        key: `day-${d.day}`,
        title: (
          <Space size={4}>
            <span>
              第 {d.day} 课 · {d.title}
            </span>
            {isSel && dirty && <Tag color="orange">未保存</Tag>}
          </Space>
        ),
        icon: <BookOutlined />,
        children: isSel
          ? [
              { key: `day-${d.day}-meta`, title: "本课信息", icon: <FileTextOutlined />, isLeaf: true },
              {
                key: `day-${d.day}-capsules`,
                title: `课节（${capsules.length}）`,
                icon: <FileTextOutlined />,
                children: [
                  !readonly
                    ? {
                        key: `day-${d.day}-cap-order`,
                        title: (
                          <Space size={4}>
                            <OrderedListOutlined />
                            节排序
                          </Space>
                        ),
                        isLeaf: true,
                      }
                    : null,
                  ...capsules.map((c) => ({
                    key: `day-${d.day}-cap-${c.id}`,
                    title: `${c.id} · ${c.title || "未命名"}`,
                    children: CAPSULE_EDITOR_TABS.map((t) => ({
                      key: `day-${d.day}-cap-${c.id}-${t.key}`,
                      title: t.label,
                      isLeaf: true,
                    })),
                  })),
                  !readonly
                    ? {
                        key: `day-${d.day}-cap-add`,
                        title: "+ 新增课节",
                        isLeaf: true,
                      }
                    : null,
                ].filter(Boolean) as DataNode[],
              },
              { key: `day-${d.day}-nodes`, title: "学习流程", icon: <ApartmentOutlined />, isLeaf: true },
              { key: `day-${d.day}-quiz`, title: "整日测验", icon: <QuestionCircleOutlined />, isLeaf: true },
              { key: `day-${d.day}-lab`, title: "整日实训", icon: <ExperimentOutlined />, isLeaf: true },
              { key: `day-${d.day}-resources`, title: "整日资源池", icon: <PaperClipOutlined />, isLeaf: true },
              { key: `day-${d.day}-raw`, title: "高级数据", icon: <CodeOutlined />, isLeaf: true },
            ]
          : undefined,
      };
    });
  }, [days, selectedDay, pkg, dirty, readonly]);

  const expandedKeys = useMemo(() => collectExpandableKeys(treeData), [treeData]);
  const [treeExpandedKeys, setTreeExpandedKeys] = useState<string[]>([]);
  useEffect(() => {
    setTreeExpandedKeys(expandedKeys);
  }, [expandedKeys]);

  const onTreeSelect = (keys: React.Key[]) => {
    const key = String(keys[0] || "");
    if (!key) return;
    const dayMatch = key.match(/^day-(\d+)/);
    if (!dayMatch) return;
    const day = Number(dayMatch[1]);
    if (day !== selectedDay) {
      if (dirty) {
        modal.confirm({
          title: "切换课次将丢失未保存修改",
          onOk: () => {
            setSelectedDay(day);
          },
        });
        return;
      }
      setSelectedDay(day);
      return;
    }
    if (key.endsWith("-meta")) setPane({ kind: "meta" });
    else if (key.endsWith("-nodes")) setPane({ kind: "nodes" });
    else if (key.endsWith("-cap-order")) setPane({ kind: "capsuleOrder" });
    else if (key.endsWith("-cap-add") && pkg && !readonly) {
      setCapsuleModalOpen(true);
    } else {
      const capTab = key.match(/-cap-(.+)-(notes|practice|resources|quiz|lab|advanced)$/);
      if (capTab) {
        setPane({ kind: "capsule", capsuleId: capTab[1], tab: capTab[2] as CapsuleEditorTab });
        return;
      }
      if (key.endsWith("-quiz")) setPane({ kind: "quiz" });
      else if (key.endsWith("-lab")) setPane({ kind: "lab" });
      else if (key.endsWith("-resources")) setPane({ kind: "resources" });
      else if (key.endsWith("-raw")) {
        setRawText(JSON.stringify(pkg, null, 2));
        setRawOpen(true);
        setPane({ kind: "raw" });
      } else {
        const cap = key.match(/-cap-(.+)$/);
        if (cap && cap[1] !== "add" && cap[1] !== "order") {
          setPane({ kind: "capsule", capsuleId: cap[1], tab: "notes" });
        }
      }
    }
  };

  useErrorModal(error, { title: "课纲加载失败", onRetry: () => void loadVersion() });

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 48 }}>
        <Empty description="课纲加载失败">
          <Button type="primary" onClick={() => void loadVersion()}>
            重试
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        style={{ marginBottom: 12 }}
        items={[
          { title: <Link to="/author/curriculum/courses">课程与大纲</Link> },
          { title: version?.course_title || courseId.slice(0, 8) },
          { title: version?.version_tag || versionId.slice(0, 8) },
        ]}
      />
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }} wrap>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            课纲编辑器
          </Typography.Title>
          <Typography.Text type="secondary">
            课程 → 版本 → 第 N 课 → 课节 / 学习流程 · 写回 day package，学员端立即消费
          </Typography.Text>
        </div>
        <Space wrap>
          <Tag color={readonly ? "green" : "blue"}>{readonly ? "已发布（只读）" : "草稿"}</Tag>
          {pkg && (
            <Button icon={<EyeOutlined />} onClick={() => setPreviewOpen(true)}>
              学员预览
            </Button>
          )}
          {!readonly && (
            <Button icon={<PlusOutlined />} onClick={() => void openCreateDay()}>
              新建课次
            </Button>
          )}
          {!readonly && (
            <Button icon={<CloudSyncOutlined />} onClick={() => setBootcampSyncOpen(true)} disabled={!versionId}>
              从 bootcamp 同步
            </Button>
          )}
          {!readonly && (
            <Button
              icon={<FileTextOutlined />}
              onClick={() => setYamlModalOpen(true)}
              disabled={!versionId}
            >
              导入 YAML
            </Button>
          )}
          {!readonly && selectedDay != null && (
            <Button danger icon={<DeleteOutlined />} onClick={() => void deleteDay(selectedDay)}>
              删除本课
            </Button>
          )}
          {!readonly && (
            <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={!dirty || !pkg} onClick={() => void save()}>
              保存课次
            </Button>
          )}
          {!readonly && (
            <Button onClick={() => void publish()} disabled={days.length === 0}>
              发布版本
            </Button>
          )}
          <Button onClick={() => nav("/author/curriculum/courses")}>返回列表</Button>
        </Space>
      </Space>

      <Layout style={{ background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8, minHeight: 640 }}>
        <Sider width={300} theme="light" style={{ borderRight: `1px solid ${token.colorBorderSecondary}`, padding: "12px 0" }}>
          {days.length === 0 ? (
            <Empty description="暂无课次" style={{ marginTop: 48 }}>
              {!readonly && (
                <Button type="primary" onClick={() => void openCreateDay()}>
                  创建第一课
                </Button>
              )}
            </Empty>
          ) : (
            <Tree
              showIcon
              expandedKeys={treeExpandedKeys}
              onExpand={(keys) => setTreeExpandedKeys(keys as string[])}
              selectedKeys={
                selectedDay == null
                  ? []
                  : pane.kind === "capsule"
                    ? [
                        pane.tab && pane.tab !== "notes"
                          ? `day-${selectedDay}-cap-${pane.capsuleId}-${pane.tab}`
                          : `day-${selectedDay}-cap-${pane.capsuleId}`,
                      ]
                    : pane.kind === "capsuleOrder"
                      ? [`day-${selectedDay}-cap-order`]
                      : pane.kind === "meta"
                        ? [`day-${selectedDay}-meta`]
                        : pane.kind === "nodes"
                          ? [`day-${selectedDay}-nodes`]
                          : pane.kind === "quiz"
                            ? [`day-${selectedDay}-quiz`]
                            : pane.kind === "lab"
                              ? [`day-${selectedDay}-lab`]
                              : pane.kind === "resources"
                                ? [`day-${selectedDay}-resources`]
                                : [`day-${selectedDay}`]
              }
              treeData={treeData}
              onSelect={onTreeSelect}
              style={{ padding: "0 8px" }}
            />
          )}
        </Sider>
        <Content style={{ padding: 20 }}>
          {dayLoading && <Spin />}
          {!dayLoading && !pkg && <Empty description="请选择左侧课次" />}
          {!dayLoading && pkg && pane.kind === "meta" && (
            <DayMetaPanel pkg={pkg} readonly={readonly} onChange={onChangePkg} onEdit={openEditDayMeta} />
          )}
          {!dayLoading && pkg && pane.kind === "capsuleOrder" && (
            <CapsuleReorderPanel
              pkg={pkg}
              readonly={readonly}
              onChange={onChangePkg}
              onOpen={(capsuleId) => setPane({ kind: "capsule", capsuleId, tab: "notes" })}
            />
          )}
          {!dayLoading && pkg && pane.kind === "capsule" && (
            <CapsulePanel
              pkg={pkg}
              capsuleId={pane.capsuleId}
              versionId={versionId}
              readonly={readonly}
              onChange={onChangePkg}
              activeTab={pane.tab || "notes"}
              onTabChange={(tab) => setPane({ kind: "capsule", capsuleId: pane.capsuleId, tab })}
            />
          )}
          {!dayLoading && pkg && pane.kind === "nodes" && (
            <NodesPanel pkg={pkg} readonly={readonly} onChange={onChangePkg} />
          )}
          {!dayLoading && pkg && pane.kind === "quiz" && (
            <QuizPanel pkg={pkg} readonly={readonly} onChange={onChangePkg} />
          )}
          {!dayLoading && pkg && pane.kind === "lab" && <LabPanel pkg={pkg} readonly={readonly} onChange={onChangePkg} />}
          {!dayLoading && pkg && pane.kind === "resources" && (
            <ResourcesPanel pkg={pkg} readonly={readonly} onChange={onChangePkg} />
          )}
        </Content>
      </Layout>

      <DayModal
        open={dayModalOpen}
        initialValues={
          dayModalMode === "edit" && pkg
            ? { day: pkg.day, title: pkg.title, week: pkg.week }
            : undefined
        }
        onCancel={() => setDayModalOpen(false)}
        submitting={creatingDay}
        onSubmit={(values) => void submitDayModal(values)}
      />

      {pkg && (
        <CapsuleModal
          open={capsuleModalOpen}
          pkg={pkg}
          versionId={versionId}
          readonly={readonly}
          onCancel={() => setCapsuleModalOpen(false)}
          onSubmit={submitCreateCapsule}
        />
      )}

      <YamlImportModal
        open={yamlModalOpen}
        submitting={yamlImporting}
        onCancel={() => setYamlModalOpen(false)}
        onConfirm={(content) => void importYamlDay(content)}
      />

      <BootcampSyncModal
        open={bootcampSyncOpen}
        versionId={versionId}
        onCancel={() => setBootcampSyncOpen(false)}
        onSynced={() => {
          void loadVersion();
          if (selectedDay != null) void loadDay(selectedDay);
        }}
      />

      <Drawer
        title="学员预览"
        open={previewOpen}
        width={560}
        onClose={() => setPreviewOpen(false)}
        destroyOnClose
      >
        {pkg ? (
          <LearnerPreview
            pkg={pkg}
            campId={campId || version?.camp_id}
            focusCapsuleId={pane.kind === "capsule" ? pane.capsuleId : null}
          />
        ) : (
          <Empty description="请先选择课次" />
        )}
      </Drawer>

      <Drawer
        title="高级数据（生产排障 / 批量粘贴）"
        open={rawOpen}
        width={640}
        onClose={() => setRawOpen(false)}
        extra={
          !readonly && (
            <Button
              type="primary"
              onClick={() => {
                try {
                  const parsed = JSON.parse(rawText) as Record<string, unknown>;
                  const normalized = normalizeDayPackage(parsed, selectedDay || 1);
                  setPkg(normalized);
                  setRawOpen(false);
                  message.success("已应用到编辑器（记得保存）");
                } catch (err) {
                  message.error(err instanceof Error ? err.message : "JSON 无效");
                }
              }}
            >
              应用到编辑器
            </Button>
          )
        }
      >
        <Input.TextArea
          className="mono"
          rows={28}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          disabled={readonly}
          spellCheck={false}
        />
      </Drawer>
    </div>
  );
}
