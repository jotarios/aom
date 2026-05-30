import { useEffect, useRef } from "react";
import type { LogLine } from "../state";
import { ChainLink } from "./ChainLink";
import "./LogStream.css";

function fmtTs(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString("en-GB", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
}

export function LogStream({ lines }: { lines: LogLine[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines.length]);

  return (
    <div className="log-stream">
      {lines.map((l) => (
        <div className="log-row" data-level={l.level} key={l.id}>
          <span className="log-ts mono">{fmtTs(l.ts)}</span>
          <span className="log-tag mono">{l.tag}</span>
          <span className="log-msg mono">
            {l.msg}
            {l.txHash ? (
              <>
                {" "}
                <ChainLink value={l.txHash} kind="tx" />
              </>
            ) : null}
          </span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
