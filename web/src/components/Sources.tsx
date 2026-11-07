import { ChevronDown, Globe2 } from "lucide-react";
import type { SearchSource } from "../types";

function safeHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function Sources({ sources }: { sources: SearchSource[] }) {
  if (sources.length === 0) return null;

  return (
    <details className="sources" data-testid="sources">
      <summary>
        <Globe2 size={14} />
        <span>已搜索 {sources.length} 个网页</span>
        <ChevronDown size={14} />
      </summary>
      <ol>
        {sources.map((source, index) => (
          <li key={`${source.url}-${index}`}>
            <span className="source-index">{index + 1}</span>
            <div>
              <a href={source.url} target="_blank" rel="noreferrer noopener">
                {source.title}
              </a>
              <p>{source.snippet}</p>
              <small>{source.site_name ?? safeHost(source.url)}</small>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
