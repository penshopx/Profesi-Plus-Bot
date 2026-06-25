import { Link } from "wouter";
import {
  FileText, ArrowRight, ShieldCheck, Layers, Database, MessagesSquare,
  Cpu, Award, CheckCircle2, FileCheck, Briefcase, Sparkles,
  ClipboardList, Target, Gauge, Building2,
} from "lucide-react";

const STATS = [
  { value: "108", label: "Jabatan Kerja terpetakan", icon: Briefcase },
  { value: "519", label: "Unit Kompetensi SKK", icon: Database },
  { value: "6", label: "Klasifikasi konstruksi", icon: Layers },
  { value: "25", label: "SKPK per Executive Summary", icon: Award },
];

const PROBLEMS = [
  {
    icon: ClipboardList,
    title: "Menyusun Exum itu rumit",
    body: "Executive Summary 10–15 halaman menuntut struktur baku, kaitan ke unit kompetensi SKK, dan bukti yang valid. Banyak TKK terhenti di halaman pertama.",
  },
  {
    icon: Target,
    title: "Sulit memetakan kompetensi",
    body: "Menghubungkan pengalaman nyata Anda ke 519 unit kompetensi SKK yang benar membutuhkan pemahaman mendalam tentang jabatan kerja dan jenjang.",
  },
  {
    icon: Gauge,
    title: "Risiko 25 SKPK melayang",
    body: "Exum bernilai 25 SKPK sesuai Permen PUPR No. 12/2021. Dokumen yang lemah berarti angka kredit dan perpanjangan sertifikat ikut tertunda.",
  },
];

const STEPS = [
  {
    no: "01",
    title: "Pilih mode & jabatan kerja",
    body: "Mulai dari pengalaman kerja, hasil belajar, atau hybrid. Pilih jabker dari database 108 jabatan dan jenjang SKK Anda.",
    icon: Briefcase,
  },
  {
    no: "02",
    title: "Wawancara terpandu 6 fase",
    body: "Pewawancara AI menggali secara Socratic melewati fase profiling, konteks, wawancara inti, bukti, hingga sintesis.",
    icon: MessagesSquare,
  },
  {
    no: "03",
    title: "Kumpulkan bukti & pemetaan SKK",
    body: "Setiap pengalaman dikaitkan ke unit kompetensi SKK yang relevan, lengkap dengan bukti pendukung yang terorganisir.",
    icon: FileCheck,
  },
  {
    no: "04",
    title: "Hasilkan Exum siap pakai",
    body: "Dapatkan Executive Summary 10–15 halaman yang terstruktur, siap diunduh, dicetak, dan diajukan.",
    icon: FileText,
  },
];

const FEATURES = [
  {
    icon: Cpu,
    title: "4 Model AI pilihan",
    body: "Pilih GPT-4o, Gemini, Qwen, atau DeepSeek untuk setiap sesi wawancara sesuai gaya dan kebutuhan Anda.",
  },
  {
    icon: Database,
    title: "Basis data SKK lengkap",
    body: "519 unit kompetensi pada 108 jabatan kerja, 6 klasifikasi, dan 31 subklasifikasi konstruksi.",
  },
  {
    icon: Layers,
    title: "Tiga mode penulisan",
    body: "Pengalaman Kerja, Hasil Belajar, atau Hybrid — disesuaikan dengan rekam jejak profesional Anda.",
  },
  {
    icon: MessagesSquare,
    title: "Wawancara Socratic",
    body: "Pertanyaan reflektif yang menggali kedalaman, bukan sekadar formulir isian kosong.",
  },
  {
    icon: ShieldCheck,
    title: "Sesuai regulasi",
    body: "Mengikuti kerangka Permen PUPR No. 12 Tahun 2021 untuk Pengembangan Keprofesian Berkelanjutan.",
  },
  {
    icon: FileCheck,
    title: "Ekspor profesional",
    body: "Unduh sebagai dokumen rapi, cetak ke PDF, atau salin — format Exum yang konsisten dan baku.",
  },
];

function BlueprintGrid({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
        backgroundSize: "44px 44px",
      }}
    />
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* ── Nav ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-extrabold tracking-tight">Gustafta PKB</p>
              <p className="text-[10px] text-muted-foreground">Exum Interviewer v2.0</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
            >
              Masuk
            </Link>
            <Link
              href="/sign-up"
              data-testid="link-signup-nav"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              Daftar Gratis <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </nav>
      </header>

      <main>
      {/* ── Hero (Attention) ──────────────────────────────── */}
      <section className="relative overflow-hidden bg-sidebar text-sidebar-foreground">
        <BlueprintGrid />
        <div
          aria-hidden
          className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-primary/30 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent/50 px-3.5 py-1.5 text-xs font-medium text-sidebar-foreground/90">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" />
              Sesuai Permen PUPR No. 12 Tahun 2021
            </div>
            <h1 className="font-serif text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Ubah pengalaman Anda menjadi{" "}
              <span className="text-accent">Executive Summary PKB</span> bernilai 25 SKPK.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-sidebar-foreground/70 sm:text-lg">
              Pewawancara AI yang memandu Tenaga Kerja Konstruksi menyusun Exum
              berkualitas tinggi — 10–15 halaman, terpetakan ke unit kompetensi SKK,
              siap untuk perpanjangan sertifikat.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/sign-up"
                data-testid="link-signup-hero"
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-bold text-accent-foreground shadow-lg transition-transform hover:scale-[1.02]"
              >
                Mulai Buat Exum Gratis <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent/40 px-6 py-3.5 text-sm font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-accent/70"
              >
                Sudah punya akun
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-sidebar-foreground/60">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> 519 unit kompetensi SKK
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> 108 jabatan kerja
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> 4 model AI
              </span>
            </div>
          </div>

          {/* Mock Exum document */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-2xl border border-sidebar-border/60" />
            <div className="relative overflow-hidden rounded-2xl bg-card text-foreground shadow-2xl">
              <div className="flex items-center justify-between border-b border-border bg-muted/50 px-5 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold">Executive Summary PKB</span>
                </div>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                  25 SKPK
                </span>
              </div>
              <div className="space-y-3 p-5">
                <div className="h-2.5 w-2/3 rounded-full bg-foreground/80" />
                <div className="h-1.5 w-full rounded-full bg-muted-foreground/25" />
                <div className="h-1.5 w-11/12 rounded-full bg-muted-foreground/25" />
                <div className="h-1.5 w-4/5 rounded-full bg-muted-foreground/25" />
                <div className="!mt-5 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
                  <FileCheck className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="font-mono text-[10px] text-foreground/70">
                    M.71.ARS.101.01 · Rancangan Arsitektur
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted-foreground/25" />
                <div className="h-1.5 w-3/4 rounded-full bg-muted-foreground/25" />
                <div className="!mt-4 flex items-center justify-between border-t border-border pt-3">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Building2 className="h-3 w-3" /> Permen PUPR 12/2021
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-green-600">
                    <CheckCircle2 className="h-3 w-3" /> Exum siap
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -left-5 top-1/3 hidden rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-lg sm:block">
              <Sparkles className="mb-0.5 inline h-3.5 w-3.5" /> AI memandu
            </div>
          </div>
        </div>
      </section>

      {/* ── Stat band (Interest) ──────────────────────────── */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden px-5 py-2 lg:grid-cols-4">
          {STATS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex flex-col items-center gap-1 px-4 py-8 text-center">
                <Icon className="mb-1 h-5 w-5 text-primary" />
                <span className="font-serif text-3xl font-bold text-foreground sm:text-4xl">{s.value}</span>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Problem (Interest) ────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-2 text-sm font-bold uppercase tracking-wider text-accent">Tantangannya nyata</p>
          <h2 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            Kenapa banyak TKK terhenti menyusun Exum?
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {PROBLEMS.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10">
                  <Icon className="h-5 w-5 text-destructive" />
                </div>
                <h3 className="mb-2 text-base font-bold">{p.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── How it works (Interest → Desire) ──────────────── */}
      <section className="relative overflow-hidden border-y border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider text-primary">Cara kerjanya</p>
            <h2 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
              Dari wawancara ke dokumen, dalam empat langkah
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.no} className="relative rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="font-serif text-3xl font-bold text-primary/20">{s.no}</span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <h3 className="mb-2 text-base font-bold">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Features (Desire) ─────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-2 text-sm font-bold uppercase tracking-wider text-accent">Semua yang Anda butuhkan</p>
          <h2 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            Dirancang khusus untuk sertifikasi konstruksi
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 transition-colors group-hover:bg-accent/15">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mb-2 text-base font-bold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Authority (Desire) ────────────────────────────── */}
      <section className="border-y border-border bg-sidebar text-sidebar-foreground">
        <div className="relative mx-auto max-w-6xl overflow-hidden px-5 py-16">
          <BlueprintGrid />
          <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <h2 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
                Setiap Exum bernilai <span className="text-accent">25 SKPK</span>
              </h2>
              <p className="mt-4 max-w-md text-sidebar-foreground/70">
                Executive Summary adalah salah satu jalur pemenuhan angka kredit
                Pengembangan Keprofesian Berkelanjutan dengan bobot tertinggi —
                kunci untuk mempertahankan dan meningkatkan jenjang Sertifikat
                Kompetensi Kerja Anda.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { v: "10–15", l: "halaman dokumen" },
                { v: "3", l: "jenjang SKK" },
                { v: "31", l: "subklasifikasi" },
              ].map((x) => (
                <div
                  key={x.l}
                  className="rounded-2xl border border-sidebar-border bg-sidebar-accent/40 p-5 text-center"
                >
                  <p className="font-serif text-2xl font-bold text-accent sm:text-3xl">{x.v}</p>
                  <p className="mt-1 text-[11px] text-sidebar-foreground/70">{x.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA (Action) ────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-8 py-16 text-center text-primary-foreground shadow-xl">
          <BlueprintGrid />
          <div className="relative mx-auto max-w-2xl">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
              <FileText className="h-7 w-7" />
            </div>
            <h2 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
              Mulai Exum Anda hari ini
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-primary-foreground/85">
              Gratis untuk memulai. Pilih jabatan kerja, jawab wawancara terpandu,
              dan dapatkan Executive Summary yang siap diajukan.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/sign-up"
                data-testid="link-signup-cta"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-primary shadow-lg transition-transform hover:scale-[1.02]"
              >
                Daftar & Buat Exum <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Masuk
              </Link>
            </div>
          </div>
        </div>
      </section>
      </main>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold">Gustafta PKB</p>
              <p className="text-[10px] text-muted-foreground">Pewawancara Executive Summary PKB</p>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Mengikuti Permen PUPR No. 12 Tahun 2021 · Untuk Tenaga Kerja Konstruksi Indonesia
          </p>
        </div>
      </footer>
    </div>
  );
}
