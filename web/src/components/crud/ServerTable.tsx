import type { ReactNode } from "react";
import { Empty, Table } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import type { Paginated } from "../../lib/listQuery";
import { PAGE_SIZE_OPTIONS } from "../../lib/listQuery";
import { useListTableScroll } from "../../hooks/useListTableScroll";
import { useErrorModal } from "../../hooks/useErrorModal";
import { useAuthorLayout, authorSelectPopup } from "../../lib/authorLayoutContext";

export function ServerTable<T extends object>({
  rowKey,
  columns,
  data,
  loading,
  error,
  onRetry,
  onPageChange,
  emptyDescription = "暂无数据",
  scrollX = true,
  expandable,
  /** One-viewport list pages only. Detail pages should pass false so the table grows with content. */
  fitViewport = true,
}: {
  rowKey: keyof T | ((r: T) => string);
  columns: ColumnsType<T>;
  data?: Paginated<T> | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onPageChange: (page: number, pageSize: number) => void;
  emptyDescription?: string;
  scrollX?: number | true;
  expandable?: TableProps<T>["expandable"];
  fitViewport?: boolean;
}) {
  const { getContentPopupContainer } = useAuthorLayout();
  const selectPopup = authorSelectPopup(getContentPopupContainer);
  const { containerRef, scrollY } = useListTableScroll(
    fitViewport ? [data?.items, loading, data?.page, data?.page_size] : [],
  );

  useErrorModal(error, { title: "加载失败", onRetry });

  const scroll = fitViewport
    ? { x: scrollX === true ? "max-content" : scrollX, y: scrollY }
    : { x: scrollX === true ? "max-content" : scrollX };

  return (
    <div
      className={fitViewport ? "author-list-table-card" : "author-table-fluid"}
      ref={fitViewport ? containerRef : undefined}
    >
      <Table<T>
        rowKey={rowKey as string | ((r: T) => string)}
        loading={loading}
        columns={columns}
        dataSource={data?.items || []}
        expandable={expandable}
        scroll={scroll}
        locale={{ emptyText: <Empty description={emptyDescription} /> }}
        getPopupContainer={selectPopup}
        pagination={
          fitViewport
            ? {
                current: data?.page || 1,
                pageSize: data?.page_size || 20,
                total: data?.total || 0,
                showSizeChanger: true,
                pageSizeOptions: PAGE_SIZE_OPTIONS.map(String),
                showTotal: (t) => `共 ${t} 条`,
                position: ["bottomCenter"],
                onChange: onPageChange,
              }
            : false
        }
      />
    </div>
  );
}

export type { ReactNode };
