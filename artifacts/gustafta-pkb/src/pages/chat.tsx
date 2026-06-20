import { useState, useRef, useEffect, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Send, Loader2, Download, FileText, CheckCircle2,
  Plus, Trash2, Youtube, Video, Monitor, Briefcase, Camera, FolderOpen,
  ChevronDown, ChevronUp, BookOpen, HardHat, X, Link, FileCheck, Shield,
  MessageSquare, AlertCircle, BarChart3, ChevronRight,
  Copy, CheckCheck, Zap, SlidersHorizontal,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  getConversation, streamMessage, generateExum, advancePhase, createEvidence, deleteEvidence,
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
  const [jabkerIsKnown, setJabkerIsKnown] = useState<boolean | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [manualName, setManualName] = useState("");

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

function EvidenceCard({ item, onDelete }: { item: EvidenceItem; onDelete: () => void }) {
  const cat = getCatConfig(item.category);
  const Icon = cat.icon;
  const ytId = item.url ? extractYoutubeId(item.url) : null;
  const thumbnailUrl = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null;
  const openUrl = item.url ? (item.url.startsWith("http") ? item.url : `https://${item.url}`) : null;

  return (
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
          <button onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
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
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState<EvidFilter>("all");
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
  const [advancing, setAdvancing] = useState(false);
  const [showExumModal, setShowExumModal] = useState(false);
  const [phaseToast, setPhaseToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    if (conv?.exumContent && !exum) setExum(conv.exumContent);
  }, [conv?.exumContent]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conv?.messages, streamText]);

  const sendMsg = useCallback((directMsg?: string) => {
    const content = (directMsg ?? input).trim();
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
        setCurrentPhase((prev) => {
          if (phase !== prev) {
            setPhaseToast(phase);
            setTimeout(() => setPhaseToast(null), 4500);
          }
          return phase;
        });
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

  const handleCopyExum = async () => {
    if (!exum) return;
    await navigator.clipboard.writeText(exum);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
              <button onClick={handleDownload}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-90">
                <Download className="w-3.5 h-3.5" /> Unduh .md
              </button>
              <button onClick={() => setShowExumModal(false)}
                className="p-2 rounded-xl hover:bg-muted transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-background">
            <div className="max-w-4xl mx-auto bg-card border border-border rounded-2xl p-8 shadow-sm">
              <div className="prose prose-sm md:prose max-w-none text-foreground">
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
            <button onClick={() => { setExum(null); handleGenerateExum(); }} disabled={generating}
              title="Generate ulang Exum (misalnya setelah menambah serpihan baru)"
              className="flex items-center gap-1.5 bg-white border border-amber-300 text-amber-700 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-amber-50 transition-colors disabled:opacity-50">
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              {generating ? "Membuat ulang..." : "Regenerate"}
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming || generating || currentPhase === "done"}
            placeholder={
              currentPhase === "done"
                ? "Wawancara selesai — lihat Exum di atas."
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
