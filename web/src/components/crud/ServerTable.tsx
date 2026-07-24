import type { ReactNode } from "react";
import { Alert, Button, Empty, Table } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import type { Paginated } from "../../lib/listQuery";
import { PAGE_SIZE_OPTIONS } from "../../lib/listQuery";

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
}) {
  return (
    <div>
      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          action={
            onRetry ? (
              <Button size="small" onClick={onRetry}>
                重试
              </Button>
            ) : undefined
          }
          style={{ marginBottom: 16 }}
        />
      )}
      <Table<T>
        rowKey={rowKey as string | ((r: T) => string)}
        loading={loading}
        columns={columns}
        dataSource={data?.items || []}
        expandable={expandable}
        scroll={{ x: scrollX === true ? "max-content" : scrollX }}
        locale={{ emptyText: <Empty description={emptyDescription} /> }}
        pagination={{
          current: data?.page || 1,
          pageSize: data?.page_size || 20,
          total: data?.total || 0,
          showSizeChanger: true,
          pageSizeOptions: PAGE_SIZE_OPTIONS.map(String),
          showTotal: (t) => `共 ${t} 条`,
          onChange: onPageChange,
        }}
      />
    </div>
  );
}

export type { ReactNode };
