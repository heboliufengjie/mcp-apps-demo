import { BarChart3, Sparkles, Table2 } from "lucide-react";
import { Logo } from "./Logo";

const SUGGESTIONS = [
  {
    icon: Table2,
    title: "表格总结",
    prompt: "用表格对比 deepseek-flash 和 deepseek-v4-pro 在速度、成本、适用场景上的差异",
  },
  {
    icon: BarChart3,
    title: "图表分析",
    prompt: "用表格和图表展示本月各区域销售数据，并分析哪个区域需要重点关注",
  },
  {
    icon: Sparkles,
    title: "结构化拆解",
    prompt: "解释 MCP Apps 的工作机制，用表格列出 Server、Host、View 三方的职责",
  },
];

export function EmptyState({
  onPick,
}: {
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="empty-state" data-testid="empty-state">
      <div className="empty-hero">
        <Logo size={44} />
        <h1>你好，让我们开始聊天吧</h1>
        <p>由模型根据内容决定用表格、图表还是生成式 UI 来呈现。</p>
      </div>
      <div className="suggestion-grid">
        {SUGGESTIONS.map(({ icon: Icon, title, prompt }) => (
          <button
            key={title}
            type="button"
            className="suggestion"
            onClick={() => onPick(prompt)}
          >
            <Icon size={16} />
            <strong>{title}</strong>
            <span>{prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
