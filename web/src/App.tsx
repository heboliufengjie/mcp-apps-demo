import { useEffect, useRef, useState } from "react";
import { fetchServerConfig, searchWeb, streamChat } from "./api";
import { ChatView, type ComposerState } from "./components/ChatView";
import { ComparePanel } from "./components/ComparePanel";
import { SettingsDialog } from "./components/SettingsDialog";
import { Sidebar } from "./components/Sidebar";
import {
  DEFAULT_SETTINGS,
  loadActiveId,
  loadConversations,
  loadSettings,
  saveActiveId,
  saveConversations,
  saveSettings,
} from "./storage";
import type {
  ChatMessage,
  Comparison,
  Conversation,
  ServerConfig,
  Settings,
} from "./types";
import { truncate, uid } from "./utils/format";

interface CompareTarget {
  message: ChatMessage;
  question: string;
}

export function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [serverConfig, setServerConfig] = useState<ServerConfig>({
    hasServerKey: false,
    mock: false,
  });
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadConversations(),
  );
  const [activeId, setActiveId] = useState<string | null>(() => loadActiveId());
  const [streaming, setStreaming] = useState(false);
  const [composerState, setComposerState] = useState<ComposerState>({
    thinking: true,
    search: false,
  });
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.innerWidth > 900,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compareTarget, setCompareTarget] = useState<CompareTarget | null>(
    null,
  );
  const [toast, setToast] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) ?? null;

  useEffect(() => {
    void fetchServerConfig().then(setServerConfig);
  }, []);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    saveActiveId(activeId);
  }, [activeId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const patchConversation = (
    id: string,
    updater: (conversation: Conversation) => Conversation,
  ) => {
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === id ? updater(conversation) : conversation,
      ),
    );
  };

  const updateAssistant = (
    conversationId: string,
    assistantId: string,
    updater: (message: ChatMessage) => ChatMessage,
  ) => {
    patchConversation(conversationId, (conversation) => ({
      ...conversation,
      updatedAt: Date.now(),
      messages: conversation.messages.map((message) =>
        message.id === assistantId ? updater(message) : message,
      ),
    }));
  };

  const generateReply = async (
    conversationId: string,
    history: Array<{ role: "user" | "assistant"; content: string }>,
    assistantId: string,
    useSearch: boolean,
    thinking: boolean,
  ) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);

    const startedAt = Date.now();
    let firstContentAt: number | null = null;
    let reasoningMs: number | undefined;
    let sources: Awaited<ReturnType<typeof searchWeb>> = [];

    try {
      if (useSearch) {
        const question =
          [...history].reverse().find((item) => item.role === "user")?.content ??
          "";
        if (question) {
          try {
            sources = await searchWeb(question, settings, controller.signal);
            updateAssistant(conversationId, assistantId, (message) => ({
              ...message,
              sources,
            }));
          } catch (error) {
            if (controller.signal.aborted) throw error;
            setToast("联网搜索失败，已继续使用模型自身知识回答");
          }
        }
      }

      await streamChat({
        settings,
        history,
        thinking,
        sources,
        signal: controller.signal,
        onDelta: ({ content, reasoning }) => {
          if (reasoning) {
            updateAssistant(conversationId, assistantId, (message) => ({
              ...message,
              reasoning: `${message.reasoning ?? ""}${reasoning}`,
            }));
          }
          if (content) {
            firstContentAt ??= Date.now();
            reasoningMs ??= firstContentAt - startedAt;
            updateAssistant(conversationId, assistantId, (message) => ({
              ...message,
              content: `${message.content}${content}`,
              reasoningMs: message.reasoningMs ?? reasoningMs,
            }));
          }
        },
        onUsage: (usage) => {
          updateAssistant(conversationId, assistantId, (message) => ({
            ...message,
            usage,
          }));
        },
      });

      updateAssistant(conversationId, assistantId, (message) => ({
        ...message,
        status: "done",
        reasoningMs:
          message.reasoningMs ??
          (message.reasoning ? Date.now() - startedAt : undefined),
        error: message.content ? undefined : "模型没有返回内容",
      }));
    } catch (error) {
      const aborted = controller.signal.aborted;
      updateAssistant(conversationId, assistantId, (message) => ({
        ...message,
        status: "done",
        error: aborted
          ? message.content
            ? undefined
            : "已停止生成"
          : error instanceof Error
            ? error.message
            : String(error),
      }));
      if (!aborted) {
        setToast(
          error instanceof Error ? error.message : "请求失败，请稍后重试",
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const send = (text: string) => {
    if (streaming) return;
    if (!settings.apiKey && !serverConfig.hasServerKey && !serverConfig.mock) {
      setSettingsOpen(true);
      setToast("请先填写 DeepSeek API Key");
      return;
    }

    const now = Date.now();
    const userMessage: ChatMessage = {
      id: uid(),
      role: "user",
      content: text,
      createdAt: now,
      status: "done",
    };
    const assistantMessage: ChatMessage = {
      id: uid(),
      role: "assistant",
      content: "",
      model: settings.model,
      createdAt: now + 1,
      status: "streaming",
    };

    const existing = activeConversation;
    const conversationId = existing?.id ?? uid();
    const baseMessages = (existing?.messages ?? []).filter(
      (message) => message.role === "user" || message.content.trim(),
    );

    if (existing) {
      patchConversation(conversationId, (conversation) => ({
        ...conversation,
        title: conversation.messages.length
          ? conversation.title
          : truncate(text),
        messages: [...conversation.messages, userMessage, assistantMessage],
        updatedAt: now,
      }));
    } else {
      const conversation: Conversation = {
        id: conversationId,
        title: truncate(text),
        messages: [userMessage, assistantMessage],
        createdAt: now,
        updatedAt: now,
      };
      setConversations((previous) => [conversation, ...previous]);
      setActiveId(conversationId);
    }

    const history = [...baseMessages, userMessage]
      .filter((message) => message.content.trim())
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    void generateReply(
      conversationId,
      history,
      assistantMessage.id,
      composerState.search,
      composerState.thinking,
    );
  };

  const stop = () => {
    abortRef.current?.abort();
  };

  const regenerate = (assistantId: string) => {
    if (streaming || !activeConversation) return;
    const index = activeConversation.messages.findIndex(
      (message) => message.id === assistantId,
    );
    if (index < 0) return;

    const userIndex = [...activeConversation.messages.slice(0, index)]
      .reverse()
      .findIndex((message) => message.role === "user");
    if (userIndex < 0) return;
    const absoluteUserIndex = index - 1 - userIndex;
    const userMessage = activeConversation.messages[absoluteUserIndex];

    const history = activeConversation.messages
      .slice(0, absoluteUserIndex + 1)
      .filter((message) => message.content.trim())
      .map((message) => ({ role: message.role, content: message.content }));

    const assistantMessage: ChatMessage = {
      id: uid(),
      role: "assistant",
      content: "",
      model: settings.model,
      createdAt: Date.now(),
      status: "streaming",
    };

    patchConversation(activeConversation.id, (conversation) => ({
      ...conversation,
      messages: [
        ...conversation.messages.slice(0, absoluteUserIndex + 1),
        assistantMessage,
      ],
      updatedAt: Date.now(),
    }));

    void generateReply(
      activeConversation.id,
      history,
      assistantMessage.id,
      composerState.search,
      composerState.thinking,
    );
    setToast(`重新生成：${truncate(userMessage.content, 18)}`);
  };

  const visualize = (message: ChatMessage) => {
    if (streaming || !activeConversation || !message.content.trim()) return;
    const index = activeConversation.messages.findIndex(
      (item) => item.id === message.id,
    );
    if (index < 0) return;

    const history = activeConversation.messages
      .slice(0, index + 1)
      .filter((item) => item.content.trim())
      .map((item) => ({ role: item.role, content: item.content }));

    const instruction = {
      role: "user" as const,
      content:
        "请把上一条回答重排成更易读的可视化版本。你可以使用普通 Markdown、Markdown 表格，或一个 ```ui 块；具体用哪些组件（指标卡/表格/图表/结论卡/时间线/对比卡）由你根据内容判断，不要机械套模板。不要编造原回答中不存在的数据。直接输出结果。",
    };

    const assistantMessage: ChatMessage = {
      id: uid(),
      role: "assistant",
      content: "",
      model: settings.model,
      variant: "visualization",
      createdAt: Date.now(),
      status: "streaming",
    };

    patchConversation(activeConversation.id, (conversation) => ({
      ...conversation,
      messages: [...conversation.messages, assistantMessage],
      updatedAt: Date.now(),
    }));

    setToast("正在生成可视化版本…");
    void generateReply(
      activeConversation.id,
      [...history, instruction],
      assistantMessage.id,
      false,
      false,
    );
  };

  const openCompare = (message: ChatMessage) => {
    if (!activeConversation) return;
    const index = activeConversation.messages.findIndex(
      (item) => item.id === message.id,
    );
    const question =
      [...activeConversation.messages.slice(0, Math.max(0, index))]
        .reverse()
        .find((item) => item.role === "user")?.content ?? "";
    setCompareTarget({ message, question });
  };

  const saveComparison = (comparison: Comparison) => {
    if (!compareTarget || !activeConversation) return;
    patchConversation(activeConversation.id, (conversation) => ({
      ...conversation,
      updatedAt: Date.now(),
      messages: conversation.messages.map((message) =>
        message.id === compareTarget.message.id
          ? { ...message, comparison }
          : message,
      ),
    }));
    setCompareTarget(null);
    setToast("已保存对比");
  };

  const deleteConversation = (id: string) => {
    if (id === activeId && streaming) abortRef.current?.abort();
    setConversations((previous) =>
      previous.filter((conversation) => conversation.id !== id),
    );
    if (id === activeId) setActiveId(null);
  };

  return (
    <div className={`app ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      {sidebarOpen ? (
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          hasKey={
            Boolean(settings.apiKey) ||
            serverConfig.hasServerKey ||
            serverConfig.mock
          }
          onNew={() => {
            if (streaming) abortRef.current?.abort();
            setActiveId(null);
            if (window.innerWidth <= 900) setSidebarOpen(false);
          }}
          onSelect={(id) => {
            if (streaming) abortRef.current?.abort();
            setActiveId(id);
            if (window.innerWidth <= 900) setSidebarOpen(false);
          }}
          onDelete={deleteConversation}
          onOpenSettings={() => setSettingsOpen(true)}
          onCollapse={() => setSidebarOpen(false)}
        />
      ) : null}

      <ChatView
        conversation={activeConversation}
        settings={settings}
        streaming={streaming}
        composerState={composerState}
        sidebarOpen={sidebarOpen}
        onOpenSidebar={() => setSidebarOpen(true)}
        onSend={send}
        onStop={stop}
        onToggleThinking={() =>
          setComposerState((state) => ({
            ...state,
            thinking: !state.thinking,
          }))
        }
        onToggleSearch={() =>
          setComposerState((state) => ({ ...state, search: !state.search }))
        }
        onRegenerate={regenerate}
        onCompare={openCompare}
        onVisualize={visualize}
      />

      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        serverConfig={serverConfig}
        onClose={() => setSettingsOpen(false)}
        onSave={(next) => setSettings({ ...DEFAULT_SETTINGS, ...next })}
      />

      {compareTarget ? (
        <ComparePanel
          message={compareTarget.message}
          question={compareTarget.question}
          onClose={() => setCompareTarget(null)}
          onSave={saveComparison}
        />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
