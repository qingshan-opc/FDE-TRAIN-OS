import { useEffect, useMemo, useState } from "react";
import { Empty, Segmented, Space, Tag, Typography } from "antd";
import type { AuthorCapsule, AuthorDayPackage } from "./dayPackage";
import { CapsuleStepPreview } from "../../components/learn/CapsuleStepPreview";

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

  if (!capsules.length) {
    return <Empty description="本课还没有课节，预览为空" />;
  }

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
        <CapsuleStepPreview
          capsule={active}
          campId={campId}
          day={pkg.day}
          resources={pkg.resources || []}
        />
      )}
    </Space>
  );
}
