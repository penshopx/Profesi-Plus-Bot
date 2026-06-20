import { useState, useRef, useEffect, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, Loader2, Download, RefreshCw, FileText, CheckCircle2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getConversation, streamMessage, generateExum, type Message } from "@/lib/api";

const PHASE_STEPS = ["profiling", "context", "core_interview", "evidence", "synthesis", "done"];
const PHASE_LABELS: Record<string, string> = {
  profiling: "Profiling",
  context: "Konteks Proyek",
  core_interview: "Wawancara Inti",
  evidence: "Bukti & Data",
  synthesis: "Sintesis",
  done: "Selesai",
};

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
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const { data: conv, isLoading } = useQuery({
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
      id,
      content,
      (chunk) => setStreamText((prev) => prev + chunk),
      (phase) => {
        setStreaming(false);
        setStreamText("");
        setCurrentPhase(phase);
        qc.invalidateQueries({ queryKey: ["conversation", id] });
        qc.invalidateQueries({ queryKey: ["conversations"] });
      },
      (err) => {
        setStreaming(false);
        setStreamText(`Terjadi kesalahan: ${err}`);
      }
    );
  }, [id, input, streaming, qc]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
    }
  };

  const handleGenerateExum = async () => {
    setGenerating(true);
    try {
      const result = await generateExum(id);
      setExum(result.content);
      setCurrentPhase("done");
      qc.invalidateQueries({ queryKey: ["conversation", id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
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

  if (!match) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const messages: Message[] = conv?.messages ?? [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-3 flex items-center gap-4 shrink-0">
        <button
          data-testid="button-back"
          onClick={() => navigate("/")}
          className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
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

        {/* Phase progress */}
        <div className="hidden md:flex items-center gap-1.5">
          {PHASE_STEPS.slice(0, 5).map((p, i) => (
            <div key={p} className="flex items-center gap-1.5">
              <div className={`relative flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold transition-all
                ${i < phaseIdx ? "bg-primary text-primary-foreground" : i === phaseIdx ? "bg-primary text-primary-foreground phase-pulse" : "bg-muted text-muted-foreground"}`}>
                {i < phaseIdx ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < 4 && <div className={`w-8 h-0.5 rounded-full transition-all ${i < phaseIdx ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            currentPhase === "done" ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary"
          }`}>
            {PHASE_LABELS[currentPhase] || currentPhase}
          </span>
          {canGenerate && !exum && (
            <button
              data-testid="button-generate-exum"
              onClick={handleGenerateExum}
              disabled={generating}
              className="flex items-center gap-1.5 bg-accent text-accent-foreground px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              {generating ? "Membuat..." : "Generate Exum"}
            </button>
          )}
          {exum && (
            <button
              data-testid="button-download-exum"
              onClick={handleDownload}
              className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              <Download className="w-3.5 h-3.5" />
              Download Exum
            </button>
          )}
        </div>
      </header>

      {/* Exum panel */}
      {exum && (
        <div className="border-b border-border bg-green-50/50 px-6 py-4">
          <div className="flex items-start gap-3 max-w-4xl mx-auto">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800 mb-1">Executive Summary berhasil dibuat!</p>
              <div className="prose prose-sm max-w-none text-green-900 max-h-48 overflow-y-auto bg-white/70 rounded-xl p-4 border border-green-200">
                <ReactMarkdown>{exum.slice(0, 800) + (exum.length > 800 ? "..." : "")}</ReactMarkdown>
              </div>
              <button onClick={handleDownload} className="mt-2 text-xs text-green-700 underline flex items-center gap-1">
                <Download className="w-3 h-3" /> Download dokumen lengkap
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && !streaming && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <p className="text-muted-foreground text-sm">Pak Budi siap memulai wawancara. Ketik pesan untuk memulai!</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              data-testid={`message-${msg.id}`}
              className={`flex msg-enter ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 mr-3 mt-1">
                  <span className="text-white text-xs font-bold">PB</span>
                </div>
              )}
              <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                ${msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-card border border-border text-foreground rounded-tl-sm shadow-sm"
                }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none text-foreground [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0 ml-3 mt-1">
                  <span className="text-muted-foreground text-xs font-bold">Anda</span>
                </div>
              )}
            </div>
          ))}

          {/* Streaming bubble */}
          {(streaming || streamText) && (
            <div className="flex justify-start msg-enter">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 mr-3 mt-1">
                <span className="text-white text-xs font-bold">PB</span>
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
      <div className="border-t border-border bg-card px-4 py-4 shrink-0">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            data-testid="input-message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming || generating}
            placeholder={currentPhase === "done" ? "Wawancara selesai. Unduh Exum Anda." : "Ketik jawaban Anda di sini... (Enter untuk kirim)"}
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
            data-testid="button-send"
            onClick={sendMsg}
            disabled={!input.trim() || streaming || generating}
            className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {streaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-center text-[11px] text-muted-foreground mt-2">
          Dijawab oleh AI. Periksa kembali sebelum digunakan. Nilai Exum: 25 SKPK
        </p>
      </div>
    </div>
  );
}
