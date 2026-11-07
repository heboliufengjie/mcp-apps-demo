import { useEffect, useState } from "react";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { formatDuration } from "../utils/format";

interface Props {
  text: string;
  streaming: boolean;
  durationMs?: number;
}

export function Reasoning({ text, streaming, durationMs }: Props) {
  const [open, setOpen] = useState(streaming);

  useEffect(() => {
    setOpen(streaming);
  }, [streaming]);

  if (!text.trim()) return null;

  return (
    <div className={`reasoning ${streaming ? "streaming" : ""}`}>
      <button
        type="button"
        className="reasoning-head"
        onClick={() => setOpen((value) => !value)}
      >
        {streaming ? (
          <Loader2 size={14} className="spin" />
        ) : (
          <Brain size={14} />
        )}
        <span>
          {streaming
            ? "深度思考中…"
            : `已深度思考${
                durationMs ? `（用时 ${formatDuration(durationMs)}）` : ""
              }`}
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open ? <div className="reasoning-body">{text}</div> : null}
    </div>
  );
}
