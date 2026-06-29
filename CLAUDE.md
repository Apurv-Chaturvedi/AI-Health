# CLAUDE.md — Personalised Meal Planner by Apurv

## Project overview
- Personalized 7-day AI meal planner for adults
- Collects age, gender, height, weight, activity level, goal → calculates BMR & TDEE (Mifflin-St Jeor)
- User picks diet type (vegetarian/vegan/non-veg), meat exclusions, allergies, and 3 favorite cuisines
- Calls Claude API (Haiku 4.5) to generate a full 7-day meal plan with recipes, ingredients, instructions, and macros
- Users can download the plan as a PDF (jsPDF via CDN)
- Pure HTML/CSS/JS — single file: `index.html`
- No framework, no build step, no npm

## Live URL
- **https://mealplanner-ai.netlify.app**
- Hosted on Netlify, connected to GitHub for auto-deploy on push

## GitHub
- Repo: https://github.com/Apurv-Chaturvedi/AI-Health
- Branch: `main`
- Push to main → Netlify auto-deploys within ~30 seconds

## Deploy process
- Netlify is linked to GitHub repo (set up via app.netlify.com → Link to Git)
- Any `git push` to `main` triggers automatic redeploy
- Manual deploy via Netlify API (zip upload) also works for static files but does NOT process serverless functions

## Architecture
```
AI Health/
├── index.html                  # Entire frontend (HTML + CSS + JS inline)
├── netlify.toml                # Netlify config — functions dir, headers
├── _headers                    # Content-Type + X-Frame-Options for iframe embedding
├── netlify/
│   └── functions/
│       └── generate.js         # Serverless function — proxies Claude API call
└── CLAUDE.md
```

## Serverless function
- `netlify/functions/generate.mjs` — Netlify Functions v2 (ESM), streams Claude API response to client
- Anthropic API key stored as Netlify environment variable: `ANTHROPIC_API_KEY`
- Client calls `/.netlify/functions/generate` — never sees the key
- No npm dependencies — uses Node native fetch and Web Streams API (`TransformStream`, `ReadableStream`)
- Calls Anthropic with `stream: true` → reads SSE events → extracts `text_delta` chunks → pipes plain text to client
- Frontend accumulates chunks into a string, then parses as JSON at the end
- Streaming keeps the connection alive so Netlify's function timeout never fires

## API / AI
- Provider: **Anthropic Claude** (console.anthropic.com) — paid tier, $20 credits
- Model: `claude-haiku-4-5` (~$0.015 per meal plan request)
- Endpoint: `https://api.anthropic.com/v1/messages`
- Key stored in: Netlify env var `ANTHROPIC_API_KEY` (site: 6add3a7d-a920-4abd-ae5a-d0a9770738f3)
- Key format: `sk-ant-...`

## BMR / TDEE logic
- Formula: Mifflin-St Jeor
  - Male:   `(10 × kg) + (6.25 × cm) - (5 × age) + 5`
  - Female: `(10 × kg) + (6.25 × cm) - (5 × age) - 161`
  - Other:  `(10 × kg) + (6.25 × cm) - (5 × age) - 78`
- Activity multipliers: sedentary 1.2, light 1.375, moderate 1.55, very 1.725
- Goals:
  - Maintain: TDEE
  - Lose weight: TDEE − 300 cal (sustainable deficit, ~0.3 kg/week)
  - Build muscle: TDEE + 300 cal
- TDEE caveat shown on results: estimates vary ±200–300 cal

## App header
- Displays as: `🥗 Personalised Meal Planner by Apurv` (top-left, sticky)
- Tagline: `Personalized Meal Planner` (top-right, smaller text)

## 4-step UI flow
1. **Profile** — age, gender, height (ft/in or cm), weight (lbs or kg), activity level, goal
2. **Diet** — vegetarian / vegan / non-veg; meat exclusions; allergies
3. **Cuisines** — pick exactly 3 from 12 options
4. **Results** — loading state → 7-day plan with day tabs, macro summary, expandable meal cards, PDF download

## PDF download
- Uses jsPDF loaded via CDN (`https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js`)
- Generates multi-page A4 PDF client-side
- Includes: profile summary, all 7 days, per-day macros, all meals with ingredients + instructions
- Footer shows site URL and page numbers
- Triggered by "⬇ Download PDF" button on results page

## Embedding in Notion / Super
- Notion: type `/embed` → paste `https://mealplanner-ai.netlify.app`
- `_headers` file sets `X-Frame-Options: ALLOWALL` and `Content-Security-Policy: frame-ancestors *`
- `Content-Type: text/html` is also forced via `_headers` (required — Netlify zip deploys defaulted to text/plain)

## Netlify account details
- Account slug: `apurv-chaturvedi29`
- Site ID: `6add3a7d-a920-4abd-ae5a-d0a9770738f3`
- Personal access token: stored in chat history (regenerate at app.netlify.com → User settings → Applications)
- Local project linked to Netlify site via `npx netlify-cli link --id 6add3a7d-a920-4abd-ae5a-d0a9770738f3`
- Netlify CLI available via `npx netlify-cli` (no global install needed)
- To set env vars from terminal: `npx netlify-cli env:set KEY value`
- To redeploy from terminal: `npx netlify-cli deploy --prod --build false`

## Provider migration history
| Date | Provider | Model | Reason |
|------|----------|-------|--------|
| Launch | Gemini API | — | Free tier had 0 quota on this Google account — abandoned |
| Early | Groq | llama-3.3-70b-versatile | Free tier (14,400 req/day) hit limit quickly from testers |
| 2026-06-29 | **Anthropic Claude** | claude-haiku-4-5 | Switched to paid tier ($20 credits, ~$0.015/request) — no daily cap |

## Gotchas
- Gemini API (all `AQ.` format keys) had limit: 0 on free tier for this Google account — switched to Groq
- Groq free tier (14,400 req/day) was exhausted by early testers — switched to Claude paid tier
- Netlify zip deploy API does NOT process serverless functions — must use Git-connected deploy OR `npx netlify-cli deploy --prod`
- GitHub push protection blocks commits containing API keys — never hardcode keys in source
- jsPDF CDN must be loaded before the `<script>` block that calls `window.jspdf`
- Claude API response shape differs from Groq/OpenAI: text is at `data.content[0].text` not `data.choices[0].message.content`
- Netlify function timeout (even at 26s max) is not enough for a full 7-day plan — must use streaming to keep the connection alive
- Streaming requires Netlify Functions v2 (ESM, `export default`) — use `.mjs` extension, no package.json needed
- Frontend must read `res.body.getReader()` in a loop to accumulate streaming chunks before parsing JSON
- After adding a new Netlify env var, must trigger a redeploy for it to take effect (env vars don't auto-redeploy)
- `npx netlify-cli deploy --prod --build false` deploys files directly but may not always pick up `netlify.toml` config changes — prefer `git push` for config changes

## Code style
- Everything inline in `index.html` — `<style>` and `<script>` tags, no external files except jsPDF CDN
- No frameworks, no npm, no build step
- CSS custom properties for all colors/radii/shadows
- Validate all inputs before proceeding to next step; show inline error messages
- Round BMR/TDEE to whole numbers with `.toLocaleString()` for display
