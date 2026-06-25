import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  Sparkles, Send, Target, Lock, ArrowRight, Loader2,
  Compass, Layers, FileText, Share2,
} from "lucide-react";
import {
  dialogGustafta,
  type DialogProfile,
  type DialogBlueprintTeaser,
} from "@/lib/api";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING =
  "Ceritakan — kamu bekerja di bidang apa, atau ada tantangan apa? 🌟";

const GATES = [
  { n: "1", t: "Cerita bebas", d: "Ceritakan profesi, keahlian, atau tantangan Anda.", kind: "step" as const },
  { n: "G1", t: "Profil Awal", d: "AI tunjukkan snapshot profil Anda — gratis.", kind: "gate" as const },
  { n: "2", t: "Dialog lebih dalam", d: "Gali ide & potensi konkret bersama AI.", kind: "step" as const },
  { n: "G2", t: "Blueprint Potensi Diri", d: "Blueprint + materi Exum — buka dengan akun.", kind: "gate" as const },
];

export default function DialogGustaftaSection() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<DialogProfile | null>(null);
  const [teaser, setTeaser] = useState<DialogBlueprintTeaser | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const userTurns = messages.filter((m) => m.role === "user").length;
  const locked = teaser !== null;
  const currentGate = teaser ? 4 : profile ? 2 : userTurns >= 1 ? 1 : 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, profile, teaser, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading || locked) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await dialogGustafta(next.map((m) => ({ role: m.role, content: m.content })));
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
      if (res.profile) setProfile(res.profile);
      if (res.blueprintTeaser) setTeaser(res.blueprintTeaser);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan. Coba lagi.");
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="dialog-gustafta" className="relative overflow-hidden bg-sidebar text-sidebar-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div
        aria-hidden
        className="absolute -left-24 top-10 h-80 w-80 rounded-full bg-accent/15 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-[0.95fr_1.05fr] lg:py-24">
        {/* ── Concept column ── */}
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent/50 px-3.5 py-1.5 text-xs font-medium">
            <Compass className="h-3.5 w-3.5 text-accent" /> Teman Berpikir AI
          </div>
          <h2 className="font-serif text-3xl font-bold leading-[1.15] tracking-tight sm:text-4xl">
            Belum tahu mau mulai dari mana?{" "}
            <span className="text-accent">Dialog Gustafta bantu gali idenya.</span>
          </h2>
          <p className="mt-5 max-w-md text-sidebar-foreground/70">
            Ceritakan profesi, keahlian, atau tantangan Anda — Dialog Gustafta menggali
            potensi tersembunyi dan menyusun <span className="font-semibold text-sidebar-foreground">Blueprint Profil &amp; Potensi Diri</span>{" "}
            yang siap menjadi materi Executive Summary PKB Anda.
          </p>

          {/* Gate timeline */}
          <ol className="mt-8 space-y-2.5">
            {GATES.map((g, i) => {
              const reached = i <= currentGate - 1 || (i === 0 && currentGate >= 1);
              const isGate = g.kind === "gate";
              return (
                <li key={g.n} className="flex items-start gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                      isGate
                        ? reached
                          ? "bg-accent text-accent-foreground"
                          : "border border-accent/40 bg-accent/10 text-accent"
                        : reached
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "border border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground/60"
                    }`}
                  >
                    {g.n}
                  </span>
                  <div className="pt-0.5">
                    <p className="text-sm font-semibold leading-tight">{g.t}</p>
                    <p className="text-xs text-sidebar-foreground/60">{g.d}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-sidebar-foreground/60">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Gratis
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-accent" /> Tanpa daftar
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Share2 className="h-3.5 w-3.5 text-accent" /> Dapat di-share
            </span>
          </div>
        </div>

        {/* ── Interactive chat column ── */}
        <div className="relative mx-auto w-full max-w-md">
          <div className="overflow-hidden rounded-2xl bg-card text-foreground shadow-2xl">
            {/* header */}
            <div className="flex items-center justify-between border-b border-border bg-muted/50 px-5 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15">
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                </div>
                <div className="leading-tight">
                  <p className="text-xs font-bold">Dialog Gustafta</p>
                  <p className="text-[10px] text-muted-foreground">Teman Berpikir · 3-Stage System</p>
                </div>
              </div>
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                G{Math.min(2, profile ? (teaser ? 2 : 1) : 0)} / 2
              </span>
            </div>

            {/* messages */}
            <div ref={scrollRef} className="max-h-[340px] space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "assistant"
                      ? "max-w-[88%] rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-sm"
                      : "ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-accent px-3.5 py-2.5 text-sm text-accent-foreground"
                  }
                >
                  {m.content}
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gustafta sedang berpikir…
                </div>
              )}

              {/* G1 — Profil Awal */}
              {profile && (
                <div className="rounded-xl border border-accent/30 bg-accent/5 p-3.5">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-accent">
                    <Target className="h-3.5 w-3.5" /> Checkpoint G1 — Profil Awal
                  </div>
                  <dl className="space-y-1.5 text-xs">
                    <div className="flex gap-2">
                      <dt className="shrink-0 font-semibold text-foreground/60">Bidang</dt>
                      <dd className="text-foreground">{profile.bidang}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="shrink-0 font-semibold text-foreground/60">Keahlian</dt>
                      <dd className="flex flex-wrap gap-1">
                        {profile.keahlian.map((k) => (
                          <span key={k} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px]">{k}</span>
                        ))}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="shrink-0 font-semibold text-foreground/60">Tantangan</dt>
                      <dd className="text-foreground">{profile.tantangan}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="shrink-0 font-semibold text-foreground/60">Potensi</dt>
                      <dd className="text-foreground">{profile.potensiAwal}</dd>
                    </div>
                  </dl>
                </div>
              )}

              {/* G2 — Blueprint (gated) */}
              {teaser && (
                <div className="relative overflow-hidden rounded-xl border border-sidebar-primary/30 bg-sidebar-primary/5 p-3.5">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-sidebar-primary">
                    <Layers className="h-3.5 w-3.5" /> Checkpoint G2 — Blueprint Potensi Diri
                  </div>
                  <div className="space-y-2 text-xs">
                    {teaser.ringkasan && <p className="text-foreground/80">{teaser.ringkasan}</p>}
                    <p className="font-semibold text-foreground/60">Potensi:</p>
                    <ul className="list-disc pl-4 text-foreground/70">
                      {teaser.potensiPreview.map((p) => <li key={p}>{p}</li>)}
                      {Array.from({
                        length: Math.max(0, teaser.potensiCount - teaser.potensiPreview.length),
                      }).map((_, i) => (
                        <li key={`p-lock-${i}`} className="select-none blur-[5px]" aria-hidden>
                          Potensi terkunci — daftar untuk membuka
                        </li>
                      ))}
                    </ul>
                    <p className="font-semibold text-foreground/60">
                      {teaser.unitSkkCount} area unit kompetensi SKK &amp; {teaser.materiExumCount} poin materi Executive Summary menanti.
                    </p>
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/40 px-4 text-center backdrop-blur-[2px]">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-primary/15">
                      <Lock className="h-4 w-4 text-sidebar-primary" />
                    </div>
                    <p className="text-xs font-semibold text-foreground">
                      Blueprint &amp; materi Exum siap untuk Anda
                    </p>
                    <Link
                      href="/sign-up"
                      data-testid="link-signup-dialog"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                    >
                      Daftar untuk buka Blueprint <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
              )}
            </div>

            {/* input */}
            <div className="border-t border-border bg-card p-3">
              {locked ? (
                <Link
                  href="/sign-up"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Lanjutkan dengan akun gratis <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <div className="flex items-end gap-2">
                  <textarea
                    data-testid="input-dialog-gustafta"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={1}
                    placeholder={
                      userTurns === 0
                        ? "Mis. Saya konsultan K3 yang ingin menjangkau lebih banyak klien…"
                        : "Ketik jawaban Anda…"
                    }
                    className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    data-testid="button-dialog-send"
                    onClick={send}
                    disabled={loading || !input.trim()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              )}
              <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                <FileText className="h-3 w-3" /> Hasil dialog jadi materi Executive Summary di Studio Penulis Cerdas
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
