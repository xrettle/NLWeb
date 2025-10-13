import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fetch from "node-fetch";

// Configuration
const NLWEB_BASE_URL = process.env.NLWEB_BASE_URL || "https://nlwappsdk.azurewebsites.net";
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || "30000", 10);

// Widget configuration (following pizzaz pattern)
type NLWebWidget = {
  id: string;
  title: string;
  templateUri: string;
  invoking: string;
  invoked: string;
  html: string;
};

function widgetMeta(widget: NLWebWidget) {
  return {
    "openai/outputTemplate": widget.templateUri,
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true
  } as const;
}

const nlwebWidget: NLWebWidget = {
  id: "nlweb-list",
  title: "NLWeb Results",
  templateUri: "ui://widget/nlweb-list.html",
  invoking: "Searching NLWeb",
  invoked: "Found results",
  html: `
<div id="nlweb-list-root"></div>
<link rel="stylesheet" href="http://localhost:4444/nlweb-list-2d2b.css">
<script type="module" src="http://localhost:4444/nlweb-list-2d2b.js"></script>
  `.trim(),
    responseText: "Rendered a NLWeb result list!"
};

// Input schema for nlweb_ask tool (following pizzaz pattern)
const NLWebAskInputSchema = z.object({
  query: z.string().describe("The question or search query"),
  site: z.string().optional().describe("Optional site to search"),
  mode: z.enum(["list", "summarize", "generate"]).optional().describe("The type of response to generate"),
  prev: z.array(z.string()).optional().describe("Previous conversation context"),
});

type NLWebAskInput = z.infer<typeof NLWebAskInputSchema>;

interface NLWebBlock {
  "@type"?: string;
  visualizationType?: string;
  html?: string;
  script?: string;
  places?: string[];
  variables?: string[];
  embed_instructions?: string;
  [key: string]: any;
}

interface NLWebResponse {
  structuredContent: {
    query?: string;
    results: NLWebBlock[];
    messages?: any[];
    metadata?: any;
    conversationId?: string;
    generatedAnswers?: any[];
    legacyResponse?: any;
  };
  content: Array<{ type: string; text: string }>;
}

// Call NLWeb /ask endpoint
async function callNLWebAsk(params: NLWebAskInput): Promise<NLWebResponse> {
  // Build query parameters for GET request
  const queryParams = new URLSearchParams({
    query: params.query,
    streaming: "false",
  });
  
  if (params.site) {
    queryParams.set("site", params.site);
  }
  if (params.mode) {
    queryParams.set("mode", params.mode);
  }
  
  const url = `${NLWEB_BASE_URL}/ask?${queryParams.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `NLWeb API error: ${response.status} - ${errorText.substring(0, 200)}`
      );
    }

    const data = await response.json() as NLWebResponse;
    
    // Validate response structure
    if (!data.structuredContent || !data.content) {
      throw new Error("Invalid response format from NLWeb adapter");
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${REQUEST_TIMEOUT}ms`);
      }
      throw error;
    }
    throw new Error("Unknown error occurred while calling NLWeb");
  }
}

// Create and configure the MCP server
function createNLWebServer(): Server {
  const server = new Server(
    {
      name: "nlweb-mcp-server",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Register the UI widget resource (following pizzaz pattern)
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: nlwebWidget.templateUri,
          mimeType: "text/html+skybridge",
          name: nlwebWidget.title,
          description: `${nlwebWidget.title} widget markup - renders NLWeb visualization blocks`,
          _meta: widgetMeta(nlwebWidget),
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri === nlwebWidget.templateUri) {
      return {
        contents: [
          {
            uri: nlwebWidget.templateUri,
            mimeType: "text/html+skybridge",
            text: nlwebWidget.html,
            _meta: widgetMeta(nlwebWidget),
          },
        ],
      };
    }
    throw new Error(`Resource not found: ${request.params.uri}`);
  });

  // Register the nlweb tool (following pizzaz pattern)
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: nlwebWidget.id,
          title: nlwebWidget.title,
          description: 
            "Query NLWeb to search and analyze information from configured data sources. " +
            "Returns structured visualization blocks (maps, rankings, highlights) from Schema.org-marked websites.",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The question or search query",
              },
              site: {
                type: "string",
                description: "Optional site to search (e.g., 'datacommons.org')",
              },
              mode: {
                type: "string",
                enum: ["list", "summarize", "generate"],
                description: "Response generation mode",
                default: "list",
              },
              prev: {
                type: "array",
                items: { type: "string" },
                description: "Previous conversation turns for context",
              },
            },
            required: ["query"],
          },
          _meta: widgetMeta(nlwebWidget),
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === nlwebWidget.id) {
      try {
        const params = NLWebAskInputSchema.parse(request.params.arguments);
        const response = await callNLWebAsk(params);

        // Create embedded widget resource (following pizzaz pattern)
        const widgetResource = {
          type: "resource" as const,
          resource: {
            uri: nlwebWidget.templateUri,
            mimeType: "text/html+skybridge",
            text: nlwebWidget.html,
          },
        };

        // Return AppSDK-compatible response with all required metadata
        return {
          content: response.content,
          structuredContent: response.structuredContent,
          _meta: {
            "openai.com/widget": widgetResource,
            ...widgetMeta(nlwebWidget),
          },
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new Error(`Invalid input parameters: ${error.message}`);
        }
        
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        
        // Return error in AppSDK format
        return {
          content: [
            {
              type: "text",
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
    
    throw new Error(`Unknown tool: ${request.params.name}`);
  });

  return server;
}

type SessionRecord = {
  server: Server;
  transport: SSEServerTransport;
};

const sessions = new Map<string, SessionRecord>();

const ssePath = "/mcp";
const postPath = "/mcp/messages";

async function handleSseRequest(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const server = createNLWebServer();
  const transport = new SSEServerTransport(postPath, res);
  const sessionId = transport.sessionId;

  sessions.set(sessionId, { server, transport });

  transport.onclose = async () => {
    sessions.delete(sessionId);
    await server.close();
  };

  transport.onerror = (error) => {
    console.error("SSE transport error", error);
  };

  try {
    await server.connect(transport);
  } catch (error) {
    sessions.delete(sessionId);
    console.error("Failed to start SSE session", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to establish SSE connection");
    }
  }
}

async function handlePostMessage(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    res.writeHead(400).end("Missing sessionId query parameter");
    return;
  }

  const session = sessions.get(sessionId);

  if (!session) {
    res.writeHead(404).end("Unknown session");
    return;
  }

  try {
    await session.transport.handlePostMessage(req, res);
  } catch (error) {
    console.error("Failed to process message", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to process message");
    }
  }
}

const portEnv = Number(process.env.PORT ?? 8000);
const port = Number.isFinite(portEnv) ? portEnv : 8000;

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS" && (url.pathname === ssePath || url.pathname === postPath)) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type"
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === ssePath) {
    await handleSseRequest(res);
    return;
  }

  if (req.method === "POST" && url.pathname === postPath) {
    await handlePostMessage(req, res, url);
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.on("clientError", (err: Error, socket) => {
  console.error("HTTP client error", err);
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

httpServer.listen(port, () => {
  console.log(`NLWeb MCP server listening on http://localhost:${port}`);
  console.log(`  NLWEB_BASE_URL: ${NLWEB_BASE_URL}`);
  console.log(`  REQUEST_TIMEOUT: ${REQUEST_TIMEOUT}ms`);
  console.log(`  SSE stream: GET http://localhost:${port}${ssePath}`);
  console.log(`  Message post endpoint: POST http://localhost:${port}${postPath}?sessionId=...`);
});
