import { useEffect, useRef, useState } from "react";
import { BookOpenText, MessageCircleQuestion, Send, X, Loader2 } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type Msg = { role: "user" | "assistant"; content: string };
type Mode = "app" | "regulasi";

const CONFIG: Record<
  Mode,
  {
    side: "left" | "right";
    title: string;
    subtitle: string;
    greeting: string;
    chips: string[];
    Icon: typeof MessageCircleQuestion;
  }
> = {
  app: {
    side: "left",
    title: "Panduan Aplikasi",
    subtitle: "Fitur & cara pakai Gustafta",
    greeting:
      "Halo! Saya Panduan Aplikasi Gustafta. Tanyakan apa saja tentang fitur dan cara pakai aplikasi ini — dari sesi wawancara sampai Generate Exum.",
    chips: [
      "Bagaimana cara membuat Exum pertama saya?",
      "Apa itu Studio Kompetensi?",
      "Cara mencatat kegiatan PKB?",
      "Apa bedanya paket gratis dan Pro?",
    ],
    Icon: MessageCircleQuestion,
  },
  regulasi: {
    side: "right",
    title: "Asisten Regulasi",
    subtitle: "Permen 12/2021 · SE 214/2022 · SK 114/2024",
    greeting:
      "Halo! Saya Asisten Regulasi PKB. Saya bisa menjelaskan Permen PU 12/2021, format Executive Summary SE 214/2022, dan jabatan kerja SK 114/2024.",
    chips: [
      "Apa itu PKB dan SKPK?",
      "Berapa SKPK untuk perpanjangan SKK?",
      "Apa format Executive Summary resmi?",
      "Bagaimana komposisi Nilai Kredit dihitung?",
    ],
    Icon: BookOpenText,
  },
};

function HelpBot({ mode }: { mode: Mode }) {
  const cfg = CONFIG[mode];
  const greeting: Msg = { role: "assistant", content: cfg.greeting };
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([greeting]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/helpbot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Kirim riwayat tanpa sapaan pembuka (hemat token, tetap kontekstual)
        body: JSON.stringify({
          mode,
          messages: next.filter((m) => m.content !== cfg.greeting).slice(-10),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: data.error ?? "Maaf, terjadi gangguan. Coba lagi sebentar lagi.",
          },
        ]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.reply! }]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Koneksi bermasalah. Periksa jaringan Anda dan coba lagi." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const sideBtn = cfg.side === "left" ? "left-5" : "right-5";
  const sidePanel = cfg.side === "left" ? "left-4" : "right-4";
  const { Icon } = cfg;

  return (
    <>
      {/* Tombol mengambang */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Buka ${cfg.title}`}
          data-testid={`button-helpbot-open-${mode}`}
          className={`fixed bottom-5 ${sideBtn} z-50 flex items-center justify-center rounded-full ${
            mode === "app" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"
          } p-3.5 shadow-lg transition-transform hover:scale-105 active:scale-95`}
        >
          <Icon className="h-6 w-6" />
        </button>
      )}

      {/* Panel chat */}
      {open && (
        <div
          className={`fixed bottom-4 ${sidePanel} z-50 flex h-[min(560px,calc(100dvh-2rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl`}
          data-testid={`panel-helpbot-${mode}`}
        >
          <div
            className={`flex items-center justify-between gap-2 px-4 py-3 ${
              mode === "app" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              <div>
                <p className="text-sm font-semibold leading-tight">{cfg.title}</p>
                <p className="text-xs opacity-80">{cfg.subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup asisten"
              data-testid={`button-helpbot-close-${mode}`}
              className="rounded-md p-1 hover:bg-white/15"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-foreground"
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Asisten sedang mengetik…
              </div>
            )}
            {messages.length === 1 && !loading && (
              <div className="flex flex-wrap gap-2 pt-1">
                {cfg.chips.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => void send(c)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            className="flex items-center gap-2 border-t border-border px-3 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === "app" ? "Tanya fitur atau cara pakai…" : "Tanya aturan PKB…"}
              maxLength={1000}
              data-testid={`input-helpbot-${mode}`}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Kirim"
              data-testid={`button-helpbot-send-${mode}`}
              className="rounded-lg bg-primary p-2 text-primary-foreground disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export function FloatingHelpBot() {
  return (
    <>
      <HelpBot mode="app" />
      <HelpBot mode="regulasi" />
    </>
  );
}
