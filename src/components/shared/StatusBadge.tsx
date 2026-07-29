import { statusLabels, statusColors } from "@/lib/utils";

type StatusBadgeSize = "sm" | "md";

interface StatusBadgeProps {
  status: string;
  /**
   * 徽章尺寸。
   * - `md`（默认）：px-2.5 py-1，用于详情弹窗、查询结果等
   * - `sm`：px-2 py-0.5，用于表格/列表中紧凑展示
   */
  size?: StatusBadgeSize;
}

/**
 * 状态徽章：根据订单状态渲染对应的标签与配色。
 *
 * 复用于：
 * - 委托查询结果（md）
 * - 管理端委托列表（sm）
 * - 管理端委托详情弹窗（md）
 * - 工作室工作台列表（sm）与详情弹窗（md）
 */
export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const label = statusLabels[status] || status;
  const colorClass = statusColors[status] || "bg-gray-100 text-gray-800";
  const sizeClass = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";

  return (
    <span
      className={`inline-flex items-center ${sizeClass} rounded-full text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  );
}

export default StatusBadge;
