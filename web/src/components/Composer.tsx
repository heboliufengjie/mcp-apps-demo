import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Brain,
  Globe2,
  Paperclip,
  Square,
} from "lucide-react";

interface Props {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  thinking: boolean;
  search: boolean;
  onToggleThinking: () => void;
  onToggleSearch: () => void;
  disabled?: boolean;
}

export function Composer({
  onSend,
  onStop,
  streaming,
  thinking,
  search,
  onToggleThinking,
  onToggleSearch,
  disabled,
}: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || streaming || disabled) return;
    onSend(text);
    setValue("");
  };

  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="给 DeepSeek 发送消息"
          data-testid="composer-input"
          aria-label="消息输入框"
        />

        <div className="composer-bar">
          <div className="composer-tools">
            <button
              type="button"
              className={`tool-pill ${thinking ? "active" : ""}`}
              onClick={onToggleThinking}
              title="深度思考：使用 reasoning_effort 参数"
            >
              <Brain size={14} />
              深度思考
            </button>
            <button
              type="button"
              className={`tool-pill ${search ? "active" : ""}`}
              onClick={onToggleSearch}
              title="智能搜索：调用 DeepSeek Search API"
            >
              <Globe2 size={14} />
              智能搜索
            </button>
            <button
              type="button"
              className="icon-button subtle"
              title="文件上传暂未实现"
              disabled
            >
              <Paperclip size={17} />
            </button>
          </div>

          {streaming ? (
            <button
              type="button"
              className="send-button stop"
              onClick={onStop}
              title="停止生成"
              data-testid="stop-button"
            >
              <Square size={15} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              className="send-button"
              onClick={submit}
              disabled={!value.trim() || disabled}
              title="发送"
              data-testid="send-button"
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </div>
      <p className="composer-hint">
        内容由 DeepSeek API 生成，请自行核实；Key 只保存在本机浏览器。
      </p>
    </div>
  );
}
