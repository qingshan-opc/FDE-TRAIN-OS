import { App, Modal } from "antd";
import { useEffect, useState } from "react";
import type { AuthorCapsule, AuthorDayPackage, CapsuleEditorTab } from "../dayPackage";
import { newCapsuleId } from "../dayPackage";
import { CapsuleEditorTabs } from "../CapsuleEditorTabs";

export function CapsuleModal({
  open,
  pkg,
  versionId,
  readonly,
  initialCapsule,
  onCancel,
  onSubmit,
  submitting,
}: {
  open: boolean;
  pkg: AuthorDayPackage;
  versionId: string;
  readonly?: boolean;
  initialCapsule?: AuthorCapsule;
  onCancel: () => void;
  onSubmit: (capsule: AuthorCapsule) => void | Promise<void>;
  submitting?: boolean;
}) {
  const { message } = App.useApp();
  const isEdit = !!initialCapsule?.id;
  const [draft, setDraft] = useState<AuthorCapsule>(() => ({
    id: "",
    title: "",
    minutes: 15,
    content: "",
    practice: "",
  }));
  const [activeTab, setActiveTab] = useState<CapsuleEditorTab>("notes");

  useEffect(() => {
    if (!open) return;
    const nextCount = (pkg.learn?.capsules || []).length + 1;
    setDraft(
      initialCapsule || {
        id: "",
        title: `第 ${nextCount} 节`,
        minutes: 15,
        content: "",
        practice: "",
      },
    );
    setActiveTab("notes");
  }, [open, initialCapsule, pkg.learn?.capsules?.length]);

  const patch = (partial: Partial<AuthorCapsule>) => setDraft((d) => ({ ...d, ...partial }));

  const handleOk = () => {
    const id = (draft.id || "").trim() || newCapsuleId(pkg.learn?.capsules || []);
    if (!id) {
      message.error("请输入节 ID");
      setActiveTab("notes");
      return;
    }
    if (!draft.title?.trim()) {
      message.error("请输入节标题");
      setActiveTab("notes");
      return;
    }
    if (!isEdit && (pkg.learn?.capsules || []).some((c) => c.id === id)) {
      message.error(`课节 ID「${id}」已存在`);
      setActiveTab("notes");
      return;
    }
    void Promise.resolve(onSubmit({ ...draft, id, title: draft.title.trim() }));
  };

  return (
    <Modal
      title={isEdit ? `编辑课节 · ${initialCapsule?.id}` : "新增课节"}
      open={open}
      onCancel={onCancel}
      destroyOnClose
      confirmLoading={submitting}
      okText="保存"
      cancelText="取消"
      width={920}
      styles={{ body: { maxHeight: "70vh", overflow: "auto" } }}
      onOk={handleOk}
    >
      <CapsuleEditorTabs
        capsule={draft}
        pkg={pkg}
        capsuleId={draft.id || "draft"}
        versionId={versionId}
        readonly={Boolean(readonly)}
        patch={patch}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        idEditable={!isEdit}
      />
    </Modal>
  );
}
