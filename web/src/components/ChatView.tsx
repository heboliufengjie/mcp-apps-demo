import { useEffect, useRef } from "react";
import { PanelLeftOpen } from "lucide-react";
import type { ChatMessage, Conversation, Settings } from "../types";
import { Composer } from "./Composer";
import { EmptyState } from "./EmptyState";
import { MessageItem } from "./MessageItem";

export interface ComposerState {
  thinking: boolean;
  search: boolean;
}

interface Props {
  conversation: Conversation | null;
  settings: Settings;
  streaming: boolean;
  composerState: ComposerState;
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
  onSend: (text: string) => void;
  onStop: () => void;
  onToggleThinking: () => void;
  onToggleSearch: () => void;
  onRegenerate: (messageId: string) => void;
  onCompare: (message: ChatMessage) => void;
  onVisualize: (message: ChatMessage) => void;
}

export function ChatView({
  conversation,
  settings,
  streaming,
  composerState,
  sidebarOpen,
  onOpenSidebar,
  onSend,
  onStop,
  onToggleThinking,
  onToggleSearch,
  onRegenerate,
  onCompare,
  onVisualize,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const messages = conversation?.messages ?? [];
  const lastMessage = messages[messages.length - 1];
  const lastAssistantId = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.id;
  const scrollKey = `${messages.length}-${lastMessage?.content.length ?? 0}-${
    lastMessage?.reasoning?.length ?? 0
  }`;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [scrollKey, conversation?.id]);

  return (
    <main className="main">
      <header className="main-head">
        {!sidebarOpen ? (
          <button
            type="button"
            className="icon-button"
            onClick={onOpenSidebar}
            title="展开侧边栏"
          >
            <PanelLeftOpen size={18} />
          </button>
        ) : null}
        <div className="main-title">
          <span>{conversation?.title ?? "新对话"}</span>
          {settings.model ? <em>{settings.model}</em> : null}
        </div>
      </header>

      <div className="chat-scroll">
        {messages.length === 0 ? (
          <EmptyState onPick={onSend} />
        ) : (
          <div className="message-list">
            {messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                canRegenerate={
                  message.id === lastAssistantId &&
                  message.status !== "streaming" &&
                  !streaming
                }
                onRegenerate={() => onRegenerate(message.id)}
                onCompare={() => onCompare(message)}
                onVisualize={() => onVisualize(message)}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <Composer
        onSend={onSend}
        onStop={onStop}
        streaming={streaming}
        thinking={composerState.thinking}
        search={composerState.search}
        onToggleThinking={onToggleThinking}
        onToggleSearch={onToggleSearch}
      />
    </main>
  );
}
