import { useUser, useClerk } from "@clerk/react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  LayoutDashboard, Video, LogOut, Plus, Trash2, ExternalLink,
  Users, Youtube, Globe, X, Loader2, Play,
} from "lucide-react";
import { listVideos, createVideo, deleteVideo, type VideoItem } from "@/lib/api";

const JABKER_OPTIONS = [
  "Ahli Teknik Bangunan Gedung", "Ahli Muda Teknik Bangunan Gedung",
  "Ahli Teknik Jalan", "Ahli Muda Teknik Jalan",
  "Ahli Teknik Jembatan", "Ahli Muda Teknik Jembatan",
  "Ahli Teknik Sumber Daya Air", "Pelaksana Lapangan",
];

export default function DashboardLembaga() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", url: "", jabker: "", skkUnitCode: "", skkUnitName: "", description: "", tags: "" });

  const { data: videos = [], isLoading } = useQuery<VideoItem[]>({
    queryKey: ["videos"],
    queryFn: () => listVideos(),
  });

  const addMut = useMutation({
    mutationFn: createVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      setShowForm(false);
      setForm({ title: "", url: "", jabker: "", skkUnitCode: "", skkUnitName: "", description: "", tags: "" });
    },
  });

  const delMut = useMutation({
    mutationFn: (id: number) => deleteVideo(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["videos"] }),
  });

  const platformIcon = (url: string) =>
    url.includes("youtube") || url.includes("youtu.be")
      ? <Youtube className="w-4 h-4 text-red-500" />
      : <Globe className="w-4 h-4 text-blue-500" />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <LayoutDashboard className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <p className="font-semibold text-sm">Gustafta PKB</p>
            <p className="text-[11px] text-muted-foreground">Dashboard Lembaga Diklat</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/videos")} className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground">Video Library</button>
          <button onClick={() => signOut({ redirectUrl: "/" })} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard Lembaga Diklat</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Kelola materi & instruktur lembaga Anda</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Upload Video
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Video", value: videos.length, icon: Video, color: "text-violet-500 bg-violet-50" },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                <s.icon className="w-4.5 h-4.5" />
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Video list */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Video Lembaga</h2>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
          ) : videos.length === 0 ? (
            <div className="border border-dashed border-border rounded-2xl p-8 text-center">
              <Video className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Belum ada video. Mulai upload!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {videos.map((v: any) => (
                <div key={v.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 group">
                  {platformIcon(v.url)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {v.jabker && <span className="text-[11px] text-muted-foreground">{v.jabker}</span>}
                      {v.skkUnitCode && <span className="text-[11px] text-muted-foreground/60">{v.skkUnitCode}</span>}
                      {v.uploader && <span className="text-[11px] text-muted-foreground/40">oleh {v.uploader.name}</span>}
                    </div>
                  </div>
                  <a href={v.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => delMut.mutate(v.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Upload Video</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              {[
                { key: "title", label: "Judul Video *", placeholder: "Judul video..." },
                { key: "url", label: "URL Video *", placeholder: "https://youtube.com/watch?v=..." },
                { key: "skkUnitCode", label: "Kode SKK Unit", placeholder: "M.711000.001.01" },
                { key: "skkUnitName", label: "Nama SKK Unit", placeholder: "Menerapkan SMKK" },
                { key: "description", label: "Deskripsi", placeholder: "Deskripsi singkat..." },
                { key: "tags", label: "Tags", placeholder: "K3, konstruksi, ..." },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
                  <input type="text" value={form[key as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Jabatan Kerja</label>
                <select value={form.jabker} onChange={e => setForm(f => ({ ...f, jabker: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">-- Pilih Jabker --</option>
                  {JABKER_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2.5 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted">Batal</button>
              <button onClick={() => addMut.mutate(form)} disabled={!form.title || !form.url || addMut.isPending}
                className="flex-1 rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {addMut.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan...</> : <><Play className="w-3.5 h-3.5" /> Simpan</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
