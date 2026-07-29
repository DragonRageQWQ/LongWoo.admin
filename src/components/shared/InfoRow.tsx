interface InfoRowProps {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
}

/**
 * 信息行：图标 + 标签 + 值的通用展示单元。
 *
 * 复用于委托详情弹窗中的基本信息、客户信息等区块。
 */
export function InfoRow({ icon: Icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm text-lw-black break-words">{value || "-"}</p>
      </div>
    </div>
  );
}

export default InfoRow;
