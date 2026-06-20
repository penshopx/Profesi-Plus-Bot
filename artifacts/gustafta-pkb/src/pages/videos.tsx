import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft, Video, Youtube, Globe, Search, ExternalLink,
  BookOpen, Filter, Play,
} from "lucide-react";
import { listVideos } from "@/lib/api";

const JABKER_OPTIONS = [
  "Ahli Teknik Bangunan Gedung", "Ahli Muda Teknik Bangunan Gedung",
  "Ahli Teknik Jalan", "Ahli Muda Teknik Jalan",
  "Ahli Teknik Jembatan", "Ahli Muda Teknik Jembatan",
  "Ahli Teknik Sumber Daya Air", "Pelaksana Lapangan",
];

function getYouTubeThumbnail(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
  if (!m) return null;
  return `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg`;
}

function detectPlatformIcon(url: string) {
  if (url.includes("youtube") || url.includes("youtu.be")) return <Youtube className="w-4 h-4 text-red-500" />;
  return <Globe className="w-4 h-4 text-blue-500" />;
}

export default function VideosPage() {
  const [, navigate] = useLocation();
  const { isSignedIn } = useUser();
  const [search, setSearch] = useState("");
  const [filterJabker, setFilterJabker] = useState("");
  const [showFilter, setShowFilter] = useState(false);

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["videos", filterJabker],
    queryFn: () => listVideos({ jabker: filterJabker || undefined }),
  });

  const filtered = (videos as any[]).filter((v) =>
    !search.trim() ||
    v.title?.toLowerCase().includes(search.toLowerCase()) ||
    v.description?.toLowerCase().includes(search.toLowerCase()) ||
    v.tags?.toLowerCase().includes(search.toLowerCase()) ||
    v.skkUnitName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 sm:px-6 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1 as any)} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Video className="w-3.5 h-3.5 text-primary" />
          </div>
          <h1 className="font-semibold text-sm text-foreground">Video Library PKB</h1>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 space-y-5">
        {/* Search + filter bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari video, SKK, atau kata kunci..."
              className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              filterJabker ? "border-primary/40 bg-primary/5 text-primary" : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filter</span>
          </button>
        </div>

        {/* Filter dropdown */}
        {showFilter && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">Filter Jabatan Kerja</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setFilterJabker("")}
                className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${!filterJabker ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                Semua
              </button>
              {JABKER_OPTIONS.map(j => (
                <button key={j} onClick={() => setFilterJabker(filterJabker === j ? "" : j)}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${filterJabker === j ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                  {j}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <p className="text-xs text-muted-foreground">
          {isLoading ? "Memuat..." : `${filtered.length} video ditemukan`}
          {filterJabker && ` · ${filterJabker}`}
        </p>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-52 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl p-12 text-center">
            <Video className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Belum ada video</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {isSignedIn
                ? "Instruktur dan lembaga diklat dapat menambah video di dashboard masing-masing."
                : "Login untuk melihat semua video."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((v: any) => {
              const thumb = getYouTubeThumbnail(v.url);
              return (
                <div key={v.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-md transition-all group">
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-muted flex items-center justify-center">
                    {thumb ? (
                      <img src={thumb} alt={v.title} className="w-full h-full object-cover" />
                    ) : (
                      <Video className="w-8 h-8 text-muted-foreground/30" />
                    )}
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-4 h-4 text-gray-900 ml-0.5" />
                      </div>
                    </a>
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      {detectPlatformIcon(v.url)}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-4 space-y-1.5">
                    <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{v.title}</p>
                    {v.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{v.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {v.jabker && (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/8 text-primary font-medium">
                          <BookOpen className="w-2.5 h-2.5" />{v.jabker.split(" ").slice(0, 3).join(" ")}
                        </span>
                      )}
                      {v.skkUnitCode && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{v.skkUnitCode}</span>
                      )}
                    </div>
                    {v.uploader && (
                      <p className="text-[10px] text-muted-foreground/50">
                        oleh {v.uploader.name || v.uploader.role}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
