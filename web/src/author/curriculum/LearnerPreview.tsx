import { useEffect, useMemo, useState } from "react";
import { Card, Empty, Segmented, Space, Tabs, Tag, Typography } from "antd";
import { CapsuleMediaStack } from "../../components/CapsuleMedia";
import type { CapsuleMedia } from "../../lib/types";
import type { AuthorCapsule, AuthorDayPackage } from "./dayPackage";
import { practiceToText, resolveCapsuleResources } from "./dayPackage";

function PreviewProse({ content }: { content: string }) {
  return (
    <div className="capsule-prose" style={{ maxHeight: 420, overflow: "auto" }}>
      {content.split(/\n{2,}/).map((block, i) => {
        const text = block.trim();
        if (!text) return null;
        const firstLine = text.split("\n")[0]?.trim() || "";
        if (/^【.+】$/.test(firstLine)) {
          const [head, ...rest] = text.split("\n");
          return (
            <section key={i} style={{ marginBottom: 12 }}>
              <Typography.Title level={5} style={{ marginBottom: 4 }}>
                {head.replace(/[【】]/g, "")}
              </Typography.Title>
              {rest.join("\n").trim() ? <Typography.Paragraph>{rest.join("\n").trim()}</Typography.Paragraph> : null}
            </section>
          );
        }
        return (
          <Typography.Paragraph key={i} style={{ whiteSpace: "pre-wrap" }}>
            {text}
          </Typography.Paragraph>
        );
      })}
    </div>
  );
}

export function LearnerPreview({
  pkg,
  campId,
  focusCapsuleId,
}: {
  pkg: AuthorDayPackage;
  campId?: string | null;
  focusCapsuleId?: string | null;
}) {
  const capsules = pkg.learn?.capsules || [];
  const resolveId = (want?: string | null) => {
    if (want && capsules.some((c) => c.id === want)) return want;
    return capsules[0]?.id || "";
  };
  const [capId, setCapId] = useState(() => resolveId(focusCapsuleId));
  const capsuleIdsKey = capsules.map((c) => c.id).join(",");

  useEffect(() => {
    setCapId(resolveId(focusCapsuleId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCapsuleId, pkg.day, capsuleIdsKey]);

  const active: AuthorCapsule | undefined = useMemo(
    () => capsules.find((c) => c.id === capId) || capsules[0],
    [capsules, capId],
  );

  const resources = useMemo(
    () => (active ? resolveCapsuleResources(active, pkg.resources || []) : pkg.resources || []),
    [active, pkg.resources],
  );

  if (!capsules.length) {
    return <Empty description="本课还没有课节，预览为空" />;
  }

  const media = (active?.media || []).filter((m) => m.object_key) as CapsuleMedia[];

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="middle">
      <div>
        <Typography.Text type="secondary">学员视角预览（不写进度）</Typography.Text>
        <Typography.Title level={4} style={{ margin: "4px 0 8px" }}>
          第 {pkg.day} 课 · {pkg.title}
        </Typography.Title>
        <Space wrap>
          {(pkg.nodes || []).map((n, i) => (
            <Tag key={`${n.type}-${i}`}>{n.title || n.type}</Tag>
          ))}
        </Space>
      </div>
      <Segmented
        block
        value={active?.id}
        options={capsules.map((c) => ({ label: `${c.id} ${c.title || ""}`.slice(0, 28), value: c.id }))}
        onChange={(v) => setCapId(String(v))}
      />
      {active && (
        <Card size="small" title={active.title || active.id}>
          {media.length > 0 && <CapsuleMediaStack items={media} campId={campId} />}
          <Tabs
            items={[
              {
                key: "notes",
                label: "课节讲义",
                children: <PreviewProse content={active.content || "（暂无正文）"} />,
              },
              {
                key: "resources",
                label: `资源 (${resources.length})`,
                children:
                  resources.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {resources.map((r) => (
                        <li key={r.id}>
                          <Typography.Text strong>{r.title}</Typography.Text>
                          {r.summary && (
                            <Typography.Paragraph type="secondary" style={{ margin: "4px 0 0" }}>
                              {r.summary}
                            </Typography.Paragraph>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Typography.Text type="secondary">本节暂无资源</Typography.Text>
                  ),
              },
              {
                key: "practice",
                label: "练习",
                children: practiceToText(active.practice) ? (
                  <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                    {practiceToText(active.practice)}
                  </Typography.Paragraph>
                ) : (active.quiz?.questions || []).length > 0 ? (
                  <ol style={{ margin: 0, paddingLeft: 18 }}>
                    {(active.quiz?.questions || []).map((q, i) => (
                      <li key={i}>{q.q || "（空题干）"}</li>
                    ))}
                  </ol>
                ) : (
                  <Typography.Text type="secondary">本节暂无练习</Typography.Text>
                ),
              },
            ]}
          />
        </Card>
      )}
      {(pkg.quiz?.questions || []).length > 0 && (
        <Card size="small" title={`整日测验（${pkg.quiz?.questions?.length} 题）`}>
          <Typography.Text type="secondary">通过率 {(pkg.quiz?.pass_rate ?? 0.8) * 100}%</Typography.Text>
          <ol>
            {(pkg.quiz?.questions || []).slice(0, 3).map((q, i) => (
              <li key={i}>{q.q || "（空题干）"}</li>
            ))}
          </ol>
        </Card>
      )}
    </Space>
  );
}
