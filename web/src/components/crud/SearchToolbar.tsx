import { useEffect, useState, type ReactNode } from "react";
import { Button, Flex, Input, Select, Space } from "antd";
import { SearchOutlined } from "@ant-design/icons";
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
  fields = [],
  values = {},
  onChange,
  onReset,
  extra,
  leading,
}: {
  fields?: SearchField[];
  values?: Record<string, string | undefined>;
  onChange?: (key: string, value: string | undefined) => void;
  onReset?: () => void;
  /** @deprecated 保留兼容；现改为点击「搜索」或 Enter 触发 */
  debounceMs?: number;
  /** 右侧操作按钮（新增 / 上传等），与搜索同一行 */
  extra?: ReactNode;
  /** 自定义左侧区域（如 Tabs），与 fields 二选一或并用 */
  leading?: ReactNode;
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

  const applySearch = () => {
    if (!searchField || !onChange) return;
    const next = localQ.trim();
    onChange(searchField.key, next || undefined);
  };

  const hasFilters = Object.values(values).some((v) => !!v);

  return (
    <div className={`author-search-toolbar${extra ? " author-search-toolbar--with-extra" : ""}`}>
      <Flex
        className="author-search-toolbar__filters"
        wrap={isMobile ? "wrap" : "nowrap"}
        gap={10}
        align="center"
      >
        {leading}
        {fields.map((f) => {
          if (f.type === "search") {
            return (
              <Input
                key={f.key}
                allowClear
                placeholder={f.placeholder || f.label}
                value={localQ}
                onChange={(e) => setLocalQ(e.target.value)}
                onPressEnter={applySearch}
                className="author-search-toolbar__input"
                style={{
                  width: isMobile ? "100%" : f.width ?? 260,
                  flex: isMobile ? "1 1 100%" : "none",
                  maxWidth: isMobile ? undefined : 300,
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
                onChange={(v) => onChange?.(f.key, v || undefined)}
                className="author-search-toolbar__select"
                style={{
                  width: f.width ?? 148,
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
              onChange={(e) => onChange?.(f.key, e.target.value.trim() || undefined)}
              className="author-search-toolbar__input"
              style={{
                width: f.width ?? 148,
                flex: "none",
                minWidth: f.width ?? 110,
              }}
            />
          );
        })}
        {searchField ? (
          <Button type="primary" icon={<SearchOutlined />} onClick={applySearch} className="author-search-toolbar__search-btn">
            搜索
          </Button>
        ) : null}
        {onReset ? (
          <Button onClick={onReset} disabled={!hasFilters} className="author-search-toolbar__reset-btn">
            重置
          </Button>
        ) : null}
      </Flex>
      {extra ? (
        <Space wrap className="author-search-toolbar__extra" size={8}>
          {extra}
        </Space>
      ) : null}
    </div>
  );
}
