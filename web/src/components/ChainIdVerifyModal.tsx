import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog } from "./Dialog";
import { hashIdNumber } from "../lib/chainHash";

type FieldStatus = "idle" | "ok" | "fail";

function StatusBadge({ status, okLabel, failLabel }: { status: FieldStatus; okLabel: string; failLabel: string }) {
  if (status === "idle") return null;
  return (
    <span className={`chain-field-check ${status === "ok" ? "chain-field-check--ok" : "chain-field-check--fail"}`}>
      {status === "ok" ? okLabel : failLabel}
    </span>
  );
}

export function ChainIdVerifyModal({
  open,
  chainHash,
  onClose,
}: {
  open: boolean;
  chainHash: string;
  onClose: () => void;
}) {
  const [fullId, setFullId] = useState("");
  const [idHashStatus, setIdHashStatus] = useState<FieldStatus>("idle");

  const checkIdHash = useCallback(async () => {
    if (!chainHash || fullId.trim().length < 15) {
      setIdHashStatus("idle");
      return;
    }
    try {
      const local = await hashIdNumber(fullId);
      setIdHashStatus(local === chainHash ? "ok" : "fail");
    } catch {
      setIdHashStatus("idle");
    }
  }, [chainHash, fullId]);

  useEffect(() => {
    if (!open) return;
    void checkIdHash();
  }, [open, checkIdHash]);

  const handleClose = () => {
    setFullId("");
    setIdHashStatus("idle");
    onClose();
  };

  return (
    <Dialog open={open} title="证书核验" onClose={handleClose}>
      <p className="muted" style={{ marginTop: 0, lineHeight: 1.55 }}>
        输入完整身份证号，在本机计算 SHA256 并与链上哈希比对。原始证件号不会上传服务器。
      </p>
      <div className="chain-verify-modal-hash panel">
        <span className="muted">链上哈希</span>
        <p className="mono chain-hash-full" style={{ margin: "6px 0 0", wordBreak: "break-all" }}>
          {chainHash}
        </p>
      </div>
      <label className="identity-field" style={{ display: "block", marginTop: 16 }}>
        <span>完整身份证号</span>
        <input
          type="text"
          value={fullId}
          onChange={(e) => setFullId(e.target.value)}
          placeholder="仅在本机计算，不上传"
          className="mono"
          autoComplete="off"
          autoFocus
        />
      </label>
      <StatusBadge status={idHashStatus} okLabel="✓ 与链上哈希一致，核验通过" failLabel="与链上哈希不一致" />
      <p className="muted chain-verify-algo" style={{ marginTop: 12, marginBottom: 0 }}>
        <Link to="/chain/algorithms">查看算法说明</Link>
      </p>
    </Dialog>
  );
}
