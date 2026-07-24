import { useEffect, useState } from "react";
import { Button, Flex, Input, Select } from "antd";
import { SEARCH_DEBOUNCE_MS } from "../../lib/listQuery";
import { useAuthorLayout, authorSelectPopup } from "../../lib/authorLayoutContext";

export type SearchField = {
  key: string;
  label: string;
  type: "search" | "select" | "input";
  options?: { label: string; value: string }[];
  placeholder?: string;
  allowClear?: boolean;
  width?: number;
};

export function SearchToolbar({
  fields,
  values,
  onChange,
  onReset,
  debounceMs = SEARCH_DEBOUNCE_MS,
}: {
  fields: SearchField[];
  values: Record<string, string | undefined>;
  onChange: (key: string, value: string | undefined) => void;
  onReset?: () => void;
  debounceMs?: number;
}) {
  const { getContentPopupContainer } = useAuthorLayout();
  const selectPopup = authorSelectPopup(getContentPopupContainer);
  const searchField = fields.find((f) => f.type === "search");
  const [localQ, setLocalQ] = useState(values[searchField?.key || "q"] || "");
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );

  useEffect(() => {
    setLocalQ(values[searchField?.key || "q"] || "");
  }, [values, searchField?.key]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const onChangeMq = () => setIsMobile(mq.matches);
    onChangeMq();
    mq.addEventListener("change", onChangeMq);
    return () => mq.removeEventListener("change", onChangeMq);
  }, []);

  useEffect(() => {
    if (!searchField) return;
    const handle = window.setTimeout(() => {
      const next = localQ.trim();
      const cur = (values[searchField.key] || "").trim();
      if (next !== cur) onChange(searchField.key, next || undefined);
    }, debounceMs);
    return () => window.clearTimeout(handle);
  }, [localQ, debounceMs, searchField, onChange, values]);

  const hasFilters = Object.values(values).some((v) => !!v);

  return (
    <Flex
      className="author-search-toolbar"
      wrap={isMobile ? "wrap" : "nowrap"}
      gap={12}
      style={{ marginBottom: 16, alignItems: "center" }}
    >
      {fields.map((f) => {
        if (f.type === "search") {
          return (
            <Input.Search
              key={f.key}
              allowClear
              placeholder={f.placeholder || f.label}
              value={localQ}
              onChange={(e) => setLocalQ(e.target.value)}
              onSearch={(v) => onChange(f.key, v.trim() || undefined)}
              style={{
                width: isMobile ? "100%" : f.width ?? 300,
                flex: isMobile ? "1 1 100%" : "none",
                maxWidth: isMobile ? undefined : 320,
              }}
            />
          );
        }
        if (f.type === "select") {
          return (
            <Select
              key={f.key}
              allowClear={f.allowClear !== false}
              placeholder={f.placeholder || f.label}
              value={values[f.key] || undefined}
              options={f.options}
              onChange={(v) => onChange(f.key, v || undefined)}
              style={{
                width: f.width ?? 160,
                flex: "none",
                minWidth: f.width ?? 120,
              }}
              getPopupContainer={selectPopup}
            />
          );
        }
        return (
          <Input
            key={f.key}
            allowClear
            placeholder={f.placeholder || f.label}
            value={values[f.key] || ""}
            onChange={(e) => onChange(f.key, e.target.value.trim() || undefined)}
            style={{
              width: f.width ?? 160,
              flex: "none",
              minWidth: f.width ?? 120,
            }}
          />
        );
      })}
      {hasFilters && onReset && (
        <Button onClick={onReset} style={{ flex: "none" }}>
          重置
        </Button>
      )}
    </Flex>
  );
}
