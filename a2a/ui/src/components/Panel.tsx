import type { PanelKind } from "@aom/shared";
import "./Panel.css";

interface TableData {
  columns: string[];
  rows: (string | number)[][];
}
interface BalanceData {
  label?: string;
  from?: string;
  to?: string;
  unitFrom?: string;
  unitTo?: string;
}

// Right-panel renderer (1D.2b). Driven entirely by scenario agentB.panel + data —
// no scenario logic, pure presentation.
export function Panel({ kind, data }: { kind: PanelKind; data: unknown }) {
  if (kind === "table") return <TablePanel data={data as TableData} />;
  if (kind === "balance") return <BalancePanel data={data as BalanceData} />;
  return <KeyValuePanel data={data as Record<string, unknown>} />;
}

function KeyValuePanel({ data }: { data: Record<string, unknown> }) {
  const entries = data && typeof data === "object" ? Object.entries(data) : [];
  return (
    <dl className="panel-kv mono">
      {entries.map(([k, v]) => (
        <div className="panel-kv-row" key={k}>
          <dt className="panel-kv-key">{k}</dt>
          <dd className="panel-kv-val">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function TablePanel({ data }: { data: TableData }) {
  if (!data?.columns) return null;
  return (
    <table className="panel-table mono">
      <thead>
        <tr>
          {data.columns.map((c) => (
            <th key={c}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>{String(cell)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BalancePanel({ data }: { data: BalanceData }) {
  return (
    <div className="panel-balance mono">
      <div className="panel-balance-label label">{data?.label ?? "balance"}</div>
      <div className="panel-balance-row">
        <span className="panel-balance-from">
          {data?.from} <span className="panel-balance-unit">{data?.unitFrom}</span>
        </span>
        <span className="panel-balance-arrow">→</span>
        <span className="panel-balance-to">
          {data?.to} <span className="panel-balance-unit">{data?.unitTo}</span>
        </span>
      </div>
    </div>
  );
}
