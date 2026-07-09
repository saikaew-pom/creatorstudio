// MCP server endpoint (doc 04 §10) — JSON-RPC 2.0 over HTTP (MCP Streamable HTTP
// transport, non-streaming responses since all tools are quick req/resp). Auth: bearer
// mcp_token (headless agents). OAuth for Claude-desktop clients is a follow-up.
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

  // Bearer token → user.
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
          serverInfo: { name: "creator-studio", version: "0.1.0" },
        });
      case "notifications/initialized":
      case "notifications/cancelled":
        return new NextResponse(null, { status: 202 }); // notifications get no result
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
          // Tool errors are reported as an isError tool result, not a protocol error.
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

// A GET returns basic discovery info (some clients probe this).
export async function GET() {
  return NextResponse.json({
    name: "creator-studio", transport: "streamable-http",
    protocolVersion: PROTOCOL_VERSION, tools: TOOLS.map((t) => t.name),
  });
}
