"use client";

// 工作台使用共享 OrderDetailModal 组件（studio 模式）
// 保留此文件以兼容现有 import 路径
import SharedOrderDetailModal from "@/components/shared/OrderDetailModal";

interface StudioOrderDetailModalProps {
  orderId: string;
  onClose: (needRefresh: boolean) => void;
}

export default function StudioOrderDetailModal({
  orderId,
  onClose,
}: StudioOrderDetailModalProps) {
  return (
    <SharedOrderDetailModal
      orderId={orderId}
      onClose={onClose}
      variant="studio"
    />
  );
}
