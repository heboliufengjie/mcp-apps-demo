import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Clipboard,
  ExternalLink,
  ImagePlus,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import type {
  ChatMessage,
  Comparison,
  FeatureFlags,
} from "../types";
import { detectFeatures } from "../utils/format";
import {
  loadComparisonImage,
  removeComparisonImage,
  saveComparisonImage,
} from "../storage";
import { compressImage } from "../utils/format";
import { Markdown } from "./Markdown";

interface Props {
  message: ChatMessage;
  question: string;
  onClose: () => void;
  onSave: (comparison: Comparison) => void;
}

const FEATURES: Array<{ key: keyof FeatureFlags; label: string }> = [
  { key: "ui", label: "生成式 UI" },
  { key: "table", label: "表格" },
  { key: "chart", label: "图表" },
  { key: "formula", label: "公式" },
  { key: "code", label: "代码" },
];

const EMPTY_FLAGS: FeatureFlags = {
  ui: false,
  table: false,
  chart: false,
  formula: false,
  code: false,
};

export function ComparePanel({ message, question, onClose, onSave }: Props) {
  const [tab, setTab] = useState<"text" | "image">(
    message.comparison?.hasImage ? "image" : "text",
  );
  const [officialText, setOfficialText] = useState(
    message.comparison?.officialText ?? "",
  );
  const [features, setFeatures] = useState<FeatureFlags>(
    message.comparison?.officialFeatures ?? EMPTY_FLAGS,
  );
  const [note, setNote] = useState(message.comparison?.note ?? "");
  const [image, setImage] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(
    Boolean(message.comparison?.hasImage),
  );
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!message.comparison?.hasImage) return;
    let cancelled = false;
    loadComparisonImage(message.id)
      .then((data) => {
        if (!cancelled && data) setImage(data);
      })
      .finally(() => {
        if (!cancelled) setLoadingImage(false);
      });
    return () => {
      cancelled = true;
    };
  }, [message.id, message.comparison?.hasImage]);

  useEffect(() => {
    if (!officialText.trim()) {
      setFeatures(EMPTY_FLAGS);
      return;
    }
    setFeatures(detectFeatures(officialText));
  }, [officialText]);

  const localFeatures = useMemo(
    () => detectFeatures(message.content),
    [message.content],
  );

  const differences = FEATURES.filter(
    (feature) => localFeatures[feature.key] !== features[feature.key],
  );

  const save = async () => {
    setSaving(true);
    try {
      if (image) {
        await saveComparisonImage(message.id, image);
      } else if (message.comparison?.hasImage) {
        await removeComparisonImage(message.id);
      }
      onSave({
        officialText,
        officialFeatures: features,
        note,
        hasImage: Boolean(image),
        updatedAt: Date.now(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const file = Array.from(files).find((item) =>
      item.type.startsWith("image/"),
    );
    if (!file) return;
    const data = await compressImage(file);
    setImage(data);
    setTab("image");
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (files.length > 0) {
      event.preventDefault();
      void handleFiles(files);
    }
  };

  const copyQuestion = async () => {
    try {
      await navigator.clipboard.writeText(question);
    } catch {
      // Ignore.
    }
  };

  return (
    <div className="compare-backdrop" onMouseDown={onClose}>
      <div
        className="compare-panel"
        role="dialog"
        aria-modal="true"
        aria-label="与官方对比"
        data-testid="compare-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="compare-head">
          <div>
            <h2>与官方 DeepSeek 对比</h2>
            <p>同一个问题，对比两边实际展示的表格、图表、公式与代码。</p>
          </div>
          <div className="compare-head-actions">
            <a
              className="secondary-button"
              href="https://chat.deepseek.com/"
              target="_blank"
              rel="noreferrer noopener"
            >
              <ExternalLink size={14} />
              打开官方
            </a>
            <button
              type="button"
              className="secondary-button"
              onClick={copyQuestion}
              title="复制问题到官方"
            >
              <Clipboard size={14} />
              复制问题
            </button>
            <button type="button" className="icon-button" onClick={onClose} title="关闭">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="compare-question">
          <span>问题</span>
          <p>{question || "（未找到对应问题）"}</p>
        </div>

        <div className="feature-matrix" data-testid="feature-matrix">
          {FEATURES.map((feature) => (
            <div key={feature.key} className="feature-row">
              <span>{feature.label}</span>
              <span className={localFeatures[feature.key] ? "yes" : "no"}>
                本地 {localFeatures[feature.key] ? "✓" : "—"}
              </span>
              <span className={features[feature.key] ? "yes" : "no"}>
                官方 {features[feature.key] ? "✓" : "—"}
              </span>
            </div>
          ))}
          <div className="feature-summary">
            {differences.length === 0
              ? "检测到的渲染能力一致"
              : `差异：${differences
                  .map((feature) => feature.label)
                  .join("、")} 两边表现不同`}
          </div>
        </div>

        <div className="compare-columns">
          <section className="compare-column official">
            <header>
              <div>
                <h3>官方 DeepSeek</h3>
                <small>复制官方回答文本，或粘贴官方页面截图</small>
              </div>
              <div className="tab-switch">
                <button
                  type="button"
                  className={tab === "text" ? "active" : ""}
                  onClick={() => setTab("text")}
                >
                  文本
                </button>
                <button
                  type="button"
                  className={tab === "image" ? "active" : ""}
                  onClick={() => setTab("image")}
                >
                  截图
                </button>
              </div>
            </header>

            {tab === "text" ? (
              <div className="official-text-wrap">
                <textarea
                  value={officialText}
                  onChange={(event) => setOfficialText(event.target.value)}
                  placeholder="把官方 DeepSeek 的回答粘贴到这里（支持 Markdown）"
                  data-testid="official-text"
                />
                {officialText.trim() ? (
                  <div className="official-preview">
                    <Markdown content={officialText} />
                  </div>
                ) : (
                  <div className="empty-hint">
                    粘贴后会自动识别官方回答里包含的表格、公式和代码块。
                  </div>
                )}
              </div>
            ) : (
              <div
                className="image-drop"
                onPaste={handlePaste}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void handleFiles(event.dataTransfer.files);
                }}
                data-testid="official-image-drop"
              >
                {loadingImage ? (
                  <Loader2 size={22} className="spin" />
                ) : image ? (
                  <img src={image} alt="官方回答截图" />
                ) : (
                  <div className="empty-hint">
                    <ImagePlus size={26} />
                    <p>点击上传，或直接 Ctrl+V 粘贴官方页面截图</p>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      选择图片
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    if (event.target.files) void handleFiles(event.target.files);
                  }}
                />
                {image ? (
                  <button
                    type="button"
                    className="image-remove"
                    onClick={() => setImage(null)}
                    title="移除截图"
                  >
                    <RotateCcw size={15} />
                  </button>
                ) : null}
              </div>
            )}

            <div className="feature-toggles">
              <span>官方页面实际渲染了：</span>
              {FEATURES.map((feature) => (
                <label key={feature.key} className="feature-check">
                  <input
                    type="checkbox"
                    checked={features[feature.key]}
                    onChange={(event) =>
                      setFeatures({
                        ...features,
                        [feature.key]: event.target.checked,
                      })
                    }
                  />
                  {feature.label}
                </label>
              ))}
            </div>
          </section>

          <section className="compare-column local">
            <header>
              <div>
                <h3>本地应用</h3>
                <small>同一回答在 DeepSeek 风格聊天界面中的渲染结果</small>
              </div>
            </header>
            <div className="local-preview">
              <Markdown content={message.content} />
            </div>
          </section>
        </div>

        <footer className="compare-foot">
          <input
            className="note-input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="补充观察，例如：官方把图表显示成了代码块"
          />
          <div>
            <button type="button" className="secondary-button" onClick={onClose}>
              取消
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => void save()}
              disabled={saving}
              data-testid="save-comparison"
            >
              {saving ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
              保存对比
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
