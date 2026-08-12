import { Button } from "antd";
import { SwapOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import type { AuthPortal } from "../lib/types";

/** Render server-provided portal switches excluding the current shell. */
export function useOtherPortals(currentKind: AuthPortal["kind"] | AuthPortal["kind"][]): AuthPortal[] {
  const { portals } = useAuth();
  const kinds = Array.isArray(currentKind) ? currentKind : [currentKind];
  return (portals || []).filter((p) => !kinds.includes(p.kind));
}

export function PortalSwitchButtons({
  currentKind,
  size = "middle",
  className,
  plain,
}: {
  currentKind: AuthPortal["kind"] | AuthPortal["kind"][];
  size?: "small" | "middle" | "large";
  className?: string;
  /** Text buttons for learner Nav */
  plain?: boolean;
}) {
  const nav = useNavigate();
  const others = useOtherPortals(currentKind);
  if (!others.length) return null;
  return (
    <>
      {others.map((p) =>
        plain ? (
          <button
            key={p.id}
            type="button"
            className={className || "rounded-md px-2 py-1 hover:bg-fde-bg"}
            onClick={() => nav(p.path)}
          >
            {p.label}
          </button>
        ) : (
          <Button key={p.id} size={size} icon={<SwapOutlined />} className={className} onClick={() => nav(p.path)}>
            {p.label}
          </Button>
        ),
      )}
    </>
  );
}
