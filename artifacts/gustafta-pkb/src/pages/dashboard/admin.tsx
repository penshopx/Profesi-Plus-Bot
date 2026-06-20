import { useClerk, useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  LayoutDashboard, LogOut, Users, Video, MessageSquare,
  CheckCircle2, ChevronDown, Search,
} from "lucide-react";
import { listAllUsers, updateUserRole, listVideos, type VideoItem, type DbUser } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  user: "Peserta",
  instruktur: "Instruktur",
  lembaga_diklat: "Lembaga Diklat",
  admin: "Admin",
};

const ROLE_COLORS: Record<string, string> = {
  user: "bg-blue-50 text-blue-600",
  instruktur: "bg-emerald-50 text-emerald-600",
  lembaga_diklat: "bg-violet-50 text-violet-600",
  admin: "bg-amber-50 text-amber-600",
};

export default function DashboardAdmin() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "videos">("users");

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: listAllUsers,
  });

  const { data: videos = [], isLoading: videosLoading } = useQuery<VideoItem[]>({
    queryKey: ["videos"],
    queryFn: () => listVideos(),
  });

  const roleMut = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => updateUserRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const filteredUsers = (users as any[]).filter((u) =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: "Total User", value: (users as any[]).length, icon: Users, color: "text-blue-500 bg-blue-50" },
    { label: "Total Video", value: (videos as any[]).length, icon: Video, color: "text-red-500 bg-red-50" },
    { label: "Instruktur", value: (users as any[]).filter((u) => u.role === "instruktur").length, icon: CheckCircle2, color: "text-emerald-500 bg-emerald-50" },
    { label: "Lembaga Diklat", value: (users as any[]).filter((u) => u.role === "lembaga_diklat").length, icon: MessageSquare, color: "text-violet-500 bg-violet-50" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
            <LayoutDashboard className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-sm">Gustafta PKB</p>
            <p className="text-[11px] text-muted-foreground">Dashboard Admin</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 font-medium">Admin</span>
          <button onClick={() => navigate("/videos")} className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground">Video Library</button>
          <button onClick={() => signOut({ redirectUrl: "/" })} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Panel Admin</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Kelola semua pengguna dan konten platform</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                <s.icon className="w-4.5 h-4.5" />
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border">
          {(["users", "videos"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {tab === "users" ? "Pengguna" : "Video"}
            </button>
          ))}
        </div>

        {activeTab === "users" && (
          <div className="space-y-3">
            <div className="relative max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 pointer-events-none" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama atau email..."
                className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            {usersLoading ? (
              <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((u: any) => (
                  <div key={u.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground">
                      {(u.name || u.email || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name || "(tanpa nama)"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] ?? "bg-muted text-muted-foreground"}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                    <div className="relative">
                      <select
                        value={u.role}
                        onChange={e => roleMut.mutate({ id: u.id, role: e.target.value })}
                        className="appearance-none bg-muted border border-border rounded-lg pl-2.5 pr-6 py-1.5 text-[11px] font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {Object.entries(ROLE_LABELS).map(([val, lbl]) => (
                          <option key={val} value={val}>{lbl}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "videos" && (
          <div className="space-y-2">
            {videosLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : (videos as any[]).length === 0 ? (
              <div className="border border-dashed border-border rounded-2xl p-8 text-center">
                <Video className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Belum ada video.</p>
              </div>
            ) : (
              (videos as any[]).map((v) => (
                <div key={v.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                  <Video className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {v.jabker && <span className="text-[11px] text-muted-foreground">{v.jabker}</span>}
                      {v.uploader && <span className="text-[11px] text-muted-foreground/50">oleh {v.uploader.name || v.uploader.role}</span>}
                    </div>
                  </div>
                  <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline">Buka</a>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
