# Gustafta PKB Assistant

AI chatbot berbasis "Pak Budi" yang memandu Tenaga Kerja Konstruksi (TKK) membuat dokumen Executive Summary (Exum) PKB berkualitas tinggi (25 SKPK, setara 10–15 halaman A4) sesuai Permen PUPR No. 12/2021 dan SK Dirjen Bina Konstruksi No. 114/2024.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — jalankan API server (port 8080)
- `pnpm --filter @workspace/gustafta-pkb run dev` — jalankan frontend (port dari env PORT)
- `pnpm run typecheck` — typecheck penuh semua packages
- `pnpm run build` — typecheck + build semua packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks dari OpenAPI spec
- `pnpm --filter @workspace/db run push` — push perubahan DB schema (dev only)
- Required env: `DATABASE_URL`, `OPENAI_API_KEY`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui patterns
- API: Express 5 + SSE streaming untuk chat
- DB: PostgreSQL + Drizzle ORM
- AI: GPT-4o via OpenAI (`gpt-4o`, streaming untuk chat, non-streaming untuk Exum)
- Validation: Zod (`zod/v4`), `drizzle-zod`

## Where things live

- `artifacts/gustafta-pkb/src/pages/chat.tsx` — halaman chat utama (~1500 baris, semua logika chat/evidence/exum)
- `artifacts/gustafta-pkb/src/pages/home.tsx` — sidebar + form buat sesi baru
- `artifacts/gustafta-pkb/src/lib/api.ts` — semua API calls (REST + SSE)
- `artifacts/api-server/src/routes/chat/index.ts` — semua routes chat, streaming, evidence, generate Exum
- `artifacts/api-server/src/lib/pkb-system-prompt.ts` — Pak Budi persona + fase instructions + evidence context builder
- `artifacts/api-server/src/routes/skk.ts` — SKK unit lookup per jabker
- `artifacts/api-server/src/lib/skk-data.ts` — data SKK lengkap SK DJBK 114/2024
- `lib/db/src/schema/conversations.ts` — DB schema (conversations, messages, evidenceItems)

## Architecture decisions

- **SSE streaming** untuk streaming respon Pak Budi agar terasa real-time; SSE dipilih karena lebih sederhana dari WebSocket untuk one-way stream
- **`[[FASE_NAIK]]` marker** disisipkan GPT di akhir respons untuk sinyal auto-advance fase; di-strip sebelum disimpan/ditampilkan
- **Dual `buildEvidenceContext`**: versi ringkas di `pkb-system-prompt.ts` (untuk streaming chat — hemat token), versi lengkap di `chat/index.ts` (untuk generate Exum — perlu detail penuh dialog sokratik)
- **Auto-greeting**: sesi baru auto-send "Halo Pak Budi, saya siap memulai." agar Pak Budi langsung memperkenalkan diri tanpa user perlu tahu harus ketik apa
- **Hybrid Exum structure**: mode "Hybrid" punya template 9-bagian yang menggabungkan pengalaman kerja + hasil belajar, berbeda dari mode A/B

## Product

- **Trilogi Gustafta**: metodologi wawancara tiga-tahap (Serpihan → Dialog Sokratik → Sintesis)
- **6 fase wawancara**: profiling → context → core_interview → evidence → synthesis → done
- **Serpihan bukti PKB**: TKK menginput YouTube/webinar/diklatkerja atau pengalaman kerja; setiap serpihan melewati wizard 4-pertanyaan Dialog Sokratik
- **Gap Analisis SKK**: mencocokkan unit SKK yang sudah ada buktinya vs. yang masih kosong per jabker
- **Generate Exum**: GPT-4o menulis Exum 2500–4000 kata berdasarkan transkrip + serpihan + dialog sokratik
- **Export**: Print PDF (popup), Word (.html), Markdown (.md), Salin ke clipboard
- **Inline rename sesi**: klik judul header chat → edit langsung → Enter/blur untuk simpan

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **Jangan restart kedua workflow sekaligus** — restart api-server saja setelah backend changes; vite HMR handle frontend otomatis
- **Typecheck sebelum commit**: `pnpm --filter @workspace/gustafta-pkb run typecheck` && `pnpm --filter @workspace/api-server run typecheck`
- **`evidence.length > 0` sebagai default expanded** untuk EvidencePanel — state initial value dihitung sekali saat mount, sudah benar karena evidence diload parent dulu
- **`autoGreetedRef`** mencegah double-fire auto-greeting saat HMR; tetap perlu cek `conv.messages.length === 0`

## Pointers

- Lihat skill `pnpm-workspace` untuk struktur workspace, TypeScript setup, dan package details
- Data SKK lengkap ada di `artifacts/api-server/src/lib/skk-data.ts`
