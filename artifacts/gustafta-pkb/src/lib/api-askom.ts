/**
 * API client for ASKOM (Asesor Kompetensi) verification endpoints.
 */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

async function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${BASE}${path}`, { credentials: "include", ...opts });
}

export interface AskomSubmissionSkk {
  id: number;
  activityId: number;
  skkCode: string;
  skkName: string;
  jabkerId: string | null;
  jabkerName: string | null;
}

export interface AskomSubmissionDoc {
  id: number;
  activityId: number;
  docType: string;
  filename: string;
  objectPath: string;
  mimeType: string | null;
  caption: string | null;
  uploadedAt: string;
}

export interface AskomSubmission {
  id: number;
  userId: number;
  namaKegiatan: string;
  tanggalMulai: string;
  tanggalSelesai: string | null;
  jenisPkb: string | null;
  jpPkb: number | null;
  penyelenggara: string | null;
  namaMateri: string | null;
  status: string;
  askomNote: string | null;
  askomVerifiedAt: string | null;
  updatedAt: string;
  ownerName: string;
  ownerEmail: string;
  skk: AskomSubmissionSkk[];
}

export interface AskomSubmissionFull extends AskomSubmission {
  tempatKegiatan: string | null;
  modePelaksanaan: string | null;
  namaInstruktur: string | null;
  uraianSingkat: string | null;
  linkRekaman: string | null;
  docs: AskomSubmissionDoc[];
  journey: Array<{ id: number; event: string; label: string; createdAt: string; metadata: unknown }>;
}

export async function listAskomSubmissions(): Promise<AskomSubmission[]> {
  const res = await apiFetch("/askom/submissions");
  if (!res.ok) throw new Error("Gagal memuat daftar pengajuan");
  return res.json();
}

export async function getAskomSubmission(id: number): Promise<AskomSubmissionFull> {
  const res = await apiFetch(`/askom/submissions/${id}`);
  if (!res.ok) throw new Error("Gagal memuat detail pengajuan");
  return res.json();
}

export async function verifyAskomSubmission(id: number, note?: string): Promise<{ ok: boolean; status: string }> {
  const res = await apiFetch(`/askom/submissions/${id}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Gagal memverifikasi");
  }
  return res.json();
}

export async function rejectAskomSubmission(id: number, note: string): Promise<{ ok: boolean; status: string }> {
  const res = await apiFetch(`/askom/submissions/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Gagal menolak pengajuan");
  }
  return res.json();
}
