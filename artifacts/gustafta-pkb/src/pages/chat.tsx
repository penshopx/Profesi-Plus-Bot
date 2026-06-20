import { useState, useRef, useEffect, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Send, Loader2, Download, FileText, CheckCircle2,
  Plus, Trash2, Youtube, Video, Monitor, Briefcase, Camera, FolderOpen,
  ChevronDown, ChevronUp, BookOpen, HardHat, X, Link, FileCheck, Shield,
  MessageSquare, AlertCircle, BarChart3, ChevronRight,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  getConversation, streamMessage, generateExum, createEvidence, deleteEvidence,
  fetchSkkUnits,
  type Message, type EvidenceItem, type SkkUnit, type SocratiDialog,
} from "@/lib/api";

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
    onSave({
      category, title, url: url || undefined, description: description || undefined,
      skkUnitCode: selectedUnit?.code, skkUnitName: selectedUnit?.name,
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
                  <input type="text" value={url} onChange={(e) => setUrl(e.target.value)}
                    placeholder={type === "learning" ? "https://youtube.com/..." : "Masukkan nomor registrasi / link ESIMPAN"}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
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
                ) : skkUnits.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                    Unit SKK tidak ditemukan untuk jabatan kerja ini. Anda tetap dapat menyimpan tanpa tag SKK.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {skkUnits.map((unit) => (
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
            <button
              onClick={step === "info" ? goNext : goNext}
              disabled={step === "info" ? !canNextInfo : !canNextQ}
              className="flex-1 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              {step === "info" ? "Mulai Dialog Pak Budi" : "Lanjut"}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Evidence Card ────────────────────────────────────────────────────────────
function EvidenceCard({ item, onDelete }: { item: EvidenceItem; onDelete: () => void }) {
  const cat = getCatConfig(item.category);
  const Icon = cat.icon;
  return (
    <div className="group relative bg-card border border-border rounded-xl p-3 hover:border-primary/40 transition-all hover:shadow-sm">
      <div className="flex items-start gap-2.5">
        <div className={`w-8 h-8 rounded-lg ${cat.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 ${cat.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1">
            <p className="text-xs font-semibold text-foreground leading-tight flex-1 truncate">{item.title}</p>
            {item.socratiCompleted && (
              <span title="Dialog Sokratik selesai" className="shrink-0">
                <MessageSquare className="w-3.5 h-3.5 text-green-500" />
              </span>
            )}
          </div>
          <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cat.bg} ${cat.color}`}>
            {cat.label}
          </span>
          {item.url && (
            <a href={item.url.startsWith("http") ? item.url : `https://${item.url}`}
              target="_blank" rel="noopener noreferrer"
              className="block mt-1 text-[10px] text-primary truncate hover:underline">
              {item.url.length > 38 ? item.url.slice(0, 38) + "..." : item.url}
            </a>
          )}
          {item.description && (
            <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{item.description}</p>
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
        </div>
        <button onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
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
function EvidencePanel({ convId, jabker, evidence, onRefresh }: {
  convId: number;
  jabker: string;
  evidence: EvidenceItem[];
  onRefresh: () => void;
}) {
  const [wizardType, setWizardType] = useState<"learning" | "work_experience" | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const qc = useQueryClient();

  const learning = evidence.filter((e) => e.type === "learning");
  const workExp = evidence.filter((e) => e.type === "work_experience");

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
                        <EvidenceCard key={item.id} item={item} onDelete={() => handleDelete(item)} />
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
                        <EvidenceCard key={item.id} item={item} onDelete={() => handleDelete(item)} />
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
  const [showExumFull, setShowExumFull] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const { data: conv, isLoading, refetch } = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => getConversation(id),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (conv?.phase) setCurrentPhase(conv.phase);
  }, [conv?.phase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conv?.messages, streamText]);

  const sendMsg = useCallback(() => {
    const content = input.trim();
    if (!content || streaming) return;
    setInput("");
    setStreaming(true);
    setStreamText("");
    if (abortRef.current) abortRef.current();
    abortRef.current = streamMessage(
      id, content,
      (chunk) => setStreamText((prev) => prev + chunk),
      (phase) => {
        setStreaming(false);
        setStreamText("");
        setCurrentPhase(phase);
        qc.invalidateQueries({ queryKey: ["conversation", id] });
        qc.invalidateQueries({ queryKey: ["conversations"] });
      },
      (err) => { setStreaming(false); setStreamText(`Terjadi kesalahan: ${err}`); }
    );
  }, [id, input, streaming, qc]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };

  const handleGenerateExum = async () => {
    setGenerating(true);
    try {
      const result = await generateExum(id);
      setExum(result.content);
      setCurrentPhase("done");
      qc.invalidateQueries({ queryKey: ["conversation", id] });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!exum) return;
    const blob = new Blob([exum], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Executive_Summary_PKB_${conv?.jabker?.replace(/\s+/g, "_") || "TKK"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
          <h1 className="text-sm font-semibold text-foreground truncate">{conv?.title ?? "Sesi Wawancara"}</h1>
          <p className="text-xs text-muted-foreground">
            {conv?.jabker && <span>{conv.jabker} · </span>}
            {conv?.jenjang && <span>{conv.jenjang} · </span>}
            Mode {conv?.mode === "A" ? "Pengalaman Kerja" : conv?.mode === "B" ? "Hasil Belajar" : "Hybrid"}
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

        {canGenerate && !exum && (
          <button onClick={handleGenerateExum} disabled={generating}
            className="flex items-center gap-1.5 bg-accent text-accent-foreground px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 shrink-0">
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            {generating ? "Membuat..." : "Generate Exum"}
          </button>
        )}
        {exum && (
          <button onClick={handleDownload}
            className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-90 shrink-0">
            <Download className="w-3.5 h-3.5" /> Download Exum
          </button>
        )}
      </header>

      {/* Evidence Panel */}
      <EvidencePanel
        convId={id}
        jabker={conv?.jabker ?? ""}
        evidence={evidence}
        onRefresh={() => refetch()}
      />

      {/* Exum result banner */}
      {exum && (
        <div className="border-b border-green-200 bg-green-50/60 px-4 py-3 shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <span className="text-sm font-semibold text-green-800">Executive Summary PKB berhasil dibuat</span>
              <button onClick={() => setShowExumFull((p) => !p)}
                className="ml-auto text-xs text-green-700 underline flex items-center gap-1">
                {showExumFull ? "Sembunyikan" : "Tampilkan Pratinjau"}
                {showExumFull ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              <button onClick={handleDownload}
                className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-90">
                <Download className="w-3.5 h-3.5" /> Download
              </button>
            </div>
            {showExumFull && (
              <div className="prose prose-sm max-w-none text-green-900 bg-white/80 rounded-xl p-4 border border-green-200 max-h-64 overflow-y-auto">
                <ReactMarkdown>{exum}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && !streaming && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-8 h-8 text-primary" />
              </div>
              <p className="font-semibold text-foreground mb-1">Pak Budi siap memulai wawancara</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Tambahkan serpihan bukti di panel atas (dengan Dialog Sokratik), lalu ketik pesan untuk memulai wawancara.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex msg-enter ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 mr-2.5 mt-1">
                  <span className="text-white text-[10px] font-bold">PB</span>
                </div>
              )}
              <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-card border border-border text-foreground rounded-tl-sm shadow-sm"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none text-foreground [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2 [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:mb-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0 ml-2.5 mt-1">
                  <span className="text-muted-foreground text-[9px] font-bold">Anda</span>
                </div>
              )}
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

      {/* Input */}
      <div className="border-t border-border bg-card px-4 py-3 shrink-0">
        <div className="max-w-3xl mx-auto flex gap-2.5 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming || generating || currentPhase === "done"}
            placeholder={
              currentPhase === "done"
                ? "Wawancara selesai — unduh Exum Anda di atas."
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
            onClick={sendMsg}
            disabled={!input.trim() || streaming || generating || currentPhase === "done"}
            className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-40 hover:opacity-90 transition-opacity">
            {streaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-center text-[11px] text-muted-foreground mt-2">
          Dijawab oleh AI · Periksa kembali sebelum digunakan · Nilai Exum: 25 SKPK
        </p>
      </div>
    </div>
  );
}
