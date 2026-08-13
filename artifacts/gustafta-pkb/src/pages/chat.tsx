import { useState, useRef, useEffect, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Send, Loader2, Download, FileText, CheckCircle2,
  Plus, Trash2, Youtube, Video, Monitor, Briefcase, Camera, FolderOpen,
  ChevronDown, ChevronUp, BookOpen, HardHat, X, Link, FileCheck, Shield,
  MessageSquare, AlertCircle, BarChart3, ChevronRight,
  Copy, CheckCheck, Zap, SlidersHorizontal, Printer, Pencil, Cpu,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  getConversation, streamMessage, generateExum, advancePhase, createEvidence, deleteEvidence, patchEvidence,
  fetchSkkUnits, updateConversation, listPersonas, checkCompetencyAnalysisForJabker, PlanLimitError, SCALEV_CHECKOUT_URL,
  type Message, type EvidenceItem, type SkkUnit, type SocratiDialog,
} from "@/lib/api";
import { ExumOutlineEditor } from "@/components/ExumOutlineEditor";
import { QuizSummaryPanel } from "@/components/QuizSummaryPanel";
import { getMyUsage, getMyPlan } from "@/lib/api-profile";

// ─── Markdown → HTML helpers (module-level, used by print & HTML export) ──────
function mdEsc(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function mdInline(s: string) {
  return mdEsc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}
function mdToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inUl = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("### ")) { if (inUl) { out.push("</ul>"); inUl = false; } out.push(`<h3>${mdInline(line.slice(4))}</h3>`); }
    else if (line.startsWith("## ")) { if (inUl) { out.push("</ul>"); inUl = false; } out.push(`<h2>${mdInline(line.slice(3))}</h2>`); }
    else if (line.startsWith("# ")) { if (inUl) { out.push("</ul>"); inUl = false; } out.push(`<h1>${mdInline(line.slice(2))}</h1>`); }
    else if (/^[*-] /.test(line)) { if (!inUl) { out.push("<ul>"); inUl = true; } out.push(`<li>${mdInline(line.slice(2))}</li>`); }
    else if (line === "") { if (inUl) { out.push("</ul>"); inUl = false; } out.push(""); }
    else { if (inUl) { out.push("</ul>"); inUl = false; } out.push(`<p>${mdInline(line)}</p>`); }
  }
  if (inUl) out.push("</ul>");
  return out.join("\n");
}

const EXUM_PRINT_CSS = `
  @page { size: A4; margin: 20mm 25mm; }
  body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.7; color: #111; max-width: 720px; margin: 0 auto; }
  h1 { font-size: 18pt; text-align: center; margin: 0 0 6pt; }
  h2 { font-size: 14pt; margin: 24pt 0 6pt; border-bottom: 1.5pt solid #333; padding-bottom: 4pt; page-break-after: avoid; }
  h3 { font-size: 12pt; font-weight: bold; margin: 16pt 0 4pt; page-break-after: avoid; }
  p { margin: 0 0 8pt; text-align: justify; }
  ul, ol { margin: 0 0 10pt; padding-left: 22pt; }
  li { margin-bottom: 3pt; }
  strong { font-weight: bold; }
  em { font-style: italic; }
  code { font-family: monospace; font-size: 10pt; background: #f4f4f4; padding: 1pt 3pt; border-radius: 2pt; }
  .meta { text-align: center; color: #555; font-size: 10pt; margin-bottom: 24pt; }
  @media print { body { margin: 0; } }
`;

function formatTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

const AUTO_GREETING = "Halo Pak Budi, saya siap memulai.";

// Read + consume the marketplace context set by the DetailPanel.
// Returns null if no context is stored. Clears the key on first read
// so the context is only applied to the conversation it was created for.
function consumeMarketplaceInterviewCtx(): { namaMateri: string; penyelenggara: string; isWatched: boolean } | null {
  try {
    const raw = sessionStorage.getItem("INTERVIEW_FROM_MARKETPLACE");
    if (!raw) return null;
    sessionStorage.removeItem("INTERVIEW_FROM_MARKETPLACE");
    return JSON.parse(raw) as { namaMateri: string; penyelenggara: string; isWatched: boolean };
  } catch {
    return null;
  }
}

function buildMarketplaceGreeting(ctx: { namaMateri: string; penyelenggara: string; isWatched: boolean }): string {
  const watchedPhrase = ctx.isWatched
    ? `saya baru selesai menonton **${ctx.namaMateri}** dari **${ctx.penyelenggara}**`
    : `saya baru membuka modul **${ctx.namaMateri}** dari **${ctx.penyelenggara}** di marketplace PKB`;
  return `Halo Pak Budi, ${watchedPhrase} dan ingin membahasnya sebagai bukti PKB saya. Bisa kita mulai?`;
}

// ─── Phase config ─────────────────────────────────────────────────────────────
const PHASE_STEPS = ["profiling", "context", "core_interview", "evidence", "synthesis", "done"];
const PHASE_LABELS: Record<string, string> = {
  profiling: "Profiling",
  context: "Konteks",
  core_interview: "Wawancara Inti",
  evidence: "Bukti & Data",
  synthesis: "Sintesis",
  done: "Selesai",
};

// ─── Evidence config ──────────────────────────────────────────────────────────
const LEARNING_CATEGORIES = [
  { id: "youtube", label: "Video YouTube", icon: Youtube, color: "text-red-500", bg: "bg-red-50" },
  { id: "webinar", label: "Webinar", icon: Video, color: "text-blue-500", bg: "bg-blue-50" },
  { id: "diklatkerja", label: "Recording Diklatkerja", icon: Monitor, color: "text-purple-500", bg: "bg-purple-50" },
];
const WORK_CATEGORIES = [
  { id: "esimpan", label: "Screenshot ESIMPAN", icon: Monitor, color: "text-teal-600", bg: "bg-teal-50" },
  { id: "photo", label: "Foto Proyek", icon: Camera, color: "text-amber-600", bg: "bg-amber-50" },
  { id: "document", label: "Surat / Kontrak / SK", icon: FileCheck, color: "text-indigo-600", bg: "bg-indigo-50" },
];

const ALL_CATEGORIES = [...LEARNING_CATEGORIES, ...WORK_CATEGORIES];
function getCatConfig(id: string) {
  return ALL_CATEGORIES.find((c) => c.id === id) ?? { label: id, icon: FolderOpen, color: "text-gray-500", bg: "bg-gray-50" };
}

function getSocratiQuestions(type: "learning" | "work_experience", title: string): [string, string, string, string] {
  if (type === "learning") {
    return [
      `Dari sumber **"${title}"** ini, apa **satu konsep terpenting** yang Anda pelajari?`,
      `Jelaskan konsep tersebut **dengan kata-kata Anda sendiri**, seolah Anda menjelaskan kepada rekan kerja di lapangan.`,
      `Bagaimana materi ini **berbeda atau memperkuat** cara kerja Anda selama ini di proyek?`,
      `Di situasi atau proyek kerja apa **konkretnya** Anda akan menerapkan pelajaran ini?`,
    ];
  } else {
    return [
      `Ceritakan **tantangan terbesar** yang Anda hadapi dalam **"${title}"** ini.`,
      `Bagaimana Anda memecahkan tantangan tersebut? Jelaskan **langkah-langkah konkretnya**.`,
      `Apa **keputusan teknis terpenting** yang Anda buat? Apa pertimbangannya saat itu?`,
      `Apa **pembelajaran paling berharga** dari pengalaman ini yang akan Anda bawa ke proyek berikutnya?`,
    ];
  }
}

// ─── Add Evidence Wizard ───────────────────────────────────────────────────────
type WizardStep = "info" | "q1" | "q2" | "q3" | "q4" | "skk";

interface AddEvidenceWizardProps {
  type: "learning" | "work_experience";
  jabker: string;
  onClose: () => void;
  onSave: (data: {
    category: string; title: string; url?: string; description?: string;
    skkNotes?: string; skkUnitCode?: string; skkUnitName?: string;
    socratiDialog: SocratiDialog; socratiCompleted: boolean;
  }) => void;
  saving: boolean;
}

function AddEvidenceWizard({ type, jabker, onClose, onSave, saving }: AddEvidenceWizardProps) {
  const cats = type === "learning" ? LEARNING_CATEGORIES : WORK_CATEGORIES;
  const [step, setStep] = useState<WizardStep>("info");
  const [category, setCategory] = useState(cats[0].id);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [answers, setAnswers] = useState<[string, string, string, string]>(["", "", "", ""]);
  const [selectedUnit, setSelectedUnit] = useState<SkkUnit | null>(null);
  const [skkUnits, setSkkUnits] = useState<SkkUnit[]>([]);
  const [loadingSkk, setLoadingSkk] = useState(false);
  const [jabkerIsKnown, setJabkerIsKnown] = useState<boolean | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [manualName, setManualName] = useState("");
  const [skkSearch, setSkkSearch] = useState("");

  const showUrl = type === "learning" || category === "esimpan";
  const questions = title ? getSocratiQuestions(type, title) : ["", "", "", ""];

  const stepOrder: WizardStep[] = ["info", "q1", "q2", "q3", "q4", "skk"];
  const stepIdx = stepOrder.indexOf(step);

  const stepLabels: Record<WizardStep, string> = {
    info: "Info Dasar",
    q1: "Dialog 1/4",
    q2: "Dialog 2/4",
    q3: "Dialog 3/4",
    q4: "Dialog 4/4",
    skk: "Unit SKK",
  };

  async function loadSkk() {
    if (!jabker) return;
    setLoadingSkk(true);
    try {
      const res = await fetchSkkUnits(jabker);
      setSkkUnits(res.units ?? []);
      setJabkerIsKnown(res.isKnown ?? false);
    } finally {
      setLoadingSkk(false);
    }
  }

  function goNext() {
    if (step === "info") setStep("q1");
    else if (step === "q1") setStep("q2");
    else if (step === "q2") setStep("q3");
    else if (step === "q3") setStep("q4");
    else if (step === "q4") { setStep("skk"); loadSkk(); }
  }

  function goBack() {
    if (step === "q1") setStep("info");
    else if (step === "q2") setStep("q1");
    else if (step === "q3") setStep("q2");
    else if (step === "q4") setStep("q3");
    else if (step === "skk") setStep("q4");
  }

  function handleSave() {
    const dialog: SocratiDialog = {
      q1: questions[0], a1: answers[0],
      q2: questions[1], a2: answers[1],
      q3: questions[2], a3: answers[2],
      q4: questions[3], a4: answers[3],
    };
    const finalCode = selectedUnit?.code ?? (manualCode.trim() || undefined);
    const finalName = selectedUnit?.name ?? (manualName.trim() || undefined);
    onSave({
      category, title, url: url || undefined, description: description || undefined,
      skkUnitCode: finalCode, skkUnitName: finalName,
      socratiDialog: dialog,
      socratiCompleted: answers.every((a) => a.trim().length > 0),
    });
  }

  const canNextInfo = title.trim().length > 0;
  const qIdx = step === "q1" ? 0 : step === "q2" ? 1 : step === "q3" ? 2 : 3;
  const canNextQ = answers[qIdx]?.trim().length >= 10;

  const headerColor = type === "learning" ? "bg-blue-50" : "bg-teal-50";
  const headerIcon = type === "learning"
    ? <BookOpen className="w-5 h-5 text-blue-600" />
    : <HardHat className="w-5 h-5 text-teal-600" />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b border-border rounded-t-2xl ${headerColor} shrink-0`}>
          <div className="flex items-center gap-3">
            {headerIcon}
            <div>
              <h3 className="font-semibold text-foreground text-sm">
                {type === "learning" ? "Tambah Sumber Pembelajaran" : "Tambah Bukti Pengalaman Kerja"}
              </h3>
              <p className="text-xs text-muted-foreground">{stepLabels[step]}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/10 transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-1">
            {stepOrder.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  i < stepIdx ? "bg-primary text-primary-foreground" :
                  i === stepIdx ? "bg-primary text-primary-foreground ring-2 ring-primary/30" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {i < stepIdx ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                </div>
                {i < stepOrder.length - 1 && (
                  <div className={`h-0.5 w-4 rounded-full transition-all ${i < stepIdx ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
            <span className="ml-auto text-xs text-muted-foreground font-medium">{stepLabels[step]}</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* STEP: Info */}
          {step === "info" && (
            <>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Jenis Sumber</label>
                <div className="grid grid-cols-3 gap-2">
                  {cats.map((c) => {
                    const Icon = c.icon;
                    return (
                      <button key={c.id} onClick={() => setCategory(c.id)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-all ${
                          category === c.id ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
                        }`}>
                        <Icon className={`w-5 h-5 ${category === c.id ? "text-primary" : c.color}`} />
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {type === "learning" ? "Judul Video / Webinar *" : "Nama Proyek / Dokumen *"}
                </label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder={type === "learning" ? "Contoh: Manajemen Konstruksi Modern — YouTube" : "Contoh: Proyek Gedung Pemkab Bandung 2024"}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>

              {showUrl && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                    <Link className="w-3 h-3 inline mr-1" />
                    {type === "learning" ? "Link / URL" : "Nomor Registrasi ESIMPAN"}
                  </label>
                  <div className="relative">
                    <input type="text" value={url}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUrl(val);
                        if (type === "learning" && val) {
                          try {
                            const u = new URL(val.startsWith("http") ? val : `https://${val}`);
                            if (u.hostname.includes("youtube.com") || u.hostname === "youtu.be") setCategory("youtube");
                          } catch {}
                        }
                      }}
                      placeholder={type === "learning" ? "https://youtube.com/... (kategori otomatis terdeteksi)" : "Masukkan nomor registrasi / link ESIMPAN"}
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                    {url && category === "youtube" && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                        <Youtube className="w-2.5 h-2.5" /> YouTube
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {type === "learning" ? "Ringkasan Isi (opsional)" : "Keterangan Singkat (opsional)"}
                </label>
                <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder={type === "learning" ? "Apa yang dibahas dalam video/webinar ini..." : "Deskripsi singkat proyek, nilai kontrak, lokasi..."}
                  className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-muted-foreground flex items-start gap-2">
                <MessageSquare className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>Setelah mengisi info dasar, <span className="font-semibold text-foreground">Pak Budi akan mengajukan 4 pertanyaan</span> untuk menggali pemahaman Anda lebih dalam sebelum menyimpan.</span>
              </div>
            </>
          )}

          {/* STEP: Socratic Q1-Q4 */}
          {(step === "q1" || step === "q2" || step === "q3" || step === "q4") && (
            <>
              <div className="bg-primary rounded-2xl p-4 text-primary-foreground">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <span className="text-white text-[10px] font-bold">PB</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-1 opacity-80">Pak Budi bertanya:</p>
                    <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none [&>p]:mb-0">
                      <ReactMarkdown>{questions[qIdx]}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                  Jawaban Anda
                </label>
                <textarea
                  rows={5}
                  value={answers[qIdx]}
                  onChange={(e) => {
                    const next = [...answers] as [string, string, string, string];
                    next[qIdx] = e.target.value;
                    setAnswers(next);
                  }}
                  placeholder="Tulis jawaban Anda dengan detail dan jujur. Semakin konkret, semakin baik Exum yang dihasilkan."
                  className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                {answers[qIdx].trim().length > 0 && answers[qIdx].trim().length < 10 && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Jawaban terlalu singkat — uraikan lebih detail
                  </p>
                )}
              </div>

              {qIdx > 0 && (
                <div className="space-y-2">
                  {Array.from({ length: qIdx }).map((_, i) => (
                    <div key={i} className="bg-muted/50 rounded-xl px-3 py-2 text-xs">
                      <p className="font-semibold text-muted-foreground mb-0.5">Pertanyaan {i + 1}:</p>
                      <p className="text-foreground line-clamp-1">{answers[i] || <span className="italic text-muted-foreground">—</span>}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* STEP: SKK Picker */}
          {step === "skk" && (
            <>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                <div className="text-xs text-green-800">
                  <span className="font-semibold">Dialog Sokratik selesai.</span> Sekarang pilih unit SKK yang paling relevan dengan bukti ini.
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                  <Shield className="w-3.5 h-3.5 inline mr-1" />
                  Pilih Unit SKK (SK DJBK No. 114/2024)
                </label>
                {loadingSkk ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
                    <span className="text-sm text-muted-foreground">Memuat unit SKK...</span>
                  </div>
                ) : !jabkerIsKnown && skkUnits.length === 0 ? (
                  <div className="space-y-3">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                      <p className="font-semibold mb-1">Jabatan kerja ini belum ada dalam database.</p>
                      <p>Masukkan kode dan nama unit kompetensi dari sertifikat SKK Anda secara manual (opsional).</p>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                          Kode Unit Kompetensi
                        </label>
                        <input
                          type="text"
                          value={manualCode}
                          onChange={(e) => setManualCode(e.target.value)}
                          placeholder="Contoh: M.71.XXX.001.01"
                          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                          Nama Unit Kompetensi
                        </label>
                        <input
                          type="text"
                          value={manualName}
                          onChange={(e) => setManualName(e.target.value)}
                          placeholder="Contoh: Melakukan Pengendalian Mutu Pekerjaan"
                          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                      </div>
                      {manualCode.trim() && manualName.trim() && (
                        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                          <p className="text-[11px] text-green-800">Unit manual akan disimpan bersama bukti ini.</p>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground italic">
                        Biarkan kosong untuk menyimpan tanpa tag unit SKK.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                  {skkUnits.length > 4 && (
                    <div className="relative mb-2">
                      <input
                        type="text"
                        value={skkSearch}
                        onChange={(e) => setSkkSearch(e.target.value)}
                        placeholder="Cari kode atau nama unit SKK..."
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs pl-8 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                      <Shield className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  )}
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {skkUnits.filter(u =>
                      !skkSearch.trim() ||
                      u.code.toLowerCase().includes(skkSearch.toLowerCase()) ||
                      u.name.toLowerCase().includes(skkSearch.toLowerCase())
                    ).map((unit) => (
                      <button key={unit.code}
                        onClick={() => setSelectedUnit(selectedUnit?.code === unit.code ? null : unit)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                          selectedUnit?.code === unit.code
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card hover:border-muted-foreground/40"
                        }`}>
                        <div className="flex items-start gap-2">
                          <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                            selectedUnit?.code === unit.code ? "border-primary bg-primary" : "border-muted-foreground/30"
                          }`}>
                            {selectedUnit?.code === unit.code && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-mono text-muted-foreground">{unit.code}</p>
                            <p className="text-xs font-semibold text-foreground">{unit.name}</p>
                            <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{unit.description}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  </>
                )}
              </div>

              <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">Ringkasan Serpihan</p>
                <p className="line-clamp-1"><span className="font-medium">Judul:</span> {title}</p>
                {selectedUnit && <p><span className="font-medium">SKK:</span> {selectedUnit.code} — {selectedUnit.name}</p>}
                <p><span className="font-medium">Dialog:</span> {answers.filter(a => a.trim()).length}/4 pertanyaan dijawab</p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-3 shrink-0">
          {step !== "info" ? (
            <button onClick={goBack}
              className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
              ← Kembali
            </button>
          ) : (
            <button onClick={onClose}
              className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
              Batal
            </button>
          )}

          {step === "skk" ? (
            <button onClick={handleSave} disabled={saving}
              className="flex-1 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? "Menyimpan..." : "Simpan Serpihan"}
            </button>
          ) : (
            <div className="flex-1 flex flex-col gap-1.5">
              <button
                onClick={goNext}
                disabled={step === "info" ? !canNextInfo : !canNextQ}
                className="w-full rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                {step === "info" ? "Mulai Dialog Pak Budi" : "Lanjut"}
                <ChevronRight className="w-4 h-4" />
              </button>
              {step !== "info" && (
                <button
                  onClick={() => { setStep("skk"); loadSkk(); }}
                  className="w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors py-0.5">
                  Lewati dialog → langsung pilih SKK
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Evidence Card ────────────────────────────────────────────────────────────
function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/shorts/")[1].split("/")[0];
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/embed/")[1].split("/")[0];
      return u.searchParams.get("v");
    }
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
  } catch {}
  return null;
}

function EvidenceCard({ item, convId, onDelete, onRefresh }: {
  item: EvidenceItem;
  convId: number;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const cat = getCatConfig(item.category);
  const Icon = cat.icon;
  const ytId = item.url ? extractYoutubeId(item.url) : null;
  const thumbnailUrl = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null;
  const openUrl = item.url ? (item.url.startsWith("http") ? item.url : `https://${item.url}`) : null;

  return (
    <>
      {showEditDialog && (
        <EditDialogModal
          item={item}
          convId={convId}
          onClose={() => setShowEditDialog(false)}
          onSaved={() => { setShowEditDialog(false); onRefresh(); }}
        />
      )}
    <div className="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all hover:shadow-sm">
      {/* YouTube thumbnail strip */}
      {thumbnailUrl && openUrl && (
        <a href={openUrl} target="_blank" rel="noopener noreferrer" className="block relative">
          <img
            src={thumbnailUrl}
            alt={item.title}
            className="w-full h-24 object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow">
              <Youtube className="w-5 h-5 text-red-600 ml-0.5" />
            </div>
          </div>
          <div className="absolute top-1.5 right-1.5">
            <span className="bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">YouTube</span>
          </div>
        </a>
      )}

      <div className="p-3">
        <div className="flex items-start gap-2.5">
          {!thumbnailUrl && (
            <div className={`w-8 h-8 rounded-lg ${cat.bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-4 h-4 ${cat.color}`} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1">
              <p className="text-xs font-semibold text-foreground leading-tight flex-1">{item.title}</p>
              {item.socratiCompleted && (
                <span title="Dialog Sokratik selesai" className="shrink-0">
                  <MessageSquare className="w-3.5 h-3.5 text-green-500" />
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cat.bg} ${cat.color}`}>
                {cat.label}
              </span>
              {openUrl && (
                <a href={openUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline">
                  <Link className="w-2.5 h-2.5" />
                  {thumbnailUrl ? "Buka video" : (item.url!.length > 28 ? item.url!.slice(0, 28) + "…" : item.url)}
                </a>
              )}
            </div>

            {item.description && (
              <p className="mt-1.5 text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{item.description}</p>
            )}

            {item.skkUnitCode ? (
              <div className="mt-2 bg-primary/5 border border-primary/20 rounded-lg px-2 py-1.5">
                <p className="text-[10px] font-mono text-primary/70">{item.skkUnitCode}</p>
                <p className="text-[10px] font-semibold text-foreground line-clamp-1">{item.skkUnitName}</p>
              </div>
            ) : item.skkNotes ? (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                <p className="text-[10px] font-semibold text-amber-700 flex items-center gap-1 mb-0.5">
                  <Shield className="w-2.5 h-2.5" /> SKK
                </p>
                <p className="text-[10px] text-amber-800 line-clamp-2">{item.skkNotes}</p>
              </div>
            ) : null}

            <EvidenceDialogExpand item={item} />
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <button onClick={() => setShowEditDialog(true)}
              title="Ulangi/edit Dialog Sokratik"
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-all">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

function EvidenceDialogExpand({ item }: { item: EvidenceItem }) {
  const [open, setOpen] = useState(false);
  if (!item.socratiDialog) return null;
  let dialog: Record<string, string> | null = null;
  try { dialog = JSON.parse(item.socratiDialog); } catch {}
  if (!dialog) return null;
  const pairs = [
    { q: dialog.q1, a: dialog.a1 },
    { q: dialog.q2, a: dialog.a2 },
    { q: dialog.q3, a: dialog.a3 },
    { q: dialog.q4, a: dialog.a4 },
  ].filter(p => p.q && p.a);
  if (!pairs.length) return null;

  return (
    <div className="mt-2 border-t border-border/50 pt-1.5">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full group/btn">
        <MessageSquare className="w-2.5 h-2.5 text-green-500" />
        <span className="font-medium">Dialog Sokratik ({pairs.length} pertanyaan)</span>
        {open
          ? <ChevronUp className="w-2.5 h-2.5 ml-auto" />
          : <ChevronDown className="w-2.5 h-2.5 ml-auto" />}
      </button>
      {open && (
        <div className="mt-2 space-y-2.5 animate-in fade-in slide-in-from-top-1">
          {pairs.map((p, i) => (
            <div key={i} className="space-y-1">
              <div className="flex gap-1.5">
                <span className="text-[9px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded font-bold shrink-0 mt-0.5">P{i + 1}</span>
                <p className="text-[10px] text-blue-700 leading-snug font-medium">{p.q}</p>
              </div>
              <div className="flex gap-1.5">
                <span className="text-[9px] bg-green-100 text-green-600 px-1 py-0.5 rounded font-bold shrink-0 mt-0.5">J</span>
                <p className="text-[10px] text-foreground/80 bg-muted/60 rounded-lg px-2 py-1 leading-relaxed">{p.a}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Edit Dialog Sokratik Modal ───────────────────────────────────────────────
function EditDialogModal({ item, convId, onClose, onSaved }: {
  item: EvidenceItem;
  convId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const questions = getSocratiQuestions(item.type, item.title);
  let existing: Record<string, string> = {};
  try { if (item.socratiDialog) existing = JSON.parse(item.socratiDialog); } catch {}

  const [answers, setAnswers] = useState<string[]>([
    existing.a1 ?? "",
    existing.a2 ?? "",
    existing.a3 ?? "",
    existing.a4 ?? "",
  ]);
  const [saving, setSaving] = useState(false);

  const filled = answers.filter(a => a.trim()).length;
  const canSave = filled > 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      const dialog: SocratiDialog = {
        q1: questions[0], a1: answers[0],
        q2: questions[1], a2: answers[1],
        q3: questions[2], a3: answers[2],
        q4: questions[3], a4: answers[3],
      };
      await patchEvidence(convId, item.id, { socratiDialog: dialog, socratiCompleted: filled === 4 });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col animate-in fade-in slide-in-from-bottom-3">
        {/* Header */}
        <div className="flex items-center gap-2.5 p-4 border-b border-border shrink-0">
          <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">Ulangi Dialog Sokratik</p>
            <p className="text-[11px] text-muted-foreground truncate">{item.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Questions */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {questions.map((q, i) => (
            <div key={i}>
              <div className="flex gap-2 mb-1.5">
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold shrink-0 mt-0.5">P{i+1}</span>
                <p className="text-xs font-medium text-foreground leading-snug">{q}</p>
              </div>
              <textarea
                value={answers[i]}
                onChange={(e) => setAnswers(prev => { const a = [...prev]; a[i] = e.target.value; return a; })}
                rows={3}
                placeholder="Jawaban Anda..."
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex gap-2.5 shrink-0">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-medium hover:bg-muted transition-colors">
            Batal
          </button>
          <button onClick={handleSave} disabled={!canSave || saving}
            className="flex-1 rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : <><CheckCircle2 className="w-4 h-4" /> Simpan ({filled}/4)</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Gap Analysis Panel ───────────────────────────────────────────────────────
function GapAnalysisPanel({ jabker, evidence }: { jabker: string; evidence: EvidenceItem[] }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["skkUnits", jabker],
    queryFn: () => fetchSkkUnits(jabker),
    enabled: !!jabker && open,
  });

  const evidenceByUnit: Record<string, number> = {};
  evidence.forEach((e) => {
    if (e.skkUnitCode) evidenceByUnit[e.skkUnitCode] = (evidenceByUnit[e.skkUnitCode] ?? 0) + 1;
  });

  const coveredCount = data?.units?.filter((u) => (evidenceByUnit[u.code] ?? 0) > 0).length ?? 0;
  const totalCount = data?.units?.length ?? 0;

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors text-left">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Gap Analisis SKK</span>
          {totalCount > 0 && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              coveredCount === totalCount ? "bg-green-100 text-green-700" :
              coveredCount === 0 ? "bg-red-100 text-red-700" :
              "bg-amber-100 text-amber-700"
            }`}>
              {coveredCount}/{totalCount} unit tercakup
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          {!jabker ? (
            <p className="text-xs text-muted-foreground italic py-2">Jabatan kerja belum ditetapkan — mulai sesi baru dengan memilih jabker.</p>
          ) : isLoading ? (
            <div className="flex items-center gap-2 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Memuat unit SKK...</span>
            </div>
          ) : !data?.units?.length ? (
            <p className="text-xs text-muted-foreground italic py-2">Tidak ada data SKK untuk jabatan kerja ini.</p>
          ) : (
            <>
              <div className="mb-3">
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${totalCount > 0 ? (coveredCount / totalCount) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {coveredCount} dari {totalCount} unit SKK sudah ada buktinya
                </p>
              </div>
              <div className="space-y-1.5">
                {data.units.map((unit) => {
                  const count = evidenceByUnit[unit.code] ?? 0;
                  return (
                    <div key={unit.code} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs ${
                      count > 0 ? "border-green-200 bg-green-50" : "border-border bg-muted/30"
                    }`}>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${count > 0 ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-[10px] text-muted-foreground">{unit.code}</span>
                        <p className={`font-medium leading-tight ${count > 0 ? "text-green-800" : "text-foreground/70"}`}>{unit.name}</p>
                      </div>
                      {count > 0 && (
                        <span className="text-[10px] bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                          {count} bukti
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Evidence Panel ───────────────────────────────────────────────────────────
type EvidFilter = "all" | "skk" | "dialog";

function EvidencePanel({ convId, jabker, evidence, onRefresh }: {
  convId: number;
  jabker: string;
  evidence: EvidenceItem[];
  onRefresh: () => void;
}) {
  const [wizardType, setWizardType] = useState<"learning" | "work_experience" | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(evidence.length > 0);
  const [filter, setFilter] = useState<EvidFilter>("all");
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<EvidenceItem | null>(null);
  const qc = useQueryClient();

  function applyFilter(items: EvidenceItem[]): EvidenceItem[] {
    if (filter === "skk") return items.filter(e => e.skkUnitCode || e.skkNotes);
    if (filter === "dialog") return items.filter(e => e.socratiCompleted);
    return items;
  }

  const learning = applyFilter(evidence.filter((e) => e.type === "learning"));
  const workExp = applyFilter(evidence.filter((e) => e.type === "work_experience"));

  const handleSave = async (data: {
    category: string; title: string; url?: string; description?: string;
    skkNotes?: string; skkUnitCode?: string; skkUnitName?: string;
    socratiDialog: SocratiDialog; socratiCompleted: boolean;
  }) => {
    if (!wizardType) return;
    setSaving(true);
    try {
      await createEvidence(convId, { type: wizardType, ...data });
      qc.invalidateQueries({ queryKey: ["conversation", convId] });
      setWizardType(null);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: EvidenceItem) => {
    await deleteEvidence(convId, item.id);
    setDeleteConfirmItem(null);
    qc.invalidateQueries({ queryKey: ["conversation", convId] });
    onRefresh();
  };

  return (
    <>
      {wizardType && (
        <AddEvidenceWizard
          type={wizardType}
          jabker={jabker}
          onClose={() => setWizardType(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in slide-in-from-bottom-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
              <Trash2 className="w-5 h-5 text-destructive" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Hapus serpihan ini?</h3>
            <p className="text-sm text-muted-foreground mb-1 truncate font-medium">"{deleteConfirmItem.title}"</p>
            {deleteConfirmItem.socratiCompleted && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Serpihan ini sudah melewati Dialog Sokratik lengkap — data dialog akan ikut terhapus.
              </p>
            )}
            {!deleteConfirmItem.socratiCompleted && <div className="mb-4" />}
            <div className="flex gap-2.5">
              <button onClick={() => setDeleteConfirmItem(null)}
                className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                Batal
              </button>
              <button onClick={() => handleDelete(deleteConfirmItem)}
                className="flex-1 rounded-xl bg-destructive text-destructive-foreground py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity">
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-border bg-muted/30">
        {/* Panel header */}
        <button
          onClick={() => setExpanded((p) => !p)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Serpihan Bukti PKB</span>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {evidence.length} serpihan
            </span>
            {evidence.some(e => e.socratiCompleted) && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {evidence.filter(e => e.socratiCompleted).length} terdialog
              </span>
            )}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {expanded && (
          <>
            {/* Filter tabs */}
            {evidence.length > 0 && (
              <div className="px-4 pb-2 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3 h-3 text-muted-foreground shrink-0" />
                {([
                  { id: "all", label: `Semua (${evidence.length})` },
                  { id: "skk", label: `Sudah SKK (${evidence.filter(e => e.skkUnitCode || e.skkNotes).length})` },
                  { id: "dialog", label: `Sudah Dialog (${evidence.filter(e => e.socratiCompleted).length})` },
                ] as { id: EvidFilter; label: string }[]).map(tab => (
                  <button key={tab.id} onClick={() => setFilter(tab.id)}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all ${
                      filter === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            <div className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Pembelajaran PKB column */}
                <div className="min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <h4 className="text-xs font-semibold text-foreground">Pembelajaran PKB</h4>
                      <span className="text-[10px] text-muted-foreground">({learning.length})</span>
                    </div>
                    <button onClick={() => setWizardType("learning")}
                      className="flex items-center gap-1 text-[10px] text-blue-600 font-semibold hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors">
                      <Plus className="w-3 h-3" /> Tambah
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2">
                    {LEARNING_CATEGORIES.map((c) => {
                      const Icon = c.icon;
                      return (
                        <span key={c.id} className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full ${c.bg} ${c.color} font-medium`}>
                          <Icon className="w-2.5 h-2.5" /> {c.label}
                        </span>
                      );
                    })}
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                    {learning.length === 0 ? (
                      <div className="border-2 border-dashed border-border rounded-xl p-4 text-center">
                        <Youtube className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1" />
                        <p className="text-[11px] text-muted-foreground">Belum ada sumber.</p>
                        <p className="text-[10px] text-muted-foreground/70">Tambahkan YouTube,<br />webinar, atau diklatkerja</p>
                      </div>
                    ) : (
                      learning.map((item) => (
                        <EvidenceCard key={item.id} item={item} convId={convId} onDelete={() => setDeleteConfirmItem(item)} onRefresh={onRefresh} />
                      ))
                    )}
                  </div>
                </div>

                {/* Pengalaman Kerja column */}
                <div className="min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-teal-500" />
                      <h4 className="text-xs font-semibold text-foreground">Pengalaman Kerja</h4>
                      <span className="text-[10px] text-muted-foreground">({workExp.length})</span>
                    </div>
                    <button onClick={() => setWizardType("work_experience")}
                      className="flex items-center gap-1 text-[10px] text-teal-600 font-semibold hover:text-teal-700 bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded-lg transition-colors">
                      <Plus className="w-3 h-3" /> Tambah
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2">
                    {WORK_CATEGORIES.map((c) => {
                      const Icon = c.icon;
                      return (
                        <span key={c.id} className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full ${c.bg} ${c.color} font-medium`}>
                          <Icon className="w-2.5 h-2.5" /> {c.label}
                        </span>
                      );
                    })}
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                    {workExp.length === 0 ? (
                      <div className="border-2 border-dashed border-border rounded-xl p-4 text-center">
                        <HardHat className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1" />
                        <p className="text-[11px] text-muted-foreground">Belum ada bukti.</p>
                        <p className="text-[10px] text-muted-foreground/70">Tambahkan screenshot<br />ESIMPAN, foto, atau dokumen</p>
                      </div>
                    ) : (
                      workExp.map((item) => (
                        <EvidenceCard key={item.id} item={item} convId={convId} onDelete={() => setDeleteConfirmItem(item)} onRefresh={onRefresh} />
                      ))
                    )}
                  </div>
                </div>
              </div>

              {evidence.length > 0 && (
                <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <Shield className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-[11px] text-amber-800">
                    <span className="font-semibold">{evidence.length} serpihan</span> akan digunakan sebagai bahan Exum PKB.
                    {evidence.filter(e => e.socratiCompleted).length > 0 && (
                      <span className="text-green-700"> {evidence.filter(e => e.socratiCompleted).length} sudah terdialog Pak Budi.</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Gap Analysis */}
            <GapAnalysisPanel jabker={jabker} evidence={evidence} />
          </>
        )}
      </div>
    </>
  );
}

// ─── Main Chat Page ───────────────────────────────────────────────────────────
export default function ChatPage() {
  const [match, params] = useRoute("/chat/:id");
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const id = match ? parseInt(params!.id, 10) : 0;

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [currentPhase, setCurrentPhase] = useState("profiling");
  const [exum, setExum] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [showExumModal, setShowExumModal] = useState(false);
  const [phaseToast, setPhaseToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [paywall, setPaywall] = useState<{ msg: string; canUpgrade: boolean } | null>(null);
  const [contextFailureBanner, setContextFailureBanner] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  const [copiedMsgId, setCopiedMsgId] = useState<number | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [studioBannerDismissed, setStudioBannerDismissedRaw] = useState(() => {
    // Initialise from localStorage so the banner never re-appears for a jabker
    // the user has already dismissed — even across page reloads.
    return false; // real value loaded in the jabker effect below
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { data: conv, isLoading, refetch } = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => getConversation(id),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });

  const dismissStudioBanner = useCallback(() => {
    if (conv?.jabker) {
      try { localStorage.setItem(`STUDIO_NUDGE_DISMISSED_${conv.jabker}`, "1"); } catch {}
    }
    setStudioBannerDismissedRaw(true);
  }, [conv?.jabker]);

  const { data: personaData } = useQuery({
    queryKey: ["personas"],
    queryFn: listPersonas,
    staleTime: 60 * 60 * 1000,
  });
  const activePersona = personaData?.personas.find((p) => p.id === conv?.personaId);

  // Message usage — refreshed after each send so the indicator stays current
  const { data: usage } = useQuery({
    queryKey: ["my-usage"],
    queryFn: getMyUsage,
    staleTime: 60 * 1000,         // 1-minute cache
    refetchInterval: 5 * 60 * 1000, // background refresh every 5 min
  });

  // ── Countdown timer for when messages are exhausted (#91 + #92) ──────────
  // Uses serverNow (not device clock) so the countdown is accurate even when
  // the user's device clock differs from the server (#92).
  const [countdown, setCountdown] = useState<string | null>(null);
  const usageFetchedAt = useRef<number>(0);
  useEffect(() => {
    if (!usage?.resetAt || !usage.serverNow) { setCountdown(null); return; }
    usageFetchedAt.current = Date.now();
    const resetDelay = new Date(usage.resetAt).getTime() - new Date(usage.serverNow).getTime();
    const tick = () => {
      const msLeft = Math.max(0, resetDelay - (Date.now() - usageFetchedAt.current));
      const totalSec = Math.ceil(msLeft / 1000);
      const mm = Math.floor(totalSec / 60).toString().padStart(2, "0");
      const ss = (totalSec % 60).toString().padStart(2, "0");
      setCountdown(msLeft <= 0 ? null : `${mm}:${ss}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [usage?.resetAt, usage?.serverNow]);

  const { data: plan } = useQuery({
    queryKey: ["my-plan"],
    queryFn: getMyPlan,
    staleTime: 5 * 60 * 1000,
  });

  // Studio Kompetensi nudge — server canonicalises the jabker via findJabkerGroup
  // so the match is always exact (by jabkerId). Gate banner only on success so we
  // never falsely nudge during loading or after a fetch error.
  const {
    data: hasAnalysisForJabker,
    status: analysisCheckStatus,
  } = useQuery({
    queryKey: ["competency-analysis-check", conv?.jabker],
    queryFn: () => checkCompetencyAnalysisForJabker(conv!.jabker!),
    enabled: !!conv?.jabker,
    staleTime: 5 * 60 * 1000,
  });
  const showStudioBanner =
    !!conv?.jabker &&
    analysisCheckStatus === "success" &&
    hasAnalysisForJabker === false &&
    !studioBannerDismissed;

  // Sync banner dismissal state from localStorage whenever the jabker changes.
  // A dismissed jabker stays dismissed across reloads; switching to a new jabker
  // checks localStorage for that jabker (defaulting to not-dismissed).
  useEffect(() => {
    if (!conv?.jabker) { setStudioBannerDismissedRaw(false); return; }
    try {
      setStudioBannerDismissedRaw(localStorage.getItem(`STUDIO_NUDGE_DISMISSED_${conv.jabker}`) === "1");
    } catch { setStudioBannerDismissedRaw(false); }
  }, [conv?.jabker]);

  useEffect(() => {
    if (conv?.phase) setCurrentPhase(conv.phase);
  }, [conv?.phase]);

  useEffect(() => {
    if (conv?.exumContent && !exum) setExum(conv.exumContent);
  }, [conv?.exumContent]);

  // Auto-send greeting when a brand-new session has no messages yet
  const autoGreetedRef = useRef(false);
  useEffect(() => {
    if (!conv || autoGreetedRef.current || streaming) return;
    if (conv.messages && conv.messages.length === 0) {
      autoGreetedRef.current = true;
      // Consume the marketplace context on first render of a fresh session.
      // consumeMarketplaceInterviewCtx() clears the key so it is never replayed.
      const mktCtx = consumeMarketplaceInterviewCtx();
      const greeting = mktCtx ? buildMarketplaceGreeting(mktCtx) : AUTO_GREETING;
      // Small delay so the chat area has rendered first
      setTimeout(() => {
        setStreaming(true);
        setStreamText("");
        abortRef.current = streamMessage(
          id,
          greeting,
          (chunk) => setStreamText((prev) => prev + chunk),
          (phase) => {
            setStreaming(false);
            setStreamText("");
            setCurrentPhase(phase);
            qc.invalidateQueries({ queryKey: ["conversation", id] });
            qc.invalidateQueries({ queryKey: ["conversations"] });
            qc.invalidateQueries({ queryKey: ["my-usage"] });
            setTimeout(() => textareaRef.current?.focus(), 50);
          },
          (err) => { setStreaming(false); setStreamText(`Terjadi kesalahan: ${err}`); },
          () => setContextFailureBanner(true),
        );
      }, 400);
    }
  }, [conv?.id, conv?.messages?.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conv?.messages, streamText]);

  const sendMsg = useCallback((directMsg?: string) => {
    const content = (directMsg ?? input).trim();
    if (!content || streaming) return;
    setInput("");
    setStreaming(true);
    setStreamText("");
    setContextFailureBanner(false);
    if (abortRef.current) abortRef.current();
    abortRef.current = streamMessage(
      id, content,
      (chunk) => setStreamText((prev) => prev + chunk),
      (phase) => {
        setStreaming(false);
        setStreamText("");
        setCurrentPhase((prev) => {
          if (phase !== prev) {
            setPhaseToast(phase);
            setTimeout(() => setPhaseToast(null), 4500);
          }
          return phase;
        });
        qc.invalidateQueries({ queryKey: ["conversation", id] });
        qc.invalidateQueries({ queryKey: ["conversations"] });
        qc.invalidateQueries({ queryKey: ["my-usage"] });
        setTimeout(() => textareaRef.current?.focus(), 50);
      },
      (err) => { setStreaming(false); setStreamText(`Terjadi kesalahan: ${err}`); textareaRef.current?.focus(); },
      () => setContextFailureBanner(true),
    );
  }, [id, input, streaming, qc]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };

  const startEditTitle = () => {
    setTitleDraft(conv?.title ?? "");
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.select(), 50);
  };

  const commitTitle = async () => {
    const newTitle = titleDraft.trim();
    if (!newTitle || newTitle === conv?.title) { setEditingTitle(false); return; }
    setSavingTitle(true);
    try {
      await updateConversation(id, { title: newTitle });
      qc.invalidateQueries({ queryKey: ["conversation", id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } finally {
      setSavingTitle(false);
      setEditingTitle(false);
    }
  };

  const handleGenerateExum = async () => {
    setGenerating(true);
    try {
      const result = await generateExum(id);
      setExum(result.content);
      setCurrentPhase("done");
      qc.invalidateQueries({ queryKey: ["conversation", id] });
    } catch (err) {
      if (err instanceof PlanLimitError) {
        setPaywall({ msg: err.message, canUpgrade: true });
      } else {
        setPaywall({ msg: "Gagal membuat Executive Summary. Silakan coba lagi.", canUpgrade: false });
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleAdvancePhase = async () => {
    setAdvancing(true);
    try {
      const result = await advancePhase(id);
      setCurrentPhase((prev) => {
        if (result.phase !== prev) {
          setPhaseToast(result.phase);
          setTimeout(() => setPhaseToast(null), 4500);
        }
        return result.phase;
      });
      qc.invalidateQueries({ queryKey: ["conversation", id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch {
      // silently ignore if cannot advance
    } finally {
      setAdvancing(false);
    }
  };

  const handleDownload = () => {
    if (!exum) return;
    const blob = new Blob([exum], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Executive_Summary_PKB_${conv?.jabker?.replace(/\s+/g, "_") || "TKK"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportTranscript = () => {
    if (!messages.length) return;
    const jabker = conv?.jabker ?? "TKK";
    const mode = conv?.mode === "A" ? "Pengalaman Kerja" : conv?.mode === "B" ? "Hasil Belajar" : "Hybrid";
    const lines: string[] = [
      `# Transkrip Wawancara Pak Budi`,
      ``,
      `**Jabatan Kerja:** ${jabker}`,
      `**Jenjang:** ${conv?.jenjang ?? "-"}`,
      `**Mode:** ${mode}`,
      `**Fase terakhir:** ${PHASE_LABELS[conv?.phase ?? "profiling"] ?? conv?.phase}`,
      `**Total serpihan:** ${evidence.length}`,
      ``,
      `---`,
      ``,
    ];
    messages
      .filter(m => !(m.role === "user" && m.content === AUTO_GREETING))
      .forEach(m => {
        const time = formatTime(m.createdAt);
        const speaker = m.role === "assistant" ? "**Pak Budi**" : "**Anda**";
        lines.push(`### ${speaker} — ${time}`);
        lines.push(``);
        lines.push(m.content);
        lines.push(``);
      });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Transkrip_PKB_${jabker.replace(/\s+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyExum = async () => {
    if (!exum) return;
    await navigator.clipboard.writeText(exum);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    if (!exum) return;
    const docTitle = `Executive Summary PKB — ${conv?.jabker ?? "TKK"}`;
    const bodyHtml = mdToHtml(exum);
    const metaLine = `<div class="meta">Jabatan Kerja: <strong>${mdEsc(conv?.jabker ?? "-")}</strong> &nbsp;|&nbsp; ${mdEsc(conv?.jenjang ?? "")} &nbsp;|&nbsp; ${mdEsc(docTitle)}</div>`;
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) { alert("Izinkan popup untuk mencetak."); return; }
    win.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>${mdEsc(docTitle)}</title><style>${EXUM_PRINT_CSS}</style></head><body>${metaLine}\n${bodyHtml}<script>window.addEventListener("load",function(){ window.print(); });<\/script></body></html>`);
    win.document.close();
  };

  const handleExportHtml = () => {
    if (!exum) return;
    const jabkerSlug = conv?.jabker?.replace(/\s+/g, "_") || "TKK";
    const docTitle = `Executive Summary PKB — ${conv?.jabker ?? "TKK"}`;
    const bodyHtml = mdToHtml(exum);
    const metaLine = `<div class="meta">Jabatan Kerja: <strong>${mdEsc(conv?.jabker ?? "-")}</strong> &nbsp;|&nbsp; ${mdEsc(conv?.jenjang ?? "")} &nbsp;|&nbsp; ${mdEsc(docTitle)}</div>`;
    const html = `<!DOCTYPE html>\n<html lang="id">\n<head>\n<meta charset="utf-8">\n<title>${mdEsc(docTitle)}</title>\n<style>${EXUM_PRINT_CSS}\nbody { margin: 20mm; }\n</style>\n</head>\n<body>\n${metaLine}\n${bodyHtml}\n</body>\n</html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Executive_Summary_PKB_${jabkerSlug}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exumWordCount = exum ? exum.split(/\s+/).filter(Boolean).length : 0;

  const phaseIdx = PHASE_STEPS.indexOf(currentPhase);
  const canGenerate = currentPhase === "synthesis" || currentPhase === "done";
  const evidence: EvidenceItem[] = conv?.evidence ?? [];
  const messages: Message[] = conv?.messages ?? [];

  if (!match) return null;
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate("/")}
          className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-1.5">
              <input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                onBlur={commitTitle}
                className="text-sm font-semibold bg-muted rounded-lg px-2 py-0.5 text-foreground w-full min-w-0 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {savingTitle && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />}
            </div>
          ) : (
            <div className="flex items-center gap-1 group/title cursor-pointer" onClick={startEditTitle} title="Klik untuk ubah nama sesi">
              <h1 className="text-sm font-semibold text-foreground truncate">{conv?.title ?? "Sesi Wawancara"}</h1>
              <Pencil className="w-3 h-3 text-muted-foreground/0 group-hover/title:text-muted-foreground transition-colors shrink-0" />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {conv?.jabker && <span>{conv.jabker} · </span>}
            {conv?.jenjang && <span>{conv.jenjang} · </span>}
            Mode {conv?.mode === "A" ? "Pengalaman Kerja" : conv?.mode === "B" ? "Hasil Belajar" : "Hybrid"}
            {activePersona && (
              <span className="inline-flex items-center gap-1 ml-1.5 px-1.5 py-0.5 rounded-md bg-primary/10 text-[10px] font-medium text-primary align-middle" title={activePersona.title}>
                <HardHat className="w-2.5 h-2.5" />{activePersona.name}
              </span>
            )}
            {conv?.model && (
              <span className="inline-flex items-center gap-1 ml-1.5 px-1.5 py-0.5 rounded-md bg-muted text-[10px] font-medium text-foreground/70 align-middle">
                <Cpu className="w-2.5 h-2.5" />{conv.model}
              </span>
            )}
          </p>
        </div>

        {/* Phase stepper */}
        <div className="hidden lg:flex items-center gap-1">
          {PHASE_STEPS.slice(0, 5).map((p, i) => (
            <div key={p} className="flex items-center gap-1">
              <div title={PHASE_LABELS[p]}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  i < phaseIdx ? "bg-primary text-primary-foreground" : i === phaseIdx ? "bg-primary text-primary-foreground phase-pulse" : "bg-muted text-muted-foreground"
                }`}>
                {i < phaseIdx ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < 4 && <div className={`w-6 h-0.5 rounded-full ${i < phaseIdx ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${
          currentPhase === "done" ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary"
        }`}>
          {PHASE_LABELS[currentPhase] || currentPhase}
        </span>

        <button
          onClick={handleExportTranscript}
          disabled={messages.length === 0}
          title="Unduh transkrip percakapan (.md)"
          className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 shrink-0">
          <Download className="w-4 h-4" />
        </button>

        {currentPhase !== "done" && currentPhase !== "synthesis" && (
          <button onClick={handleAdvancePhase} disabled={advancing || streaming}
            title="Lewati ke fase berikutnya secara manual"
            className="flex items-center gap-1 bg-muted text-muted-foreground px-2.5 py-1.5 rounded-xl text-xs font-medium hover:bg-muted/80 hover:text-foreground transition-colors disabled:opacity-40 shrink-0">
            {advancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Lanjut Fase</span>
          </button>
        )}
        {canGenerate && !exum && (
          <button onClick={handleGenerateExum} disabled={generating}
            className="flex items-center gap-1.5 bg-accent text-accent-foreground px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 shrink-0">
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            {generating ? "Membuat..." : "Generate Exum"}
          </button>
        )}
        {exum && (
          <button onClick={() => setShowExumModal(true)}
            className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-90 shrink-0">
            <FileText className="w-3.5 h-3.5" /> Lihat Exum
          </button>
        )}
      </header>

      {paywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPaywall(null)}>
          <div className="bg-card rounded-2xl border border-border max-w-sm w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-foreground">{paywall.canUpgrade ? "Beli Kredit Exum" : "Terjadi Kesalahan"}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">{paywall.msg}</p>
            <div className="flex gap-2">
              {paywall.canUpgrade && SCALEV_CHECKOUT_URL && (
                <a href={SCALEV_CHECKOUT_URL} target="_blank" rel="noopener noreferrer"
                  className="flex-1 text-center bg-accent text-accent-foreground rounded-xl px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity">
                  Beli 1 Exum
                </a>
              )}
              {paywall.canUpgrade && !SCALEV_CHECKOUT_URL && (
                <span className="flex-1 text-center text-xs text-muted-foreground self-center">Hubungi admin untuk membeli kredit Exum.</span>
              )}
              <button onClick={() => setPaywall(null)}
                className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Panel */}
      <EvidencePanel
        convId={id}
        jabker={conv?.jabker ?? ""}
        evidence={evidence}
        onRefresh={() => refetch()}
      />

      {/* Phase transition toast */}
      {phaseToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5 bg-primary text-primary-foreground px-5 py-3 rounded-2xl shadow-xl text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Fase wawancara naik ke: <strong>{PHASE_LABELS[phaseToast] ?? phaseToast}</strong></span>
          </div>
        </div>
      )}

      {/* Exum full-screen modal */}
      {showExumModal && exum && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex flex-col animate-in fade-in">
          <div className="flex items-center justify-between px-6 py-4 bg-card border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <div>
                <h2 className="font-semibold text-foreground text-sm">Executive Summary PKB</h2>
                <p className="text-xs text-muted-foreground">{conv?.jabker} · {exumWordCount.toLocaleString()} kata</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleCopyExum}
                className="flex items-center gap-1.5 bg-muted text-foreground px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-muted/80 transition-colors">
                {copied ? <><CheckCheck className="w-3.5 h-3.5 text-green-600" /> Tersalin!</> : <><Copy className="w-3.5 h-3.5" /> Salin</>}
              </button>
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 bg-muted text-foreground px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-muted/80 transition-colors">
                <Printer className="w-3.5 h-3.5" /> Cetak PDF
              </button>
              <button onClick={handleExportHtml}
                className="flex items-center gap-1.5 bg-muted text-foreground px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-muted/80 transition-colors">
                <Download className="w-3.5 h-3.5" /> Word (.html)
              </button>
              <button onClick={handleDownload}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-90">
                <Download className="w-3.5 h-3.5" /> Markdown
              </button>
              <button onClick={() => setShowExumModal(false)}
                className="p-2 rounded-xl hover:bg-muted transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-background">
            <div className="max-w-4xl mx-auto bg-card border border-border rounded-2xl p-8 shadow-sm">
              <div className="prose prose-base max-w-none text-foreground [&_h1]:text-2xl [&_h2]:text-xl [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-2 [&_h3]:text-base [&_h3]:font-bold [&_p]:text-justify [&_p]:leading-relaxed">
                <ReactMarkdown>{exum}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exum result banner */}
      {exum && (
        <div className="border-b border-green-200 bg-green-50/60 px-4 py-2.5 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-2 flex-wrap">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <span className="text-sm font-semibold text-green-800 flex-1">Executive Summary PKB berhasil dibuat</span>
            <span className="text-xs text-green-700">{exumWordCount.toLocaleString()} kata</span>
            <button onClick={() => setShowExumModal(true)}
              className="flex items-center gap-1.5 bg-white border border-green-300 text-green-700 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-green-50 transition-colors">
              <FileText className="w-3.5 h-3.5" /> Lihat
            </button>
            <button onClick={handleCopyExum}
              className="flex items-center gap-1.5 bg-white border border-green-300 text-green-700 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-green-50 transition-colors">
              {copied ? <><CheckCheck className="w-3.5 h-3.5" /> Tersalin!</> : <><Copy className="w-3.5 h-3.5" /> Salin</>}
            </button>
            <button onClick={handleDownload}
              className="flex items-center gap-1.5 bg-white border border-green-300 text-green-700 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-green-50 transition-colors">
              <Download className="w-3.5 h-3.5" /> Unduh .md
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 bg-white border border-green-300 text-green-700 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-green-50 transition-colors">
              <Printer className="w-3.5 h-3.5" /> Cetak PDF
            </button>
            <button onClick={handleExportHtml}
              className="flex items-center gap-1.5 bg-white border border-green-300 text-green-700 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-green-50 transition-colors">
              <Download className="w-3.5 h-3.5" /> Word (.html)
            </button>
            <button onClick={() => { setExum(null); handleGenerateExum(); }} disabled={generating}
              title="Generate ulang Exum (misalnya setelah menambah serpihan baru)"
              className="flex items-center gap-1.5 bg-white border border-amber-300 text-amber-700 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-amber-50 transition-colors disabled:opacity-50">
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              {generating ? "Membuat ulang..." : "Regenerate"}
            </button>
          </div>
        </div>
      )}

      {/* Studio Kompetensi nudge banner */}
      {showStudioBanner && (
        <div className="border-b border-amber-200 bg-amber-50/70 px-4 py-2.5 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-2 flex-wrap">
            <BarChart3 className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-sm text-amber-900 flex-1">
              <strong>Tingkatkan kualitas saran AI</strong> — jalankan Studio Kompetensi untuk jabker <em>{conv?.jabker}</em> agar Pak Budi bisa memberikan panduan yang lebih spesifik dan terarah.
            </span>
            <a
              href="/studio"
              className="flex items-center gap-1.5 bg-white border border-amber-300 text-amber-700 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-amber-50 transition-colors shrink-0"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Buka Studio Kompetensi
            </a>
            <button
              onClick={dismissStudioBanner}
              title="Tutup notifikasi ini"
              className="text-amber-500 hover:text-amber-700 transition-colors shrink-0 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-5 relative"
        onScroll={() => {
          const el = messagesContainerRef.current;
          if (!el) return;
          setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
        }}
      >
        {showScrollBtn && (
          <button
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="fixed bottom-24 right-6 z-20 w-9 h-9 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity animate-in fade-in slide-in-from-bottom-2">
            <ChevronDown className="w-5 h-5" />
          </button>
        )}
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && !streaming && (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-8 h-8 text-primary" />
              </div>
              <p className="font-semibold text-foreground mb-1">Pak Budi siap memulai wawancara</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
                Tambahkan serpihan bukti di panel atas untuk memperkuat Exum Anda, lalu mulai wawancara.
              </p>
              <button
                onClick={() => sendMsg("Halo Pak Budi, saya siap memulai wawancara PKB saya.")}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-2xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm">
                <Send className="w-4 h-4" />
                Mulai Wawancara dengan Pak Budi
              </button>
              <p className="text-[11px] text-muted-foreground mt-3">
                atau ketik langsung di kotak chat di bawah
              </p>
            </div>
          )}

          {messages
            .filter(msg => !(msg.role === "user" && msg.content === AUTO_GREETING))
            .map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} msg-enter group/msg`}>
              <div className={`flex ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} items-end gap-2.5`}>
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
                    <span className="text-white text-[10px] font-bold">PB</span>
                  </div>
                )}
                <div className={`relative max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card border border-border text-foreground rounded-tl-sm shadow-sm"
                }`}>
                  {msg.role === "assistant" ? (
                    <>
                      <div className="prose prose-sm max-w-none text-foreground [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2 [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:mb-1">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(msg.content);
                          setCopiedMsgId(msg.id);
                          setTimeout(() => setCopiedMsgId(null), 1800);
                        }}
                        title="Salin pesan"
                        className="absolute -top-2.5 -right-2.5 opacity-0 group-hover/msg:opacity-100 transition-opacity w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center hover:bg-background shadow-sm">
                        {copiedMsgId === msg.id
                          ? <CheckCheck className="w-3 h-3 text-green-500" />
                          : <Copy className="w-3 h-3 text-muted-foreground" />}
                      </button>
                    </>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <span className="text-muted-foreground text-[9px] font-bold">Anda</span>
                  </div>
                )}
              </div>
              <p className={`text-[10px] text-muted-foreground/50 mt-1 ${msg.role === "user" ? "pr-10" : "pl-10"}`}>
                {formatTime(msg.createdAt)}
              </p>
            </div>
          ))}

          {/* Streaming bubble */}
          {(streaming || streamText) && (
            <div className="flex justify-start msg-enter">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 mr-2.5 mt-1">
                <span className="text-white text-[10px] font-bold">PB</span>
              </div>
              <div className="max-w-[78%] bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 text-sm shadow-sm">
                {streamText ? (
                  <div className="prose prose-sm max-w-none text-foreground [&>p]:mb-2">
                    <ReactMarkdown>{streamText}</ReactMarkdown>
                    {streaming && <span className="cursor-blink ml-0.5 text-primary font-bold">|</span>}
                  </div>
                ) : (
                  <div className="flex gap-1.5 items-center py-1">
                    <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:0ms]" />
                    <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:150ms]" />
                    <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Exum Outline Editor — shown at synthesis phase before Exum is generated */}
      {currentPhase === "synthesis" && !exum && id > 0 && (
        <div className="border-t border-border bg-card/50 px-4 py-4 shrink-0">
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            {/* Quiz performance summary — so users see what the AI already knows */}
            <QuizSummaryPanel jabker={conv?.jabker} />
            <ExumOutlineEditor
              conversationId={id}
              onApproved={handleGenerateExum}
            />
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border bg-card px-4 pt-2.5 pb-3 shrink-0">
        {/* Quick reply chips */}
        {currentPhase !== "done" && !streaming && (() => {
          const chips: Record<string, string[]> = {
            profiling: ["Ya, saya siap", "Boleh dijelaskan dulu?", "Saya TKK Ahli"],
            context: ["Lanjutkan ke berikutnya", "Saya punya contoh konkret", "Izin tambahkan detail"],
            core_interview: ["Saya jelaskan prosesnya", "Tantangannya adalah...", "Hasilnya terukur"],
            evidence: ["Ada data kuantitatifnya", "Angkanya sekitar...", "Buktinya di ESIMPAN"],
            synthesis: ["Sudah lengkap semua", "Ada yang perlu ditambah", "Siap generate Exum"],
          };
          const list = chips[currentPhase] ?? [];
          if (!list.length) return null;
          return (
            <div className="flex gap-1.5 mb-2 flex-wrap">
              <Zap className="w-3 h-3 text-muted-foreground shrink-0 mt-1" />
              {list.map(chip => (
                <button key={chip} onClick={() => setInput(prev => prev ? prev + " " + chip : chip)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors border border-border">
                  {chip}
                </button>
              ))}
            </div>
          );
        })()}
        <div className="max-w-3xl mx-auto flex gap-2.5 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming || generating}
            placeholder={
              currentPhase === "done"
                ? "Tanya Pak Budi soal isi Exum, atau minta klarifikasi..."
                : "Ketik jawaban Anda... (Enter untuk kirim, Shift+Enter untuk baris baru)"
            }
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 max-h-32 overflow-y-auto"
            style={{ minHeight: "44px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 128) + "px";
            }}
          />
          <button
            onClick={() => sendMsg()}
            disabled={!input.trim() || streaming || generating}
            className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-40 hover:opacity-90 transition-opacity">
            {streaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        {/* Context failure banner — shown when a personalisation block failed server-side */}
        {contextFailureBanner && (
          <div className="mt-2 max-w-3xl mx-auto flex items-start gap-2 rounded-xl px-3 py-2 text-xs border bg-amber-50 border-amber-200 text-amber-800">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="flex-1">
              Beberapa data profil Anda gagal dimuat sementara ini — Pak Budi mungkin memberikan saran yang lebih umum dari biasanya. Coba kirim pesan lagi atau muat ulang halaman.
            </span>
            <button onClick={() => setContextFailureBanner(false)} className="shrink-0 hover:opacity-70">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Usage + credit indicators */}
        {usage && (() => {
          const pct = usage.remaining / usage.limit;          // 1.0 = full, 0 = empty
          const low     = usage.remaining <= 5;
          const veryLow = usage.remaining <= 2;
          const exhausted = usage.remaining <= 0;
          // resetAt comes directly from the server: the exact moment the oldest
          // in-window message expires out of the rolling 1-hour window.
          const resetAt = usage.resetAt ? new Date(usage.resetAt) : null;
          const resetStr = resetAt
            ? `${resetAt.getHours().toString().padStart(2,"0")}:${resetAt.getMinutes().toString().padStart(2,"0")}`
            : "—";

          const barColor = exhausted ? "bg-red-500"
            : veryLow  ? "bg-red-400"
            : low       ? "bg-amber-400"
            : pct > 0.5 ? "bg-emerald-500"
            :              "bg-amber-400";

          const textColor = exhausted ? "text-red-600 font-semibold"
            : veryLow  ? "text-red-500 font-medium"
            : low       ? "text-amber-600"
            :              "text-muted-foreground";

          return (
            <div className="mt-2.5 space-y-1.5 max-w-3xl mx-auto">
              {/* Prominent warning banner when ≤5 messages left */}
              {low && !exhausted && (
                <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium border ${veryLow ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {veryLow
                      ? `Hampir habis — hanya ${usage.remaining} pesan tersisa sebelum limit reset pukul ${resetStr}.`
                      : `${usage.remaining} pesan tersisa untuk jam ini. Limit reset pukul ${resetStr}.`}
                  </span>
                  {usage.limit <= 30 && (
                    <a href="/kredits" className="ml-auto shrink-0 underline underline-offset-2 hover:opacity-80">Upgrade Pro →</a>
                  )}
                </div>
              )}
              {exhausted && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium border bg-red-50 border-red-200 text-red-700">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {countdown
                      ? <>Batas pesan tercapai. Reset dalam <span className="font-mono tabular-nums">{countdown}</span>.</>
                      : <>Batas pesan tercapai. Limit reset pukul {resetStr}.</>}
                  </span>
                  {usage.limit <= 30 && (
                    <a href="/kredits" className="ml-auto shrink-0 underline underline-offset-2 hover:opacity-80">Upgrade Pro →</a>
                  )}
                </div>
              )}
              {/* Progress bar + stats row */}
              <div className="flex items-center gap-2.5 px-0.5">
                {/* Bar */}
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${Math.max(0, Math.min(100, pct * 100))}%` }}
                  />
                </div>
                {/* Text */}
                <span className={`text-[11px] tabular-nums shrink-0 ${textColor}`}>
                  {usage.remaining}/{usage.limit} pesan/jam
                </span>
                {/* Reset time — always visible */}
                <span className="text-[11px] text-muted-foreground shrink-0">
                  · reset {resetStr}
                </span>
                {/* Exum credit */}
                {plan && !plan.canGenerate && (
                  <span className="text-[11px] text-amber-500 shrink-0">· Kredit Exum habis</span>
                )}
                {plan && plan.canGenerate && (
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    · {plan.freeExumUsed ? `Exum: ${plan.exumCredits} kr` : "Exum gratis"}
                  </span>
                )}
              </div>
            </div>
          );
        })()}
        <p className="text-center text-[11px] text-muted-foreground mt-1">
          Dijawab oleh AI · Periksa kembali sebelum digunakan · Nilai Exum: maks. 25 SKPK
        </p>
      </div>
    </div>
  );
}
