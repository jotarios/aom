import { WebSocket } from "ws";
const ws = new WebSocket("ws://localhost:8787");
const t0 = Date.now();
ws.on("message",(d)=>{
  const e = JSON.parse(d.toString());
  const t = String(Date.now()-t0).padStart(5);
  const rail = e.rail ? ` rail=${e.rail}` : "";
  const lat  = e.latencyMs!=null ? ` lat=${e.latencyMs<1?e.latencyMs.toFixed(2):Math.round(e.latencyMs)}ms` : "";
  console.log(`+${t}ms  ${e.phase.padEnd(12)}${rail}${lat}  ${e.msg}`);
});
process.on("SIGTERM",()=>process.exit(0));
setTimeout(()=>process.exit(0), 12000);
