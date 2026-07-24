import { useState } from "react";
import { Alert, App, Button, Input, Modal, Space, Tabs, Typography, Upload } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { authorApi, ApiError } from "../../../lib/api";

type ValidateResult = { ok: boolean; days: number; titles?: string[]; errors?: string[] };

export function YamlImportModal({
  open,
  onCancel,
  onConfirm,
  submitting,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: (content: string) => void | Promise<void>;
  submitting?: boolean;
}) {
  const { message } = App.useApp();
  const [activeTab, setActiveTab] = useState<"paste" | "upload">("paste");
  const [pasteText, setPasteText] = useState("");
  const [fileName, setFileName] = useState("day-01.yaml");
  const [fileText, setFileText] = useState("");
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidateResult | null>(null);

  const content = activeTab === "paste" ? pasteText : fileText;

  const readFile = (f: File) => {
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setFileText(String(reader.result || ""));
    reader.readAsText(f);
    return false;
  };

  const validate = async () => {
    if (!content.trim()) {
      message.warning("请先粘贴或上传 YAML 内容");
      return;
    }
    setValidating(true);
    setResult(null);
    try {
      const file = new File([content], activeTab === "paste" ? "day-import.yaml" : fileName, {
        type: "text/yaml",
      });
      const res = await authorApi.validateCourseYaml([file]);
      setResult(res);
      if (res.ok) message.success("YAML 校验通过");
      else message.warning("YAML 校验发现问题，请查看下方详情");
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : "校验失败");
    } finally {
      setValidating(false);
    }
  };

  return (
    <Modal
      title="导入 YAML 课次"
      open={open}
      onCancel={onCancel}
      destroyOnClose
      width={680}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="validate" loading={validating} onClick={() => void validate()}>
          校验
        </Button>,
        <Button
          key="confirm"
          type="primary"
          loading={submitting}
          disabled={!content.trim()}
          onClick={() => void onConfirm(content)}
        >
          确认导入
        </Button>,
      ]}
    >
      <Tabs
        activeKey={activeTab}
        onChange={(k) => {
          setActiveTab(k as "paste" | "upload");
          setResult(null);
        }}
        items={[
          {
            key: "paste",
            label: "粘贴 YAML",
            children: (
              <Input.TextArea
                className="mono"
                rows={16}
                spellCheck={false}
                placeholder={"day: 1\ntitle: 示例课次\n..."}
                value={pasteText}
                onChange={(e) => {
                  setPasteText(e.target.value);
                  setResult(null);
                }}
              />
            ),
          },
          {
            key: "upload",
            label: "上传 day-*.yaml",
            children: (
              <Space direction="vertical" style={{ width: "100%" }}>
                <Upload accept=".yaml,.yml" maxCount={1} showUploadList={false} beforeUpload={readFile}>
                  <Button icon={<UploadOutlined />}>选择文件</Button>
                </Upload>
                {fileText ? (
                  <>
                    <Typography.Text type="secondary">{fileName}</Typography.Text>
                    <Input.TextArea className="mono" rows={12} value={fileText} readOnly />
                  </>
                ) : (
                  <Typography.Text type="secondary">尚未选择文件</Typography.Text>
                )}
              </Space>
            ),
          },
        ]}
      />
      {result && (
        <Alert
          style={{ marginTop: 12 }}
          type={result.ok ? "success" : "warning"}
          showIcon
          message={result.ok ? `校验通过 · 共 ${result.days} 课` : "校验发现问题"}
          description={
            <>
              {!!result.titles?.length && (
                <div>
                  课次标题：{result.titles.join("、")}
                </div>
              )}
              {!!result.errors?.length && (
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </>
          }
        />
      )}
    </Modal>
  );
}
