````markdown
# NLWeb ↔ OpenAI AppSDK Integration Spec

This document describes how to plug **NLWeb `/ask`** into an **OpenAI AppSDK** app via an MCP server.  
You noted that your `/ask` output is already shaped like the AppSDK tool output. Great — the remaining work is:

- Provide a **UI widget resource** (`ui://...html`) that renders the structured results.
- Register an **MCP tool** that calls NLWeb `/ask`, handles streaming, and returns the **AppSDK tool shape** with `_meta["openai/outputTemplate"]`.
- Add a few **runtime & security** considerations (script injection, CSP, timeouts).
- Set up **local testing** (mock server or real endpoint).

Below is a concise spec you can drop into your repo.

---

## 1) Tool Contract (MCP → AppSDK)

**Tool name:** `nlweb_ask`  
**Purpose:** call NLWeb `/ask` and return visualization blocks (map, ranking, highlight, …) in AppSDK tool format.

**Input schema** (Zod style shown for reference):
- `query: string` (required)
- `site?: string`
- `mode?: "list" | "summarize" | "generate"`
- `prev?: string[]`
- `streaming?: boolean` (default `true`)

**Output format (AppSDK tool result)**:
- `content: Array<{ type: "text"; text: string }>`  
  - Short human-readable line, e.g., `Found N visualization(s) for "<query>"`
- `structuredContent: { query: string; results: NLWebBlock[] }`  
  - `NLWebBlock` is the NLWeb `result.content` object:
    - `@type?: string` (e.g., `"StatisticalResult"`)
    - `visualizationType?: string` (e.g., `"map" | "ranking" | "highlight"`)
    - `html: string` (web component markup like `<datacommons-map>` …)
    - `script?: string` (e.g., `<script src="https://datacommons.org/datacommons.js"></script>`)
    - `places?: string[]`
    - `variables?: string[]`
    - `embed_instructions?: string`

**Tool metadata:**
- `_meta["openai/outputTemplate"] = "ui://nlweb/widget.html"` (points to your widget)

**Notes:**
- You already return AppSDK-shaped output from `/ask`. Keep doing that. The MCP tool may simply **forward** it (or aggregate streaming chunks into that final shape).

---

## 2) Widget Resource (UI Template)

**Resource URI:** `ui://nlweb/widget.html`  
**Purpose:** render `structuredContent.results[]` with:
- Deduped `<script>` tags (e.g., `datacommons.js`)
- Inline `html` snippets (e.g., `<datacommons-map>`, `<datacommons-ranking>`)
- Optional chips for `places` / `variables`
- Optional display of `embed_instructions`

**Contract:**  
- App runtime injects `window.structuredContent` (the tool’s `structuredContent`)
- The widget must **not** crash if:
  - `results` is empty or missing
  - Individual blocks are missing fields (defensive checks)

**Minimal behavior:**
1. Read `window.structuredContent.results`.
2. For each block:
   - Insert `res.html` into the DOM.
   - If `res.script` is present and contains a `src`, inject it once per unique URL.
   - Optionally show chips for `places` and `variables`.
3. If no results, show a muted “No visualizations returned.” message.

---

## 3) MCP Server Registration

### 3.1 Resource
```ts
server.registerResource("html", "ui://nlweb/widget.html", {}, async () => ({
  contents: [
    {
      uri: "ui://nlweb/widget.html",
      mimeType: "text/html",
      text: componentHtml, // your template HTML
      _meta: {
        "openai/widgetDescription": "Renders NLWeb /ask visualization blocks.",
      },
    },
  ],
}));
````

### 3.2 Tool

```ts
server.registerTool(
  "nlweb_ask",
  {
    title: "nlweb_ask",
    description: "Query NLWeb /ask and return visualization blocks",
    inputSchema: {
      query: z.string(),
      site: z.string().optional(),
      mode: z.enum(["list","summarize","generate"]).optional(),
      prev: z.array(z.string()).optional(),
      streaming: z.boolean().optional(),
    },
    _meta: {
      "openai/outputTemplate": "ui://nlweb/widget.html",
    },
  },
  async ({ query, site, mode, prev, streaming = true }, _extra) => {
    // POST to NLWeb /ask with JSON body, handle streaming or non-streaming
    // Aggregate NLWeb result blocks into `results`
    // Return { content, structuredContent: { query, results } }
  }
);
```

**Config:**

* `NLWEB_BASE_URL` env var for endpoint (e.g., `https://<host>`).
* Default `streaming: true`; the tool should buffer results until end-of-stream, then return once.

---

## 4) Streaming & Parsing

If using NLWeb streaming (NDJSON):

* Accept `begin-nlweb-response`, collect each `result` (`result.content` → push into `results[]`), ignore `end…` beyond signaling completion.
* Be forgiving about blank lines/partial chunks.
* On errors mid-stream, return a structured error (see Error Handling).

**Non-streaming fallback:**

* If `streaming: false`, expect a single JSON with `results: NLWebBlock[]` or similar top-level shape. Normalize to the same `results[]`.

---

## 5) Security & CSP

* **Script injection:** You will inject third-party scripts (e.g., `https://datacommons.org/datacommons.js`) in the widget. Ensure:

  * CSP allows the origin (script-src allowlist or proxy).
  * Deduplicate by URL to avoid multiple loads.
* **HTML rendering:** You are inserting `res.html` (trusted NLWeb output). If you plan to handle arbitrary sources, sanitize or restrict origins.

---

## 6) Errors, Timeouts, Retries

* **HTTP errors:** If NLWeb `/ask` returns non-2xx, include status & tail of response text in the thrown error.
* **Timeouts:** Set a sensible deadline (e.g., 20–30s overall) for `/ask`. Abort & return a user-readable failure message in `content`.
* **Retries:** Optional; for idempotent queries consider 1 retry on transient network errors.
* **Partial results:** If the stream breaks after some `result`s, still render what you have and include a short warning in `content`.

Example user-facing content on failure:

* `"I hit an error fetching visualizations. Showing 2 of 3 blocks that arrived before the error."`

---

## 7) Observability

* **Log**: request payload (minus PII), response status, timing, number of `result` blocks.
* **Feature flags**: toggle streaming vs. non-streaming path.
* **Tracing**: include a correlation ID per `/ask` call (surface it in `structuredContent` if helpful).

---

## 8) Optional Enhancements

* **UI polish:** chips, captions per `visualizationType`, collapsible raw JSON panel for debugging.
* **Provenance UI:** clickable `sources` (if present) and short descriptions.
* **Schema validation:** Zod/JSON Schema for `NLWebBlock` to fail fast on malformed results.
* **Caching:** keyed by `(query, site, mode)` with TTL to reduce load.
* **Rate limiting:** polite concurrency on the MCP tool to avoid overloading NLWeb.
* **Versioning:** include an adapter `version` in `structuredContent` to ease future changes.
* **Streaming UI:** Consider progressive rendering (e.g., incremental cards) if AppSDK adds chunked output support.
* **Mock / integration harnesses:** See `docs/nlweb-appsdk-adapter.md` for detailed instructions on the CLI harness, widget harness, and mock MCP server.

---

## 9) Checklist — “What else is needed?”

Since your `/ask` already returns AppSDK-shaped output, ensure you also have:

* [ ] **Widget resource** `ui://nlweb/widget.html` that renders `structuredContent.results[]`
* [ ] **Tool registration** with `_meta["openai/outputTemplate"]` pointing at the widget
* [ ] **Streaming handler** (NDJSON collector) OR non-streaming path support
* [ ] **Script dedupe** in the widget (load `datacommons.js` once)
* [ ] **CSP allowance** for `https://datacommons.org` (or a proxy)
* [ ] **Timeouts & errors** with user-friendly `content` messages
* [ ] **Env config** for `NLWEB_BASE_URL`
* [ ] **Smoke tests** (mock server + widget dev harness + E2E run)

With those pieces in place, the integration is production-ready.
