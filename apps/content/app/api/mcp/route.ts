// MCP server endpoint (doc 04 §10, ported to the content app for M17) — JSON-RPC 2.0
// over HTTP. Auth: bearer mcp_token (headless agents). mcp_tokens is a shared table
// (packages/db/src/mcp.ts) — a token created here or in the studio app's Settings works
// against either app's endpoint, since both resolve to the same account.
import { NextRequest, NextResponse } from "next/server";
import { adminClient, verifyMcpToken, isSupabaseConfigured } from "@cs/db";
import { TOOLS, callTool } from "./tools";

const PROTOCOL_VERSION = "2024-11-05";

function rpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}
function rpcError(id: unknown, code: number, message: string, status = 200) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) return rpcError(null, -32000, "server not configured", 500);

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const admin = adminClient();
  const userId = await verifyMcpToken(admin, token);
  if (!userId) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "unauthorized — provide a valid Bearer mcp token" } },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } }
    );
  }

  let msg: { id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    msg = await req.json();
  } catch {
    return rpcError(null, -32700, "parse error");
  }
  const { id, method, params } = msg;

  try {
    switch (method) {
      case "initialize":
        return rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "creator-studio-content", version: "0.1.0" },
        });
      case "notifications/initialized":
      case "notifications/cancelled":
        return new NextResponse(null, { status: 202 });
      case "ping":
        return rpcResult(id, {});
      case "tools/list":
        return rpcResult(id, { tools: TOOLS });
      case "tools/call": {
        const name = String(params?.name ?? "");
        const args = (params?.arguments as Record<string, unknown>) ?? {};
        try {
          const out = await callTool(admin, userId, name, args);
          return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(out) }] });
        } catch (e) {
          return rpcResult(id, { content: [{ type: "text", text: (e as Error).message }], isError: true });
        }
      }
      default:
        return rpcError(id, -32601, `method not found: ${method}`);
    }
  } catch (e) {
    return rpcError(id, -32603, (e as Error).message);
  }
}

export async function GET() {
  return NextResponse.json({
    name: "creator-studio-content", transport: "streamable-http",
    protocolVersion: PROTOCOL_VERSION, tools: TOOLS.map((t) => t.name),
  });
}
