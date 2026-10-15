# SEVERIN Civic Web Explorer (Frontend)

Interactive 3-column parliamentary document studio and extraction explorer built for **Hack Apertus 2026 (Track 2A)**.

## 🏛️ Features

- **Source Selector Panel**: Curated offline picker of 27 nationwide Swiss sample PDFs covering all 26 cantons plus Confederation (`CHE`), paired with live search across OpenParlData bodies and affairs.
- **Document Studio Panel**: Side-by-side binary PDF viewer with inline page navigation, verbatim text inspection, provenance character highlight marks, and native cantonal web portal notice cards (`Not a PDF Document`).
- **Extraction Studio Panel**: Real-time extraction triggers for `swiss-ai/Apertus-v1.5-8B` on CSCS Alps GH200, rendering structured affair cards, authors, questions/answers, and green verifiable citation badges.
- **Persistent CSCS Telemetry**: Cumulative tracking of prompt/completion tokens, GPU PagedAttention cache hits, and micro-CHF expenditure counters.

## 🛠️ Tech Stack

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite
- **Styling**: Vanilla CSS3 design system with CSS custom properties (`variables.css`)
- **Typography**: Inter & JetBrains Mono

## 💻 Local Development

```bash
# Install dependencies
npm install

# Start Vite HMR dev server (proxies API requests to FastAPI on port 8000)
npm run dev

# Compile production bundle for Docker distribution
npm run build
```
