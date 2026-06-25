import { useUser, useClerk } from "@clerk/react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { listConversations } from "@/lib/api";
import {
  LayoutDashboard, MessageSquare, Video, LogOut, Plus,
  CheckCircle2, Briefcase, BookOpen, Layers, Package, ChevronRight,
} from "lucide-react";

const PHASE_LABELS: Record<string, string> = {
  profiling: "Profiling", context: "Konteks", core_interview: "Wawancara",
  evidence: "Bukti", synthesis: "Sintesis", done: "Selesai",
};

export default function DashboardUser() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, navigate] = useLocation();
  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: listConversations,
  });

  const done = conversations.filter((c) => c.phase === "done").length;
  const active = conversations.filter((c) => c.phase !== "done").length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <LayoutDashboard className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">Gustafta PKB</p>
            <p className="text-[11px] text-muted-foreground">Dashboard Peserta</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-foreground">{user?.fullName ?? user?.firstName}</p>
            <p className="text-[11px] text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: "/" })}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Selamat datang, {user?.firstName ?? "Peserta"} 👋
          </h1>
          <p className="text-muted-foreground mt-1">Pantau progress sertifikasi PKB Anda</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Sesi", value: conversations.length, icon: MessageSquare, color: "text-blue-500 bg-blue-50" },
            { label: "Selesai (Exum)", value: done, icon: CheckCircle2, color: "text-green-500 bg-green-50" },
            { label: "Sedang Berjalan", value: active, icon: Layers, color: "text-amber-500 bg-amber-50" },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                <s.icon className="w-4.5 h-4.5" />
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate("/sessions?new=1")}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Buat Sesi Baru
          </button>
          <button
            onClick={() => navigate("/videos")}
            className="flex items-center gap-2 bg-muted text-muted-foreground px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            <Video className="w-4 h-4" /> Video Library
          </button>
        </div>

        {/* Session list */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Sesi Terakhir</h2>
          {conversations.length === 0 ? (
            <div className="border border-dashed border-border rounded-2xl p-8 text-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Belum ada sesi. Mulai yang baru!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.slice(0, 10).map((c) => {
                const ModeIcon = c.mode === "A" ? Briefcase : c.mode === "B" ? BookOpen : Layers;
                const modeColor = c.mode === "A" ? "text-blue-500" : c.mode === "B" ? "text-emerald-500" : "text-violet-500";
                return (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/chat/${c.id}`)}
                    className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-colors group"
                  >
                    <ModeIcon className={`w-4 h-4 ${modeColor} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">{PHASE_LABELS[c.phase] ?? c.phase}</span>
                        {c.jabker && <span className="text-[11px] text-muted-foreground/60 truncate max-w-[120px]">{c.jabker}</span>}
                        {c.evidenceCount > 0 && (
                          <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground/50">
                            <Package className="w-3 h-3" />{c.evidenceCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
