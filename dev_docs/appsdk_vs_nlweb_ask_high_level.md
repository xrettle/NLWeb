Here’s the full write-up in clean **Markdown format**, ready for documentation or GitHub comparison notes:

---

# 🧩 Integrating NLWeb `/ask` with OpenAI AppSDK

## Overview

This guide explains how NLWeb’s `/ask` endpoint can interoperate with OpenAI’s **AppSDK**, focusing on **input/output format compatibility** and the minimal transformations needed for smooth integration.

---

## 1. Input Format Compatibility

Both **NLWeb** and **AppSDK** use JSON as their primary data format.
NLWeb’s `/ask` expects the following structure:

```json
POST /ask
Content-Type: application/json
{
  "query": "What does the AI policy cover?",
  "prev": ["previous user turns..."],   // optional
  "site": "example.com",                // optional
  "mode": "summarize"                   // optional
}
```

**AppSDK tools** define a JSON schema for inputs in a similar way.
You can directly map NLWeb’s fields to AppSDK parameters:

| NLWeb field | AppSDK field | Notes                                       |
| ----------- | ------------ | ------------------------------------------- |
| `query`     | `query`      | User’s question (string)                    |
| `prev`      | `prev`       | Array of past turns                         |
| `site`      | `site`       | Optional scoping parameter                  |
| `mode`      | `mode`       | Enum: `"list"`, `"summarize"`, `"generate"` |

Because both use JSON objects with simple string and list fields, **input compatibility is nearly 1:1** — only schema declaration is needed.

---

## 2. Output Format Differences

### NLWeb `/ask` Output

NLWeb returns a **Schema.org-structured JSON-LD** response:

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "answer": "Our AI policy covers data privacy and transparency.",
  "sources": [
    { "name": "AI Policy Page", "url": "https://example.com/policy", "score": 0.95 },
    { "name": "Governance FAQ", "url": "https://example.com/faq", "score": 0.89 }
  ],
  "query_id": "12345-abcde"
}
```

### OpenAI AppSDK Tool Output

AppSDK tools must return an object with these keys:

```json
{
  "structuredContent": { /* machine-readable data */ },
  "content": [ { "type": "text", "text": "Human-readable message" } ]
}
```

| Field               | Description                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| `structuredContent` | JSON payload for structured data (anything you want to pass to the app)     |
| `content`           | Array of message segments (text, images, etc.) for the conversational model |

---

## 3. Key Structural Differences

| Aspect                 | NLWeb                    | AppSDK                            |
| ---------------------- | ------------------------ | --------------------------------- |
| **Answer text**        | `answer` field           | `content` array                   |
| **Supporting data**    | `sources`, `query_id`    | `structuredContent`               |
| **Schema.org context** | Uses `@context`, `@type` | Not required (optional to keep)   |
| **Response wrapping**  | Raw JSON-LD              | Wrapped under `structuredContent` |
| **Streaming**          | Supports chunked output  | Single complete JSON response     |

---

## 4. Adapter Transformation

To make NLWeb `/ask` output compatible with AppSDK, wrap it:

```js
function adaptNLWebToAppSDK(nlwebResponse) {
  return {
    structuredContent: nlwebResponse,
    content: [
      { type: "text", text: nlwebResponse.answer }
    ]
  };
}
```

**Example:**

```json
{
  "structuredContent": {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "answer": "Our AI policy covers data privacy and transparency.",
    "sources": [
      { "name": "AI Policy Page", "url": "https://example.com/policy", "score": 0.95 }
    ],
    "query_id": "12345-abcde"
  },
  "content": [
    { "type": "text", "text": "Our AI policy covers data privacy and transparency." }
  ]
}
```

This makes the AppSDK assistant show the answer text naturally, while structured data remains accessible in `structuredContent`.

---

## 5. Optional Enhancements

### ✅ Output Schema

Define an explicit schema for clarity:

```json
"outputSchema": {
  "type": "object",
  "properties": {
    "structuredContent": {
      "type": "object",
      "properties": {
        "answer": { "type": "string" },
        "sources": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "url": { "type": "string" },
              "score": { "type": "number" }
            }
          }
        },
        "query_id": { "type": "string" }
      }
    },
    "content": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": { "type": "string" },
          "text": { "type": "string" }
        }
      }
    }
  }
}
```

### 🧱 Custom Rendering

If you want to render answer cards with citations, you can define a custom component via `_meta["openai/outputTemplate"]` referencing fields in `structuredContent`.

---

## 6. Similarities That Help

Both ecosystems share a **structured + narrative duality**:

| Concept                    | NLWeb                           | AppSDK                   |
| -------------------------- | ------------------------------- | ------------------------ |
| **Machine-readable data**  | JSON-LD (`@context`, `sources`) | `structuredContent`      |
| **Human-readable message** | `answer` text                   | `content` array          |
| **Extensibility**          | Add schema types freely         | Define arbitrary schemas |

This conceptual alignment means integration is **frictionless and future-proof**.

---

## 7. Summary

| Category            | NLWeb `/ask`                   | OpenAI AppSDK                    | Compatibility Action        |
| ------------------- | ------------------------------ | -------------------------------- | --------------------------- |
| **Input**           | JSON (`query`, `mode`, `prev`) | JSON schema-defined              | Direct mapping              |
| **Output**          | JSON-LD (`answer`, `sources`)  | `{ structuredContent, content }` | Wrap and extract `answer`   |
| **Answer delivery** | `answer` text inline           | `content` array                  | Move to `content`           |
| **Schema**          | Schema.org (`@type`)           | Arbitrary JSON schema            | Optional retention          |
| **Streaming**       | Optional chunks                | Single result                    | Disable streaming or buffer |
| **UI**              | Returns HTML or JSON           | App templates/UI binding         | Compatible via `_meta`      |

---

### ✅ In short:

> NLWeb’s `/ask` → wrapped under `structuredContent`,
> NLWeb’s `answer` → becomes `content.text`.

After this small transformation, the endpoint becomes **fully compatible** with OpenAI’s AppSDK applications.

---

Would you like me to include an **example AppSDK tool descriptor JSON** that directly integrates the `/ask` endpoint (with input/output schemas and a `fetch()` call)?
