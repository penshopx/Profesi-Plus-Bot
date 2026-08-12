/**
 * Exum Outline Editor (Blueprint)
 *
 * Shown in the chat page when phase === "synthesis".
 * User reviews and edits the AI-generated outline before the full Exum is written.
 *
 * Flow: Auto-generate outline → user edits sections/points → Approve → Generate Exum
 */

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getExumOutline, updateExumOutline, approveExumOutline, regenerateExumOutline,
  type OutlineSection,
} from "@/lib/api-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, RefreshCw, GripVertical, Pencil, Plus, Trash2, ChevronDown, ChevronUp,
  FileText, Loader2,
} from "lucide-react";

interface Props {
  conversationId: number;
  onApproved: () => void; // called when user approves → parent triggers Exum generation
}

function SectionEditor({
  section,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  section: OutlineSection;
  onUpdate: (updated: OutlineSection) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);

  function updatePoint(idx: number, val: string) {
    const points = [...section.points];
    points[idx] = val;
    onUpdate({ ...section, points });
  }

  function addPoint() {
    onUpdate({ ...section, points: [...section.points, ""] });
  }

  function removePoint(idx: number) {
    onUpdate({ ...section, points: section.points.filter((_, i) => i !== idx) });
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <Input
              autoFocus
              value={section.title}
              onChange={(e) => onUpdate({ ...section, title: e.target.value })}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
              className="h-7 text-sm font-medium"
            />
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{section.title}</span>
              <button onClick={() => setEditingTitle(true)} className="text-muted-foreground hover:text-foreground">
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp} disabled={isFirst}>
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown} disabled={isLast}>
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded((x) => !x)}>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {expanded && (
        <CardContent className="pt-3 pb-3 space-y-2">
          {section.points.map((pt, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-muted-foreground text-xs mt-2 w-4 shrink-0">{i + 1}.</span>
              <Input
                value={pt}
                onChange={(e) => updatePoint(i, e.target.value)}
                className="h-8 text-sm flex-1"
                placeholder="Poin yang akan ditulis…"
              />
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground"
                onClick={() => removePoint(i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="text-xs" onClick={addPoint}>
            <Plus className="h-3 w-3 mr-1" /> Tambah poin
          </Button>

          <div className="pt-2 border-t">
            <label className="text-xs text-muted-foreground block mb-1">Catatan pribadi (instruksi ke AI)</label>
            <Textarea
              value={section.userNotes}
              onChange={(e) => onUpdate({ ...section, userNotes: e.target.value })}
              placeholder="Tambahkan instruksi khusus untuk bagian ini (opsional)…"
              rows={2}
              className="text-xs"
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function ExumOutlineEditor({ conversationId, onApproved }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: outline, isLoading } = useQuery({
    queryKey: ["exum-outline", conversationId],
    queryFn: () => getExumOutline(conversationId),
  });

  const [localSections, setLocalSections] = useState<OutlineSection[] | null>(null);
  const sections = localSections ?? (outline?.sections as OutlineSection[] | undefined) ?? [];

  const saveMut = useMutation({
    mutationFn: () => updateExumOutline(conversationId, sections),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exum-outline", conversationId] });
      toast({ title: "Outline disimpan ✓" });
    },
    onError: () => toast({ title: "Gagal menyimpan", variant: "destructive" }),
  });

  const approveMut = useMutation({
    mutationFn: async () => {
      await updateExumOutline(conversationId, sections);
      return approveExumOutline(conversationId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exum-outline", conversationId] });
      toast({ title: "Outline disetujui — memulai penulisan Exum…" });
      onApproved();
    },
    onError: () => toast({ title: "Gagal menyetujui", variant: "destructive" }),
  });

  const regenMut = useMutation({
    mutationFn: () => regenerateExumOutline(conversationId),
    onSuccess: (data) => {
      setLocalSections(data.sections as OutlineSection[]);
      qc.invalidateQueries({ queryKey: ["exum-outline", conversationId] });
      toast({ title: "Outline diperbarui dari transkrip terbaru" });
    },
    onError: () => toast({ title: "Gagal generate outline", variant: "destructive" }),
  });

  const updateSection = useCallback((idx: number, updated: OutlineSection) => {
    setLocalSections((prev) => {
      const s = prev ?? (outline?.sections as OutlineSection[] | undefined) ?? [];
      return s.map((sec, i) => i === idx ? updated : sec);
    });
  }, [outline]);

  const deleteSection = useCallback((idx: number) => {
    setLocalSections((prev) => {
      const s = prev ?? (outline?.sections as OutlineSection[] | undefined) ?? [];
      return s.filter((_, i) => i !== idx);
    });
  }, [outline]);

  const moveSection = useCallback((idx: number, dir: -1 | 1) => {
    setLocalSections((prev) => {
      const s = [...(prev ?? (outline?.sections as OutlineSection[] | undefined) ?? [])];
      const target = idx + dir;
      if (target < 0 || target >= s.length) return s;
      [s[idx], s[target]] = [s[target], s[idx]];
      return s.map((sec, i) => ({ ...sec, order: i + 1 }));
    });
  }, [outline]);

  const addSection = useCallback(() => {
    const newSec: OutlineSection = {
      id: `s-${Date.now()}`,
      title: "Bagian Baru",
      points: ["Poin pertama"],
      userNotes: "",
      order: sections.length + 1,
    };
    setLocalSections([...sections, newSec]);
  }, [sections]);

  if (isLoading || regenMut.isPending) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">
          {regenMut.isPending ? "Menganalisis transkrip dan menyusun outline…" : "Memuat outline…"}
        </p>
      </div>
    );
  }

  if (outline?.isApproved) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
        <p className="font-semibold">Outline Disetujui</p>
        <p className="text-sm text-muted-foreground">
          Penulisan Exum menggunakan outline ini. Jika ingin mengubah, generate ulang di bawah.
        </p>
        <Button variant="outline" size="sm" onClick={() => regenMut.mutate()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Buat Outline Baru
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Blueprint Penulisan Exum
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI menyusun kerangka dari transkrip Anda. Edit, tambah, atau hapus bagian sebelum menulis.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => regenMut.mutate()} disabled={regenMut.isPending}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Buat Ulang
        </Button>
      </div>

      <div className="space-y-2">
        {sections.map((sec, i) => (
          <SectionEditor
            key={sec.id}
            section={sec}
            onUpdate={(updated) => updateSection(i, updated)}
            onDelete={() => deleteSection(i)}
            onMoveUp={() => moveSection(i, -1)}
            onMoveDown={() => moveSection(i, 1)}
            isFirst={i === 0}
            isLast={i === sections.length - 1}
          />
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={addSection} className="w-full border-dashed">
        <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Bagian
      </Button>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="flex-1">
          {saveMut.isPending ? "Menyimpan…" : "Simpan Draft"}
        </Button>
        <Button
          onClick={() => approveMut.mutate()}
          disabled={approveMut.isPending || sections.length === 0}
          className="flex-1 bg-green-600 hover:bg-green-700"
        >
          {approveMut.isPending ? "Menyetujui…" : "✓ Setujui & Tulis Exum"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Setelah disetujui, AI akan menulis Exum lengkap mengikuti struktur di atas
      </p>
    </div>
  );
}
