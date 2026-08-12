import {
  App,
  Button,
  Card,
  Collapse,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tabs,
  Typography,
  Upload,
} from "antd";
import { DeleteOutlined, PlusOutlined, UploadOutlined, VideoCameraAddOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import type { AuthorCapsule, AuthorDayPackage, AuthorQuizQuestion, CapsuleEditorTab, DayResource } from "./dayPackage";
import type { KnowledgeCard } from "../../lib/types";
import { practiceToText } from "./dayPackage";
import { authorApi, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { authorSelectPopup, useAuthorLayout } from "../../lib/authorLayoutContext";
import {
  MediaPickerModal,
  QuizQuestionModal,
  ResourceModal,
  type QuizQuestionModalValues,
  type ResourceModalValues,
} from "./modals";

type PatchCapsule = (partial: Partial<AuthorCapsule>) => void;

function CapsuleQuizTab({
  capsule,
  readonly,
  patch,
}: {
  capsule: AuthorCapsule;
  readonly: boolean;
  patch: PatchCapsule;
}) {
  const [quizModal, setQuizModal] = useState<{ index: number | null } | null>(null);
  const questions = capsule.quiz?.questions || [];
  const setQuestions = (qs: AuthorQuizQuestion[]) =>
    patch({ quiz: { ...(capsule.quiz || {}), questions: qs, pass_rate: capsule.quiz?.pass_rate ?? 0.8 } });

  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Typography.Text type="secondary">本节小测，不影响整日测验流程节点。</Typography.Text>
      <Form layout="vertical" disabled={readonly}>
        <Form.Item label="通过率（0–1）">
          <InputNumber
            min={0}
            max={1}
            step={0.1}
            value={capsule.quiz?.pass_rate ?? 0.8}
            onChange={(v) => patch({ quiz: { ...(capsule.quiz || {}), questions, pass_rate: Number(v) || 0.8 } })}
          />
        </Form.Item>
      </Form>
      {questions.map((q, i) => (
        <Card
          key={i}
          size="small"
          type="inner"
          title={`第 ${i + 1} 题`}
          extra={
            !readonly && (
              <Space>
                <Button size="small" onClick={() => setQuizModal({ index: i })}>
                  编辑
                </Button>
                <Button size="small" danger onClick={() => setQuestions(questions.filter((_, j) => j !== i))}>
                  删除
                </Button>
              </Space>
            )
          }
        >
          <Typography.Paragraph style={{ marginBottom: 0 }}>{q.q || "（无题干）"}</Typography.Paragraph>
        </Card>
      ))}
      {!readonly && (
        <Button icon={<PlusOutlined />} onClick={() => setQuizModal({ index: null })}>
          添加节测验题
        </Button>
      )}
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
    </Space>
  );
}

function emptyCard(): KnowledgeCard {
  return { id: `card-${Date.now()}`, term: "", plain: "" };
}

function CapsuleKnowledgeCardsTab({
  capsule,
  readonly,
  patch,
}: {
  capsule: AuthorCapsule;
  readonly: boolean;
  patch: PatchCapsule;
}) {
  const cards = capsule.knowledge_cards || [];
  const setCards = (next: KnowledgeCard[]) => patch({ knowledge_cards: next });

  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Typography.Text type="secondary">
        学员端「知识卡片」步展示；建议 3–6 张，每张含词条、人话解释，可选标签与补充细节。
      </Typography.Text>
      {cards.map((c, i) => (
        <Card
          key={c.id || i}
          size="small"
          type="inner"
          title={c.term || `卡片 ${i + 1}`}
          extra={
            !readonly && (
              <Button size="small" danger onClick={() => setCards(cards.filter((_, j) => j !== i))}>
                删除
              </Button>
            )
          }
        >
          <Form layout="vertical" disabled={readonly}>
            <Form.Item label="ID">
              <Input
                value={c.id}
                onChange={(e) => {
                  const next = [...cards];
                  next[i] = { ...next[i], id: e.target.value.trim() };
                  setCards(next);
                }}
              />
            </Form.Item>
            <Form.Item label="词条">
              <Input
                value={c.term}
                onChange={(e) => {
                  const next = [...cards];
                  next[i] = { ...next[i], term: e.target.value };
                  setCards(next);
                }}
              />
            </Form.Item>
            <Form.Item label="人话解释">
              <Input.TextArea
                rows={2}
                value={c.plain}
                onChange={(e) => {
                  const next = [...cards];
                  next[i] = { ...next[i], plain: e.target.value };
                  setCards(next);
                }}
              />
            </Form.Item>
            <Form.Item label="补充细节">
              <Input.TextArea
                rows={2}
                value={c.detail || ""}
                onChange={(e) => {
                  const next = [...cards];
                  next[i] = { ...next[i], detail: e.target.value };
                  setCards(next);
                }}
              />
            </Form.Item>
            <Form.Item label="标签">
              <Input
                value={c.tag || ""}
                onChange={(e) => {
                  const next = [...cards];
                  next[i] = { ...next[i], tag: e.target.value };
                  setCards(next);
                }}
              />
            </Form.Item>
          </Form>
        </Card>
      ))}
      {!readonly && (
        <Button icon={<PlusOutlined />} onClick={() => setCards([...cards, emptyCard()])}>
          添加知识卡片
        </Button>
      )}
    </Space>
  );
}

function CapsuleResourcesTab({
  capsule,
  pkg,
  readonly,
  patch,
}: {
  capsule: AuthorCapsule;
  pkg: AuthorDayPackage;
  readonly: boolean;
  patch: PatchCapsule;
}) {
  const { campId } = useAuth();
  const { getContentPopupContainer } = useAuthorLayout();
  const selectPopup = authorSelectPopup(getContentPopupContainer);
  const [resourceModal, setResourceModal] = useState<{ index: number | null; inline: boolean } | null>(null);
  const dayPool = pkg.resources || [];
  const inline = capsule.resources || [];
  const poolOptions = dayPool.map((r) => ({ value: r.id, label: `${r.id} · ${r.title || "未命名"}` }));

  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Typography.Text type="secondary">
        可从本课整日资源池绑定，或添加仅属于本节的内联资源。学员端优先显示节级资源，未配置时回退整日资源。
      </Typography.Text>
      <Form layout="vertical" disabled={readonly}>
        <Form.Item label="绑定本课资源池（多选）">
          <Select
            mode="multiple"
            allowClear
            placeholder="选择整日资源池中的条目"
            value={capsule.resource_ids || []}
            options={poolOptions}
            onChange={(ids) => patch({ resource_ids: ids })}
            getPopupContainer={selectPopup}
          />
        </Form.Item>
      </Form>
      {inline.map((r, i) => (
        <Card
          key={r.id || i}
          size="small"
          type="inner"
          title={r.title || r.id}
          extra={
            !readonly && (
              <Space>
                <Button size="small" onClick={() => setResourceModal({ index: i, inline: true })}>
                  编辑
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => patch({ resources: inline.filter((_, j) => j !== i) })}
                >
                  删除
                </Button>
              </Space>
            )
          }
        >
          <Typography.Text code>{r.id}</Typography.Text>
          {r.summary && <Typography.Paragraph type="secondary">{r.summary}</Typography.Paragraph>}
        </Card>
      ))}
      {!readonly && (
        <Button icon={<PlusOutlined />} onClick={() => setResourceModal({ index: null, inline: true })}>
          添加节内资源
        </Button>
      )}
      <ResourceModal
        open={resourceModal != null}
        campId={campId || undefined}
        initialValues={
          resourceModal?.index != null ? inline[resourceModal.index] : { kind: "guide", id: `cap-${capsule.id}-res` }
        }
        onCancel={() => setResourceModal(null)}
        onSubmit={(values: ResourceModalValues) => {
          const item: DayResource = {
            id: values.id || `cap-${capsule.id}-${inline.length + 1}`,
            title: values.title || "",
            kind: values.kind,
            summary: values.summary,
            url: values.url,
            object_key: values.object_key,
          };
          const next = [...inline];
          if (resourceModal?.index != null) next[resourceModal.index] = item;
          else next.push(item);
          patch({ resources: next });
          setResourceModal(null);
        }}
      />
    </Space>
  );
}

export function CapsuleEditorTabs({
  capsule,
  pkg,
  capsuleId,
  versionId,
  readonly,
  patch,
  activeTab,
  onTabChange,
  idEditable = false,
}: {
  capsule: AuthorCapsule;
  pkg: AuthorDayPackage;
  capsuleId: string;
  versionId: string;
  readonly: boolean;
  patch: PatchCapsule;
  activeTab?: CapsuleEditorTab;
  onTabChange?: (tab: CapsuleEditorTab) => void;
  idEditable?: boolean;
}) {
  const { message } = App.useApp();
  const { campId } = useAuth();
  const { getContentPopupContainer } = useAuthorLayout();
  const selectPopup = authorSelectPopup(getContentPopupContainer);
  const [uploading, setUploading] = useState(false);
  const [bootcampMediaBusy, setBootcampMediaBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [advancedText, setAdvancedText] = useState(
    () => (capsule.advanced ? JSON.stringify(capsule.advanced, null, 2) : ""),
  );

  useEffect(() => {
    setAdvancedText(capsule.advanced ? JSON.stringify(capsule.advanced, null, 2) : "");
  }, [capsule.id, capsule.advanced]);

  const uploadMedia = async (file: File, kind: "video" | "audio" | "poster", mediaIndex?: number) => {
    setUploading(true);
    try {
      const res = await authorApi.uploadCourseMedia(versionId, {
        file,
        day: pkg.day,
        capsule_id: capsuleId,
        kind,
      });
      if (kind === "poster" && typeof mediaIndex === "number") {
        const media = [...(capsule.media || [])];
        media[mediaIndex] = { ...media[mediaIndex], poster_key: res.object_key };
        patch({ media });
      } else {
        patch({
          media: [
            ...(capsule.media || []),
            {
              kind: kind === "audio" ? "audio" : "video",
              title: file.name,
              object_key: res.object_key,
            },
          ],
        });
      }
      message.success(`已上传 ${file.name}`);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
    return false;
  };

  const bindBootcampMedia = async () => {
    setBootcampMediaBusy(true);
    try {
      const res = await authorApi.getBootcampCapsuleMedia(pkg.day, capsuleId);
      if (!res.items?.length) {
        message.warning(`Day ${pkg.day} · ${capsuleId} 在 bootcamp 暂无 media 配置`);
        return;
      }
      patch({ media: res.items });
      message.success(`已绑定 bootcamp 本节 ${res.items.length} 条媒体`);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "读取 bootcamp 失败");
    } finally {
      setBootcampMediaBusy(false);
    }
  };

  const saveAdvanced = () => {
    if (!advancedText.trim()) {
      patch({ advanced: undefined });
      return;
    }
    try {
      patch({ advanced: JSON.parse(advancedText) as Record<string, unknown> });
      message.success("高级数据已更新");
    } catch {
      message.error("JSON 格式无效");
    }
  };

  return (
    <>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => onTabChange?.(key as CapsuleEditorTab)}
        items={[
          {
            key: "notes",
            label: "讲义",
            children: (
              <Form layout="vertical" disabled={readonly}>
                <Space wrap style={{ width: "100%" }} size="large">
                  <Form.Item label="节 ID" required={idEditable}>
                    <Input
                      value={capsule.id}
                      disabled={readonly || !idEditable}
                      style={{ width: 160 }}
                      placeholder="例如 c1"
                      onChange={(e) => patch({ id: e.target.value.trim() })}
                    />
                  </Form.Item>
                  <Form.Item label="分钟">
                    <InputNumber
                      min={0}
                      value={capsule.minutes}
                      onChange={(v) => patch({ minutes: Number(v) || 0 })}
                    />
                  </Form.Item>
                </Space>
                <Form.Item label="节标题" required>
                  <Input value={capsule.title} onChange={(e) => patch({ title: e.target.value })} />
                </Form.Item>
                <Form.Item label="正文（支持 Markdown 风格纯文本）" required>
                  <Input.TextArea
                    rows={12}
                    value={capsule.content || ""}
                    onChange={(e) => patch({ content: e.target.value })}
                  />
                </Form.Item>
                <Collapse
                  defaultActiveKey={["media"]}
                  items={[
                    {
                      key: "media",
                      label: `媒体（${(capsule.media || []).length}）`,
                      children: (
                        <Space direction="vertical" style={{ width: "100%" }}>
                          {!readonly && (
                            <Space wrap>
                              <Upload
                                accept="video/*"
                                showUploadList={false}
                                beforeUpload={(file) => {
                                  void uploadMedia(file, "video");
                                  return false;
                                }}
                                disabled={uploading}
                              >
                                <Button icon={<UploadOutlined />} loading={uploading}>
                                  上传视频
                                </Button>
                              </Upload>
                              <Upload
                                accept="audio/*"
                                showUploadList={false}
                                beforeUpload={(file) => {
                                  void uploadMedia(file, "audio");
                                  return false;
                                }}
                                disabled={uploading}
                              >
                                <Button icon={<UploadOutlined />} loading={uploading}>
                                  上传音频
                                </Button>
                              </Upload>
                              <Button icon={<VideoCameraAddOutlined />} onClick={() => setPickerOpen(true)}>
                                从视频库选择
                              </Button>
                              <Button loading={bootcampMediaBusy} onClick={() => void bindBootcampMedia()}>
                                从 bootcamp 本节成片
                              </Button>
                            </Space>
                          )}
                          {(capsule.media || []).map((m, mi) => (
                            <Card
                              key={mi}
                              size="small"
                              type="inner"
                              title={`${m.kind} #${mi + 1}`}
                              extra={
                                !readonly && (
                                  <Button
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => {
                                      const media = [...(capsule.media || [])];
                                      media.splice(mi, 1);
                                      patch({ media });
                                    }}
                                  >
                                    删除
                                  </Button>
                                )
                              }
                            >
                              <Form layout="vertical" disabled={readonly}>
                                <Form.Item label="object_key">
                                  <Input
                                    className="mono"
                                    value={m.object_key}
                                    onChange={(e) => {
                                      const media = [...(capsule.media || [])];
                                      media[mi] = { ...media[mi], object_key: e.target.value };
                                      patch({ media });
                                    }}
                                  />
                                </Form.Item>
                              </Form>
                            </Card>
                          ))}
                        </Space>
                      ),
                    },
                  ]}
                />
              </Form>
            ),
          },
          {
            key: "practice",
            label: "练习",
            children: (
              <Form layout="vertical" disabled={readonly}>
                <Form.Item label="随堂练习提示">
                  <Input.TextArea
                    rows={6}
                    value={practiceToText(capsule.practice)}
                    onChange={(e) => patch({ practice: e.target.value })}
                  />
                </Form.Item>
              </Form>
            ),
          },
          {
            key: "knowledge_cards",
            label: `知识卡片（${(capsule.knowledge_cards || []).length}）`,
            children: <CapsuleKnowledgeCardsTab capsule={capsule} readonly={readonly} patch={patch} />,
          },
          {
            key: "local_prep",
            label: "本地实操",
            children: (
              <Form layout="vertical" disabled={readonly}>
                <Form.Item label="Codex Skill ID">
                  <Input
                    value={capsule.local_prep?.skill_id || "fde-local-prep"}
                    onChange={(e) =>
                      patch({ local_prep: { ...(capsule.local_prep || {}), skill_id: e.target.value } })
                    }
                  />
                </Form.Item>
                <Form.Item label="提示词类型">
                  <select
                    value={capsule.local_prep?.prompt_kind || "coding"}
                    onChange={(e) =>
                      patch({
                        local_prep: {
                          ...(capsule.local_prep || {}),
                          prompt_kind: e.target.value === "coach" ? "coach" : "coding",
                        },
                      })
                    }
                    style={{ width: "100%", padding: "6px 8px" }}
                  >
                    <option value="coding">编码任务（粘贴给 TRAE / AI 员工改仓库）</option>
                    <option value="coach">学习教练（出题/审稿，勿当编码任务）</option>
                  </select>
                </Form.Item>
                <Form.Item label={capsule.local_prep?.prompt_kind === "coach" ? "学习教练提示词" : "编码任务提示词"}>
                  <Input.TextArea
                    rows={8}
                    value={capsule.local_prep?.codex_prompt || ""}
                    onChange={(e) =>
                      patch({ local_prep: { ...(capsule.local_prep || {}), codex_prompt: e.target.value } })
                    }
                  />
                </Form.Item>
                <Form.Item label="准备 Checklist（每行一项）">
                  <Input.TextArea
                    rows={6}
                    value={(capsule.local_prep?.checklist || []).join("\n")}
                    onChange={(e) =>
                      patch({
                        local_prep: {
                          ...(capsule.local_prep || {}),
                          checklist: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                        },
                      })
                    }
                  />
                </Form.Item>
                <Form.Item label="模板资源 ID">
                  <Input
                    value={capsule.local_prep?.template_resource_id || ""}
                    onChange={(e) =>
                      patch({ local_prep: { ...(capsule.local_prep || {}), template_resource_id: e.target.value } })
                    }
                  />
                </Form.Item>
                <Form.Item label="导师推荐问题（每行一条）">
                  <Input.TextArea
                    rows={4}
                    value={(capsule.local_prep?.suggested_questions || []).join("\n")}
                    onChange={(e) =>
                      patch({
                        local_prep: {
                          ...(capsule.local_prep || {}),
                          suggested_questions: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                        },
                      })
                    }
                  />
                </Form.Item>
              </Form>
            ),
          },
          {
            key: "resources",
            label: "资源",
            children: <CapsuleResourcesTab capsule={capsule} pkg={pkg} readonly={readonly} patch={patch} />,
          },
          {
            key: "quiz",
            label: "节测验",
            children: <CapsuleQuizTab capsule={capsule} readonly={readonly} patch={patch} />,
          },
          {
            key: "lab",
            label: "节实训",
            children: (
              <Form layout="vertical" disabled={readonly}>
                <Typography.Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
                  本节实训片段，不影响整日实训流程节点。
                </Typography.Text>
                <Form.Item label="运行器">
                  <Select
                    value={capsule.lab?.runner || "agent"}
                    options={[
                      { value: "agent", label: "Agent 代理" },
                      { value: "sim", label: "Sim 仿真" },
                    ]}
                    onChange={(runner) => patch({ lab: { ...(capsule.lab || {}), runner } })}
                    getPopupContainer={selectPopup}
                  />
                </Form.Item>
                <Form.Item label="Prompt 模板">
                  <Input.TextArea
                    rows={4}
                    value={capsule.lab?.agent?.prompt_template || ""}
                    onChange={(e) =>
                      patch({ lab: { ...(capsule.lab || {}), agent: { prompt_template: e.target.value } } })
                    }
                  />
                </Form.Item>
              </Form>
            ),
          },
          {
            key: "advanced",
            label: "高级",
            children: (
              <Space direction="vertical" style={{ width: "100%" }}>
                <Typography.Text type="secondary">节级高级 JSON，供扩展字段或调试使用。</Typography.Text>
                <Input.TextArea
                  rows={10}
                  className="mono"
                  value={advancedText}
                  onChange={(e) => setAdvancedText(e.target.value)}
                  disabled={readonly}
                />
                {!readonly && (
                  <Button type="primary" onClick={saveAdvanced}>
                    应用 JSON
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />
      <MediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        campId={campId || undefined}
        onPick={(media) => {
          patch({
            media: [
              ...(capsule.media || []),
              {
                kind: media.kind === "audio" ? "audio" : "video",
                title: media.title || "",
                object_key: media.object_key,
                poster_key: media.poster_key,
                duration_sec: media.duration_sec,
              },
            ],
          });
        }}
      />
    </>
  );
}
