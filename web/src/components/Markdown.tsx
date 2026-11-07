import {
  Children,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { Check, Copy } from "lucide-react";
import { extractText } from "../utils/format";
import { ChartBlock } from "./ChartBlock";
import { GenerativeUI } from "./GenerativeUI";
import { TableBlock } from "./TableBlock";

type ElementWithChildren = ReactElement<{
  className?: string;
  children?: ReactNode;
}>;

function getCodeElement(children: ReactNode): ElementWithChildren | null {
  const first = Children.toArray(children)[0];
  if (!isValidElement(first)) return null;
  const props = first.props as { className?: string };
  if (typeof props.className !== "string") return null;
  return first as ElementWithChildren;
}

function CodeBlock({
  language,
  raw,
  children,
}: {
  language: string;
  raw: string;
  children: ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(raw.replace(/\n$/, ""));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard may be unavailable in an insecure context.
    }
  };

  return (
    <div className="code-block">
      <div className="code-head">
        <span>{language || "text"}</span>
        <button type="button" onClick={copy} aria-label="复制代码">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

export function Markdown({ content }: { content: string }) {
  const components: Components = {
    pre({ children }) {
      const code = getCodeElement(children);
      if (code) {
        const className = code.props.className ?? "";
        const language = /language-([\w-]+)/.exec(className)?.[1] ?? "";
        const raw = extractText(code.props.children);

        if (language === "ui") {
          return <GenerativeUI raw={raw} />;
        }

        if (language === "chart") {
          return <ChartBlock raw={raw} />;
        }

        return (
          <CodeBlock language={language} raw={raw}>
            {children}
          </CodeBlock>
        );
      }
      return <pre>{children}</pre>;
    },
    code({ className, children }) {
      return <code className={className}>{children}</code>;
    },
    table({ children }) {
      return <TableBlock>{children}</TableBlock>;
    },
    a({ href, children }) {
      return (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {children}
        </a>
      );
    },
    img({ src, alt }) {
      return <img src={src} alt={alt ?? ""} loading="lazy" />;
    },
    input({ checked }) {
      return <input type="checkbox" checked={Boolean(checked)} readOnly />;
    },
  };

  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeKatex,
          [rehypeHighlight, { detect: false, ignoreMissing: true }],
        ]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
