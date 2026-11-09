import { useMemo } from "react";
import { McpVisualization } from "./McpVisualization";
import { parseUiBlocks } from "../utils/parseUiBlocks";

export function GenerativeUI({ raw }: { raw: string }) {
  const parsed = useMemo(() => parseUiBlocks(raw), [raw]);
  if ("error" in parsed) return <div className="chart-error" data-testid="ui-error">{parsed.error}</div>;
  return <McpVisualization blocks={parsed.blocks!} />;
}
