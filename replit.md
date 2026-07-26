# Gustafta PKB Assistant

An AI-powered assistant for Indonesian construction workers (Tenaga Kerja Konstruksi) to compile their Continuing Professional Development (PKB) portfolios and map experience to SKK competency units.

## Stack

- **Frontend**: React + Vite + Tailwind v4 + Wouter (`artifacts/gustafta-pkb`)
- **Backend**: Express + TypeScript (`artifacts/api-server`)
- **Database**: PostgreSQL via Drizzle ORM (`lib/db`)
- **Auth**: Replit-managed Clerk (`@clerk/express` on server, `@clerk/react` on client)
- **LLM**: Multi-provider via OpenAI SDK — OpenAI, DeepSeek, Qwen, Gemini
- **Package manager**: pnpm workspace

## Running the app

Three workflows start automatically:

| Workflow | Command |
|---|---|
| `artifacts/gustafta-pkb: web` | `pnpm --filter @workspace/gustafta-pkb run dev` |
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` |
| `artifacts/mockup-sandbox: Component Preview Server` | `pnpm --filter @workspace/mockup-sandbox run dev` |

## Required secrets

| Secret | Purpose | Required? |
|---|---|---|
| `CLERK_SECRET_KEY` | Clerk server auth | ✅ Auto-provisioned |
| `CLERK_PUBLISHABLE_KEY` | Clerk server auth | ✅ Auto-provisioned |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk client auth | ✅ Auto-provisioned |
| `OPENAI_API_KEY` | OpenAI GPT-4o models | At least one LLM key required |
| `DEEPSEEK_API_KEY` | DeepSeek Chat/Reasoner | Optional |
| `DASHSCOPE_API_KEY` | Qwen models (intl) | Optional |
| `GEMINI_API_KEY` | Gemini 2.5 Flash/Pro | Optional |
| `SESSION_SECRET` | Express session | ✅ Already set |
| `SCALEV_WEBHOOK_SECRET` | Scalev payment webhooks | Optional |

## Key features

- **Gustafta AI interviewer**: Dialog-based extraction of work experience from videos and project descriptions
- **SKK competency mapping**: Maps evidence to SKK (Standar Kompetensi Konstruksi) units per Permen PUPR 12/2021
- **Executive Summary PKB**: Generates 10–15 page portfolio summaries worth up to 25 SKPK
- **Knowledge base**: Stores and retrieves domain documents
- **Project brain**: Analyzes project experience for competency evidence
- **Competency studio**: Manages and exports competency portfolios
- **Freemium/Pro**: Scalev-based subscription (30-day Pro plan)

## Database schema

Managed with Drizzle. Push schema changes with:
```bash
pnpm --filter @workspace/db run push
```

## User preferences
