Here’s the full explanation rewritten in **Markdown** format for easier reading and integration into documentation or a README:

---

# 🧩 Integrating **NLWeb** `/ask` with **OpenAI AppSDK**

This guide explains how NLWeb’s streamed `/ask` responses can be made compatible with OpenAI’s **AppSDK** tool and UI resource system.

---

## 🧠 Conceptual Mapping

| NLWeb Component                                    | AppSDK Equivalent                 | Purpose                                             |
| -------------------------------------------------- | --------------------------------- | --------------------------------------------------- |
| `/ask` endpoint                                    | `server.registerTool()`           | Handles a query and returns structured results      |
| Streamed `result` messages                         | `structuredContent.results[]`     | Each block (map, chart, highlight) becomes one item |
| `begin-nlweb-response` / `end-nlweb-response`      | — (internal to adapter)           | Mark start/end of the stream                        |
| HTML components (`<datacommons-map>`, etc.)        | `ui://widget/nlweb.html`          | Rendered via AppSDK HTML widget                     |
| `script` field (`datacommons.js`)                  | `<script>` in widget              | Inject required libraries                           |
| Schema.org fields (`@type`, `variables`, `places`) | kept as-is in `structuredContent` | Maintains semantic meaning                          |

---

## ⚙️ AppSDK UI Resource Example

```ts
server.registerResource(
  "html",
  "ui://widget/nlweb.html",
  {},
  async () => ({
    contents: [
      {
        uri: "ui://widget/nlweb.html",
        mimeType: "text/html",
        text: componentHtml,
        _meta: {
          "openai/widgetDescription":
            "Renders NLWeb visualization blocks (map/ranking/highlight) returned by nlweb_ask.",
        },
      },
    ],
  })
);
```

### Example `componentHtml`

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: ui-sans-serif, system-ui; margin: 0; padding: 16px; }
      .block { margin-bottom: 24px; }
      .header { font-weight: 600; margin-bottom: 8px; }
      .code { font-family: monospace; font-size: 12px; background: #f6f6f6; padding: 6px 8px; border-radius: 6px; }
      .muted { color: #666; font-size: 12px; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>
      (function () {
        const data = window.structuredContent || {};
        const root = document.getElementById("root");
        const results = Array.isArray(data.results) ? data.results : [];
        if (!results.length) {
          root.innerHTML = "<div class='muted'>No visualizations returned.</div>";
          return;
        }
        const addedScripts = new Set();
        results.forEach((res, idx) => {
          const wrap = document.createElement("div");
          wrap.className = "block";
          const h = document.createElement("div");
          h.className = "header";
          h.textContent = (res.visualizationType || res["@type"] || "Visualization") + " #" + (idx + 1);
          wrap.appendChild(h);
          const slot = document.createElement("div");
          slot.innerHTML = res.html || "";
          wrap.appendChild(slot);
          if (res.script) {
            const match = res.script.match(/<script[^>]*src=["']([^"']+)["']/i);
            const src = match && match[1];
            if (src && !addedScripts.has(src)) {
              const s = document.createElement("script");
              s.src = src;
              document.head.appendChild(s);
              addedScripts.add(src);
            }
          }
          if (res.embed_instructions) {
            const instr = document.createElement("div");
            instr.className = "muted";
            instr.innerHTML = `Embed hint: <span class="code">${res.embed_instructions}</span>`;
            wrap.appendChild(instr);
          }
          root.appendChild(wrap);
        });
      })();
    </script>
  </body>
</html>
```

---

## 🧩 Registering the Tool

```ts
import { z } from "zod";

server.registerTool(
  "nlweb_ask",
  {
    title: "nlweb_ask",
    description: "Query NLWeb and return visualization blocks",
    inputSchema: {
      query: z.string(),
      site: z.string().optional(),
      mode: z.enum(["list", "summarize", "generate"]).optional(),
    },
    _meta: {
      "openai/outputTemplate": "ui://widget/nlweb.html",
    },
  },
  async ({ query, site, mode }, _extra) => {
    // Adapt streamed NLWeb results
    const results = [];
    // Example parsed from NLWeb stream
    results.push(
      {
        "@type": "StatisticalResult",
        visualizationType: "ranking",
        html: "<datacommons-ranking header='Counties in California Ranked by Diabetes Rate' parentPlace='geoId/06' childPlaceType='County' variable='Percent_Person_WithDiabetes'></datacommons-ranking>",
        script: "<script src='https://datacommons.org/datacommons.js'></script>",
        embed_instructions: "Include the script tag and HTML component in your page."
      },
      {
        "@type": "StatisticalResult",
        visualizationType: "map",
        html: "<datacommons-map header='Diabetes Rate Across Counties in California' parentPlace='geoId/06' childPlaceType='County' variable='Percent_Person_WithDiabetes'></datacommons-map>",
        script: "<script src='https://datacommons.org/datacommons.js'></script>"
      },
      {
        "@type": "StatisticalResult",
        visualizationType: "highlight",
        html: "<datacommons-highlight header='Diabetes Rates by County in California' place='geoId/06' variable='Percent_Person_WithDiabetes'></datacommons-highlight>",
        script: "<script src='https://datacommons.org/datacommons.js'></script>"
      }
    );

    return {
      content: [
        { type: "text", text: `Found ${results.length} visualization(s) for "${query}".` }
      ],
      structuredContent: { query, results },
    };
  }
);
```

---

## 🔄 Data Flow Overview

```plaintext
User query → AppSDK Tool → NLWeb `/ask` → streamed JSONL (result blocks)
→ Adapter collects `content` objects → returns structuredContent to App
→ Widget renders DataCommons <datacommons-*> components
```

---

## ✅ Summary

| Feature           | NLWeb                                                       | AppSDK                                    |
| ----------------- | ----------------------------------------------------------- | ----------------------------------------- |
| Communication     | HTTP POST + streaming NDJSON                                | Local tool call returning structured JSON |
| Response          | Multiple `result` events (HTML, script)                     | Single `{ structuredContent, content }`   |
| Visualization     | `<datacommons-*>` web components                            | HTML widget (`ui://widget/nlweb.html`)    |
| Metadata          | `@type`, `visualizationType`, etc.                          | Preserved in `structuredContent`          |
| Compatibility Fix | Aggregate `result`s → wrap as `structuredContent.results[]` | ✅                                         |

---

## 🧭 Key Takeaway

> The integration is essentially a **wrapper**:
>
> * Collect NLWeb’s `result` events
> * Return them as `structuredContent.results`
> * Render via an AppSDK HTML widget

This makes NLWeb’s visual, schema-rich responses **natively displayable** inside OpenAI AppSDK environments — preserving both **semantic structure** and **interactive visualizations**.
