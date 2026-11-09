import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { testConnection } from "../api";
import { EFFORTS, MODELS } from "../constants";
import type { ServerConfig, Settings } from "../types";

interface Props {
  open: boolean;
  settings: Settings;
  serverConfig: ServerConfig;
  onClose: () => void;
  onSave: (settings: Settings) => void;
}

export function SettingsDialog({
  open,
  settings,
  serverConfig,
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(settings);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  useEffect(() => {
    if (open) {
      setDraft(settings);
      setResult(null);
      setShowKey(false);
    }
  }, [open, settings]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const models = await testConnection(draft);
      setResult({
        ok: true,
        message: `连接成功，可用模型：${models.join("、") || "未返回模型列表"}`,
      });
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        data-testid="settings-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <h2>设置</h2>
          <button type="button" className="icon-button" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </header>

        <div className="form-field">
          <label htmlFor="api-key">DeepSeek API Key</label>
          <div className="key-input">
            <input
              id="api-key"
              type={showKey ? "text" : "password"}
              value={draft.apiKey}
              onChange={(event) =>
                setDraft({ ...draft, apiKey: event.target.value })
              }
              placeholder={
                serverConfig.hasServerKey
                  ? "留空则使用服务端环境变量 DEEPSEEK_API_KEY"
                  : "sk-..."
              }
              autoComplete="off"
              data-testid="settings-key"
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowKey((value) => !value)}
              title={showKey ? "隐藏 Key" : "显示 Key"}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="field-hint">
            Key 只保存在浏览器 localStorage，通过本地服务转发，不写入磁盘或日志。
          </p>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="model">模型</label>
            <select
              id="model"
              value={draft.model}
              onChange={(event) =>
                setDraft({ ...draft, model: event.target.value })
              }
            >
              {MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label} — {model.hint}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="effort">思考强度</label>
            <select
              id="effort"
              value={draft.effort}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  effort: event.target.value as Settings["effort"],
                })
              }
            >
              {EFFORTS.map((effort) => (
                <option key={effort.id} value={effort.id}>
                  {effort.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="settings-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={runTest}
            disabled={testing || (!draft.apiKey && !serverConfig.hasServerKey)}
          >
            {testing ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
            测试连接
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            data-testid="save-settings"
          >
            保存
          </button>
        </div>

        {result ? (
          <p className={`test-result ${result.ok ? "ok" : "error"}`}>
            {result.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
