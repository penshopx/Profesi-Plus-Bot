/**
 * Halaman Profil TKK — APL 01 & APL 02
 *
 * APL 01: Profil lengkap tenaga kerja konstruksi (identitas, alamat, pendidikan, pekerjaan, SKK)
 * APL 02: Daftar unit kompetensi yang diklaim beserta bukti dan status proficiency
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Link } from "wouter";
import {
  getMyProfile, updateMyProfile, listMyClaims, createClaim, updateClaim, deleteClaim,
  type Profile, type CompetencyClaim,
} from "@/lib/api-profile";
import { fetchJabkerList, fetchSkkUnits } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  User, MapPin, GraduationCap, Briefcase, Award, Plus, Trash2, CheckCircle2,
  AlertCircle, ChevronLeft, Star,
} from "lucide-react";

const AGAMA_OPTIONS = ["Islam", "Kristen Protestan", "Kristen Katolik", "Hindu", "Buddha", "Konghucu"];
const PENDIDIKAN_OPTIONS = ["SD", "SMP", "SMA/SMK", "D1", "D2", "D3", "D4", "S1", "S2", "S3"];
const PENCAPAIAN_OPTIONS = [
  { value: "kompeten", label: "Kompeten" },
  { value: "dalam_proses", label: "Dalam Proses" },
  { value: "belum_kompeten", label: "Belum Kompeten" },
];
const BUKTI_TYPES = ["portofolio", "sertifikat", "laporan", "foto", "video", "testimoni", "lainnya"];

// ─── Completeness indicator ───────────────────────────────────────────────────

function CompletenessBar({ profile }: { profile: Profile }) {
  const fields = [
    profile.nik, profile.tanggalLahir, profile.jenisKelamin,
    profile.alamat, profile.kotaKabupaten, profile.provinsi,
    profile.jenjangPendidikan, profile.namaInstitusi,
    profile.namaPerusahaan, profile.jabatanSekarang,
    profile.nomorSkk,
  ];
  const filled = fields.filter(Boolean).length;
  const pct = Math.round((filled / fields.length) * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Kelengkapan APL 01</span>
        <span className={pct === 100 ? "text-green-600 font-semibold" : "text-amber-600 font-semibold"}>
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct === 100 ? "bg-green-500" : "bg-amber-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── APL 01 form ─────────────────────────────────────────────────────────────

function APL01Form({ profile, onSave }: { profile: Profile; onSave: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Profile>>({ ...profile });

  const mut = useMutation({
    mutationFn: () => updateMyProfile(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast({ title: "Profil disimpan ✓" });
      onSave();
    },
    onError: (e) => toast({ title: "Gagal menyimpan", description: String(e), variant: "destructive" }),
  });

  function set(key: keyof Profile, val: string | number | null) {
    setForm((f) => ({ ...f, [key]: val || null }));
  }

  const F = ({ label, id, type = "text", placeholder }: { label: string; id: keyof Profile; type?: string; placeholder?: string }) => (
    <div className="space-y-1.5">
      <Label htmlFor={String(id)}>{label}</Label>
      <Input
        id={String(id)}
        type={type}
        placeholder={placeholder}
        value={(form[id] as string) ?? ""}
        onChange={(e) => set(id, e.target.value)}
      />
    </div>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-8">

      {/* Identitas Diri */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-base font-semibold">
          <User className="h-4 w-4 text-primary" />
          <span>Identitas Diri</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="NIK (16 digit)" id="nik" placeholder="3271XXXXXXXXXXXX" />
          <F label="Tempat Lahir" id="tempatLahir" />
          <F label="Tanggal Lahir" id="tanggalLahir" type="date" />
          <div className="space-y-1.5">
            <Label>Jenis Kelamin</Label>
            <Select value={form.jenisKelamin ?? ""} onValueChange={(v) => set("jenisKelamin", v)}>
              <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="L">Laki-laki</SelectItem>
                <SelectItem value="P">Perempuan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Agama</Label>
            <Select value={form.agama ?? ""} onValueChange={(v) => set("agama", v)}>
              <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
              <SelectContent>
                {AGAMA_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <F label="Nomor HP" id="nomorHp" type="tel" placeholder="08XXXXXXXXXX" />
        </div>
      </section>

      {/* Alamat */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-base font-semibold">
          <MapPin className="h-4 w-4 text-primary" />
          <span>Alamat Tempat Tinggal</span>
        </div>
        <div className="space-y-1.5">
          <Label>Alamat Lengkap</Label>
          <Textarea
            placeholder="Jl. ..."
            value={(form.alamat as string) ?? ""}
            onChange={(e) => set("alamat", e.target.value)}
            rows={2}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <F label="RT" id="rt" placeholder="001" />
          <F label="RW" id="rw" placeholder="002" />
          <F label="Kode Pos" id="kodePos" placeholder="12345" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Kelurahan/Desa" id="kelurahan" />
          <F label="Kecamatan" id="kecamatan" />
          <F label="Kota/Kabupaten" id="kotaKabupaten" />
          <F label="Provinsi" id="provinsi" />
        </div>
      </section>

      {/* Pendidikan */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-base font-semibold">
          <GraduationCap className="h-4 w-4 text-primary" />
          <span>Pendidikan Terakhir</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Jenjang Pendidikan</Label>
            <Select value={form.jenjangPendidikan ?? ""} onValueChange={(v) => set("jenjangPendidikan", v)}>
              <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
              <SelectContent>
                {PENDIDIKAN_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <F label="Nama Institusi/Sekolah" id="namaInstitusi" />
          <F label="Jurusan/Program Studi" id="jurusan" />
          <F label="Tahun Lulus" id="tahunLulus" type="number" placeholder="2010" />
        </div>
      </section>

      {/* Pekerjaan */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-base font-semibold">
          <Briefcase className="h-4 w-4 text-primary" />
          <span>Pekerjaan Saat Ini</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Nama Perusahaan" id="namaPerusahaan" />
          <F label="Jabatan Sekarang" id="jabatanSekarang" />
          <F label="Tahun Mulai Bekerja" id="tahunMulaiBekerja" type="number" placeholder="2015" />
        </div>
        <div className="space-y-1.5">
          <Label>Alamat Perusahaan</Label>
          <Textarea
            placeholder="Jl. ..."
            value={(form.alamatPerusahaan as string) ?? ""}
            onChange={(e) => set("alamatPerusahaan", e.target.value)}
            rows={2}
          />
        </div>
      </section>

      {/* SKK */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-base font-semibold">
          <Award className="h-4 w-4 text-primary" />
          <span>Sertifikat Kompetensi Kerja (SKK)</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Nomor SKK" id="nomorSkk" placeholder="SKK-XXXX-XXXX" />
          <F label="Masa Berlaku SKK" id="masaBerlakuSkk" type="date" />
          <F label="Lembaga Sertifikasi (LSP)" id="lembagaSertifikasi" placeholder="LSP Konstruksi Indonesia" />
        </div>
      </section>

      <Button type="submit" disabled={mut.isPending} className="w-full sm:w-auto">
        {mut.isPending ? "Menyimpan…" : "Simpan Profil APL 01"}
      </Button>
    </form>
  );
}

// ─── APL 02 — Klaim Kompetensi ────────────────────────────────────────────────

function ClaimBadge({ pencapaian }: { pencapaian: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    kompeten: { label: "Kompeten", variant: "default" },
    dalam_proses: { label: "Dalam Proses", variant: "secondary" },
    belum_kompeten: { label: "Belum Kompeten", variant: "destructive" },
  };
  const { label, variant } = map[pencapaian] ?? { label: pencapaian, variant: "outline" };
  return <Badge variant={variant}>{label}</Badge>;
}

function APL02Panel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: claims = [], isLoading } = useQuery({ queryKey: ["my-claims"], queryFn: listMyClaims });
  const { data: jabkerList = [] } = useQuery({ queryKey: ["jabker-list"], queryFn: fetchJabkerList });

  const [dlgOpen, setDlgOpen] = useState(false);
  const [editClaim, setEditClaim] = useState<CompetencyClaim | null>(null);
  const [newForm, setNewForm] = useState({
    jabker: "", skkUnitCode: "", skkUnitName: "", jenjang: "",
    pencapaian: "dalam_proses", buktiUtama: "", jenisBukti: "portofolio", catatanTambahan: "",
  });
  const [units, setUnits] = useState<{ code: string; name: string }[]>([]);

  const { data: skkData } = useQuery({
    queryKey: ["skk-units", newForm.jabker],
    queryFn: () => fetchSkkUnits(newForm.jabker),
    enabled: !!newForm.jabker,
  });

  const unitList = skkData?.units?.map((u) => ({ code: u.code, name: u.name })) ?? [];

  const addMut = useMutation({
    mutationFn: () => createClaim({ ...newForm, jabker: newForm.jabker }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-claims"] });
      toast({ title: "Klaim ditambahkan ✓" });
      setDlgOpen(false);
      setNewForm({ jabker: "", skkUnitCode: "", skkUnitName: "", jenjang: "", pencapaian: "dalam_proses", buktiUtama: "", jenisBukti: "portofolio", catatanTambahan: "" });
    },
    onError: (e) => toast({ title: "Gagal", description: String(e), variant: "destructive" }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => deleteClaim(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-claims"] }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CompetencyClaim> }) => updateClaim(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-claims"] });
      setEditClaim(null);
      toast({ title: "Klaim diperbarui ✓" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Unit Kompetensi yang Diklaim</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Daftarkan unit SKK yang Anda kuasai beserta bukti dan status pencapaian
          </p>
        </div>
        <Button size="sm" onClick={() => setDlgOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Tambah Unit
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Memuat…</div>
      ) : claims.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Award className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Belum ada unit kompetensi yang diklaim.</p>
            <p className="text-xs mt-1">Tambahkan unit SKK sesuai jabatan kerja Anda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {claims.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{c.skkUnitCode}</span>
                      <ClaimBadge pencapaian={c.pencapaian} />
                      {c.lastProficiencyScore !== null && c.lastProficiencyScore !== undefined && (
                        <Badge variant="outline" className="gap-1">
                          <Star className="h-3 w-3" />
                          Proficiency {c.lastProficiencyScore}%
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium mt-1">{c.skkUnitName}</p>
                    {c.buktiUtama && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        Bukti: {c.buktiUtama}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setEditClaim(c)}>
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={() => delMut.mutate(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add claim dialog */}
      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Klaim Kompetensi (APL 02)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Jabatan Kerja</Label>
              <Select value={newForm.jabker} onValueChange={(v) => setNewForm((f) => ({ ...f, jabker: v, skkUnitCode: "", skkUnitName: "" }))}>
                <SelectTrigger><SelectValue placeholder="Pilih jabker…" /></SelectTrigger>
                <SelectContent>
                  {jabkerList.map((j) => <SelectItem key={j} value={j}>{j.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {unitList.length > 0 && (
              <div className="space-y-1.5">
                <Label>Unit Kompetensi (SKK)</Label>
                <Select value={newForm.skkUnitCode} onValueChange={(v) => {
                  const u = unitList.find((x) => x.code === v);
                  setNewForm((f) => ({ ...f, skkUnitCode: v, skkUnitName: u?.name ?? "" }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Pilih unit…" /></SelectTrigger>
                  <SelectContent>
                    {unitList.map((u) => (
                      <SelectItem key={u.code} value={u.code}>
                        <span className="font-mono text-xs mr-2">{u.code}</span>{u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Status Pencapaian</Label>
              <Select value={newForm.pencapaian} onValueChange={(v) => setNewForm((f) => ({ ...f, pencapaian: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PENCAPAIAN_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Jenis Bukti Utama</Label>
              <Select value={newForm.jenisBukti} onValueChange={(v) => setNewForm((f) => ({ ...f, jenisBukti: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUKTI_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Deskripsi Bukti Utama</Label>
              <Textarea placeholder="Contoh: Laporan proyek pembangunan Gedung X tahun 2023…"
                value={newForm.buktiUtama}
                onChange={(e) => setNewForm((f) => ({ ...f, buktiUtama: e.target.value }))}
                rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Catatan Tambahan</Label>
              <Input placeholder="(opsional)"
                value={newForm.catatanTambahan}
                onChange={(e) => setNewForm((f) => ({ ...f, catatanTambahan: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)}>Batal</Button>
            <Button onClick={() => addMut.mutate()} disabled={!newForm.skkUnitCode || addMut.isPending}>
              {addMut.isPending ? "Menyimpan…" : "Tambahkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit claim dialog */}
      {editClaim && (
        <Dialog open={!!editClaim} onOpenChange={() => setEditClaim(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Edit Klaim — {editClaim.skkUnitName}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Status Pencapaian</Label>
                <Select value={editClaim.pencapaian}
                  onValueChange={(v) => setEditClaim((c) => c ? { ...c, pencapaian: v } : c)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PENCAPAIAN_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Deskripsi Bukti</Label>
                <Textarea value={editClaim.buktiUtama ?? ""}
                  onChange={(e) => setEditClaim((c) => c ? { ...c, buktiUtama: e.target.value } : c)}
                  rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label>Catatan</Label>
                <Input value={editClaim.catatanTambahan ?? ""}
                  onChange={(e) => setEditClaim((c) => c ? { ...c, catatanTambahan: e.target.value } : c)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditClaim(null)}>Batal</Button>
              <Button onClick={() => updateMut.mutate({ id: editClaim.id, data: editClaim })}
                disabled={updateMut.isPending}>
                {updateMut.isPending ? "Menyimpan…" : "Simpan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilPage() {
  const { user } = useUser();
  const { data: profile, isLoading } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });
  const [saved, setSaved] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/sessions">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Profil Tenaga Kerja Konstruksi</h1>
            <p className="text-sm text-muted-foreground">APL 01 & APL 02 — Standar BNSP</p>
          </div>
        </div>

        {/* Status card */}
        {profile && (
          <Card>
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full overflow-hidden bg-muted">
                  {user?.imageUrl ? (
                    <img src={user.imageUrl} alt="avatar" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-10 w-10 p-2 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-semibold">{user?.fullName ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</p>
                </div>
                {profile.isComplete && (
                  <Badge variant="default" className="ml-auto gap-1 bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="h-3 w-3" /> Profil Lengkap
                  </Badge>
                )}
                {!profile.isComplete && (
                  <Badge variant="secondary" className="ml-auto gap-1">
                    <AlertCircle className="h-3 w-3" /> Profil Belum Lengkap
                  </Badge>
                )}
              </div>
              <CompletenessBar profile={profile} />
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="apl01">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="apl01">APL 01 — Profil Diri</TabsTrigger>
            <TabsTrigger value="apl02">APL 02 — Kompetensi</TabsTrigger>
          </TabsList>

          <TabsContent value="apl01" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Formulir APL 01</CardTitle>
                <CardDescription>
                  Data ini akan digunakan sebagai identitas resmi dalam dokumen Exum PKB Anda
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-sm text-muted-foreground py-4">Memuat profil…</div>
                ) : profile ? (
                  <APL01Form profile={profile} onSave={() => setSaved(true)} />
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="apl02" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Formulir APL 02</CardTitle>
                <CardDescription>
                  Daftarkan setiap unit kompetensi SKK yang Anda kuasai, lengkap dengan bukti dan status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <APL02Panel />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
