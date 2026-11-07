import type { ReactNode } from "react";

export function TableBlock({ children }: { children: ReactNode }) {
  return (
    <div className="table-block">
      <div className="table-scroll">
        <table data-testid="markdown-table">{children}</table>
      </div>
    </div>
  );
}
