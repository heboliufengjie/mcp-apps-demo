import { useMemo, useState } from "react";
import {
  PanelLeftClose,
  Search,
  Settings,
  SquarePen,
  Trash2,
} from "lucide-react";
import type { Conversation } from "../types";
import { dateGroup } from "../utils/format";
import { Logo } from "./Logo";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  hasKey: boolean;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
  onCollapse: () => void;
}

const GROUP_ORDER = ["今天", "昨天", "7 天内", "30 天内", "更早"];

export function Sidebar({
  conversations,
  activeId,
  hasKey,
  onNew,
  onSelect,
  onDelete,
  onOpenSettings,
  onCollapse,
}: Props) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const filtered = query.trim()
      ? conversations.filter((item) =>
          item.title.toLowerCase().includes(query.trim().toLowerCase()),
        )
      : conversations;

    const sorted = [...filtered].sort((a, b) => b.updatedAt - a.updatedAt);
    const map = new Map<string, Conversation[]>();
    for (const conversation of sorted) {
      const group = dateGroup(conversation.updatedAt);
      const list = map.get(group) ?? [];
      list.push(conversation);
      map.set(group, list);
    }
    return GROUP_ORDER.filter((group) => map.has(group)).map((group) => ({
      group,
      items: map.get(group) ?? [],
    }));
  }, [conversations, query]);

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="brand">
          <Logo size={26} />
          <span>deepseek</span>
          <em>MCP Apps</em>
        </div>
        <div className="sidebar-head-actions">
          <button
            type="button"
            className="icon-button"
            onClick={() => setSearching((value) => !value)}
            title="搜索对话"
          >
            <Search size={17} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onCollapse}
            title="收起侧边栏"
          >
            <PanelLeftClose size={17} />
          </button>
        </div>
      </div>

      {searching ? (
        <input
          className="sidebar-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索历史对话"
          autoFocus
        />
      ) : null}

      <button type="button" className="new-chat" onClick={onNew} data-testid="new-chat">
        <SquarePen size={16} />
        开启新对话
      </button>

      <nav className="history" aria-label="历史对话">
        {groups.length === 0 ? (
          <p className="history-empty">
            {query ? "没有匹配的对话" : "暂无对话，开始提问吧"}
          </p>
        ) : (
          groups.map(({ group, items }) => (
            <section key={group}>
              <h3>{group}</h3>
              {items.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`history-item ${
                    conversation.id === activeId ? "active" : ""
                  }`}
                  data-testid="conversation-item"
                >
                  <button
                    type="button"
                    className="history-title"
                    onClick={() => onSelect(conversation.id)}
                    title={conversation.title}
                  >
                    {conversation.title}
                  </button>
                  <button
                    type="button"
                    className="history-delete"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(conversation.id);
                    }}
                    title="删除对话"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </section>
          ))
        )}
      </nav>

      <div className="sidebar-foot">
        <div className="user-row">
          <span className="avatar">L</span>
          <div>
            <strong>本地用户</strong>
            <small className={hasKey ? "ok" : "warn"}>
              {hasKey ? "API Key 已配置" : "未配置 API Key"}
            </small>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onOpenSettings}
            title="设置"
            data-testid="open-settings"
          >
            <Settings size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}
