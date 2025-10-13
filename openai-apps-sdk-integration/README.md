# NLWeb Apps SDK Integration

[![MIT License](https://img.shields.io/ba```bash
cd nlweb_server_node

# Start MCP Server
npm start

# Run test suite
npm run test
```

**Documentation:**
- [nlweb_server_node/README.md](nlweb_server_node/README.md) - Detailed usage instructions
- [nlweb_server_node/DEPLOYMENT.md](nlweb_server_node/DEPLOYMENT.md) - Production deployment guidegreen.svg)](LICENSE)

This repository contains the NLWeb MCP (Model Context Protocol) server with rich UI widgets for ChatGPT integration.

## MCP + Apps SDK overview

The Model Context Protocol (MCP) is an open specification for connecting large language model clients to external tools, data, and user interfaces. An MCP server exposes tools that a model can call during a conversation and returns results according to the tool contracts. Those results can include extra metadata—such as inline HTML—that the Apps SDK uses to render rich UI components (widgets) alongside assistant messages.

Within the Apps SDK, MCP keeps the server, model, and UI in sync. By standardizing the wire format, authentication, and metadata, it lets ChatGPT reason about your connector the same way it reasons about built-in tools. A minimal MCP integration for Apps SDK implements three capabilities:

1. **List tools** – Your server advertises the tools it supports, including their JSON Schema input/output contracts and optional annotations (for example, `readOnlyHint`).
2. **Call tools** – When a model selects a tool, it issues a `call_tool` request with arguments that match the user intent. Your server executes the action and returns structured content the model can parse.
3. **Return widgets** – Alongside structured content, return embedded resources in the response metadata so the Apps SDK can render the interface inline in the Apps SDK client (ChatGPT).

Because the protocol is transport agnostic, you can host the server over Server-Sent Events or streaming HTTP—Apps SDK supports both.

The MCP servers in this demo highlight how each tool can light up widgets by combining structured payloads with `_meta.openai/outputTemplate` metadata returned from the MCP servers.

## Repository structure

- `src/nlweb-list/` – NLWeb results list widget source code
- `assets/` – Generated HTML, JS, and CSS bundles after running the build step
- `nlweb_server_node/` – MCP server implemented with the official TypeScript SDK
- `build-all.mts` – Vite build orchestrator that produces hashed bundles for the widget

## Prerequisites

- Node.js 18+
- npm or pnpm
- Running NLWeb backend (default: https://nlwappsdk.azurewebsites.net)

## Install dependencies

Install the workspace dependencies:

```bash
npm install
# or
pnpm install
```

## Build the widget

The NLWeb list widget is bundled into standalone assets that the MCP server references.

```bash
npm run build
```

This produces versioned `.html`, `.js`, and `.css` files inside `assets/` (e.g., `nlweb-list-2d2b.js`).

To iterate locally, launch the Vite dev server:

```bash
npm run dev
```

## Serve the widget assets

After building, serve the static assets for local development:

```bash
npm run serve
```

The assets are exposed at [`http://localhost:4444`](http://localhost:4444) with CORS enabled.

## Run the NLWeb MCP Server

### NLWeb Node server

```bash
cd nlweb_server_node

# For MCP Server
npm start

# Run test suite
npm run test
```

See [nlweb_server_node/README.md](nlweb_server_node/README.md) for detailed usage instructions and [nlweb_server_node/DEPLOYMENT.md](nlweb_server_node/DEPLOYMENT.md) for production deployment guide.

## Testing in ChatGPT

To add these apps to ChatGPT, enable [developer mode](https://platform.openai.com/docs/guides/developer-mode), and add your apps in Settings > Connectors.

To add your local server without deploying it, you can use a tool like [ngrok](https://ngrok.com/) to expose your local server to the internet.

### Quick Start with Local Server

**Terminal 1 - Serve widget assets:**
```bash
npm run serve  # Serves at http://localhost:4444
```

**Terminal 2 - Start MCP server:**
```bash
cd nlweb_server_node
npm start  # Runs on port 8000
```

**Terminal 3 - Expose with ngrok:**
```bash
ngrok http 8000
```

You will get a public URL that you can use to add your local server to ChatGPT in Settings > Connectors.

For example: `https://<custom_endpoint>.ngrok-free.app/mcp`

For production deployment, see [nlweb_server_node/DEPLOYMENT.md](nlweb_server_node/DEPLOYMENT.md).

## Development

### Customize the Widget

Edit `src/nlweb-list/index.jsx` to modify how results are displayed. After changes:

1. Rebuild: `npm run build`
2. Note the new hash in the filename (e.g., `nlweb-list-xxxx.js`)
3. Update the hash in `nlweb_server_node/src/server.ts`
4. Restart the server

### Modify the Server

Edit `nlweb_server_node/src/server.ts` to:
- Change the NLWeb backend URL (`NLWEB_BASE_URL`)
- Customize tool parameters
- Add additional tools or widgets

## Environment Variables

- `NLWEB_BASE_URL` - NLWeb backend API URL (default: `https://nlwappsdk.azurewebsites.net`)
- `REQUEST_TIMEOUT` - Timeout for NLWeb requests in ms (default: `30000`)
- `PORT` - Server port for HTTP mode (default: `8000`)

## Contributing

You are welcome to open issues or submit PRs to improve this app, however, please note that we may not review all suggestions.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
