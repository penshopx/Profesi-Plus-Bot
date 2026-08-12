/**
 * Generates a browser/WebView-printable APL 01 & APL 02 HTML document.
 * Shared by the mobile print flow (expo-print → PDF) and kept in sync with
 * the web version in artifacts/gustafta-pkb/src/pages/profil.tsx.
 *
 * Changes to form structure (especially the signature section, Task #66)
 * must be reflected here too.
 */

import type { AplProfile, AplClaim } from './api';

const APL_PRINT_CSS = `
  @page { size: A4; margin: 20mm 25mm; }
  body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #111; max-width: 700px; margin: 0 auto; }
  h1 { font-size: 14pt; font-weight: bold; text-align: center; margin: 0 0 4pt; text-transform: uppercase; letter-spacing: 1px; }
  h2 { font-size: 12pt; font-weight: bold; margin: 18pt 0 6pt; border-bottom: 1.5pt solid #333; padding-bottom: 3pt; }
  h3 { font-size: 11pt; font-weight: bold; margin: 10pt 0 4pt; }
  .meta { text-align: center; color: #555; font-size: 9pt; margin-bottom: 18pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; }
  th, td { border: 1pt solid #aaa; padding: 5pt 8pt; font-size: 10pt; vertical-align: top; text-align: left; }
  th { background: #f0f0f0; font-weight: bold; }
  .field-row { display: flex; margin-bottom: 5pt; }
  .field-label { width: 180pt; color: #555; flex-shrink: 0; }
  .field-value { flex: 1; font-weight: 500; }
  .badge { display: inline-block; padding: 1pt 6pt; border: 1pt solid #aaa; border-radius: 3pt; font-size: 9pt; }
  .badge-green { border-color: #16a34a; color: #16a34a; }
  .badge-amber { border-color: #d97706; color: #d97706; }
  .sig-table { width: 100%; border: none; border-collapse: collapse; margin-top: 4pt; }
  .sig-td { border: none; width: 50%; vertical-align: top; }
  .sig-box { border: 1pt dashed #bbb; height: 72pt; margin: 8pt 0 4pt; text-align: center; padding-top: 28pt; font-size: 8pt; color: #bbb; }
  .sig-line { border-top: 1pt solid #444; padding-top: 4pt; font-size: 9pt; text-align: center; margin: 0; }
  .footer { margin-top: 24pt; font-size: 9pt; color: #777; border-top: 1pt solid #ddd; padding-top: 6pt; }
  @media print { body { margin: 0; } }
`;

export function buildAplHtml(
  profile: AplProfile,
  claims: AplClaim[],
  userName: string,
  email: string,
): string {
  const f = (v: string | number | null | undefined) => (v != null && v !== '' ? String(v) : '—');
  const row = (label: string, val: string | number | null | undefined) =>
    `<div class="field-row"><span class="field-label">${label}</span><span class="field-value">${f(val)}</span></div>`;

  const pencapaianLabel: Record<string, string> = {
    kompeten: 'Kompeten',
    dalam_proses: 'Dalam Proses',
    belum_kompeten: 'Belum Kompeten',
  };
  const pencapaianClass: Record<string, string> = {
    kompeten: 'badge-green',
    dalam_proses: '',
    belum_kompeten: 'badge-amber',
  };

  const claimRows = claims
    .map(
      (c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><code style="font-size:9pt">${c.skkUnitCode}</code></td>
      <td>${c.skkUnitName}</td>
      <td>${c.jabker?.replace(/_/g, ' ') ?? '—'}</td>
      <td><span class="badge ${pencapaianClass[c.pencapaian] ?? ''}">${pencapaianLabel[c.pencapaian] ?? c.pencapaian}</span></td>
      <td>${f(c.buktiUtama)}</td>
    </tr>`,
    )
    .join('');

  const now = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const year = new Date().getFullYear();
  const city = profile.kotaKabupaten ?? '____________';
  const lsp = profile.lembagaSertifikasi ?? '____________________________';

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
<title>APL 01 &amp; APL 02 — ${userName}</title>
<style>${APL_PRINT_CSS}</style></head><body>
<h1>Formulir APL 01 &amp; APL 02</h1>
<h1 style="font-size:12pt;margin-top:2pt">Permohonan Sertifikasi Kompetensi Kerja</h1>
<p class="meta">BNSP / Permen PUPR No. 12 Tahun 2021 · Dicetak: ${now}</p>

<h2>APL 01 — Permohonan &amp; Identitas Pemohon</h2>

<h3>A. Identitas Diri</h3>
${row('Nama Lengkap', userName)}
${row('NIK', profile.nik)}
${row(
  'Tempat, Tanggal Lahir',
  profile.tempatLahir && profile.tanggalLahir
    ? `${profile.tempatLahir}, ${profile.tanggalLahir}`
    : profile.tanggalLahir ?? null,
)}
${row('Jenis Kelamin', profile.jenisKelamin === 'L' ? 'Laki-laki' : profile.jenisKelamin === 'P' ? 'Perempuan' : profile.jenisKelamin)}
${row('Agama', profile.agama)}
${row('Email', email)}
${row('Nomor HP', profile.nomorHp)}

<h3>B. Alamat Tempat Tinggal</h3>
${row('Alamat', profile.alamat)}
${row('RT/RW', profile.rt && profile.rw ? `${profile.rt} / ${profile.rw}` : null)}
${row('Kelurahan', profile.kelurahan)}
${row('Kecamatan', profile.kecamatan)}
${row('Kota/Kabupaten', profile.kotaKabupaten)}
${row('Provinsi', profile.provinsi)}
${row('Kode Pos', profile.kodePos)}

<h3>C. Pendidikan Terakhir</h3>
${row('Jenjang Pendidikan', profile.jenjangPendidikan)}
${row('Nama Institusi/Sekolah', profile.namaInstitusi)}
${row('Jurusan/Program Studi', profile.jurusan)}
${row('Tahun Lulus', profile.tahunLulus)}

<h3>D. Pekerjaan Saat Ini</h3>
${row('Nama Perusahaan', profile.namaPerusahaan)}
${row('Jabatan Sekarang', profile.jabatanSekarang)}
${row('Tahun Mulai Bekerja', profile.tahunMulaiBekerja)}
${row('Alamat Perusahaan', profile.alamatPerusahaan)}

<h3>E. Sertifikat Kompetensi Kerja (SKK)</h3>
${row('Nomor SKK', profile.nomorSkk)}
${row('Masa Berlaku SKK', profile.masaBerlakuSkk)}
${row('Lembaga Sertifikasi (LSP)', profile.lembagaSertifikasi)}

<h2>APL 02 — Asesmen Mandiri &amp; Klaim Kompetensi</h2>

${
  claims.length === 0
    ? '<p><em>Belum ada unit kompetensi yang diklaim.</em></p>'
    : `<table>
  <thead>
    <tr>
      <th style="width:24pt">No</th>
      <th style="width:80pt">Kode Unit</th>
      <th>Nama Unit Kompetensi</th>
      <th style="width:80pt">Jabatan Kerja</th>
      <th style="width:70pt">Pencapaian</th>
      <th>Bukti / Deskripsi</th>
    </tr>
  </thead>
  <tbody>${claimRows}</tbody>
</table>`
}

<h2>Tanda Tangan &amp; Pernyataan</h2>
<p style="font-size:10pt;margin-bottom:16pt;">
  Saya menyatakan bahwa data yang saya berikan dalam formulir APL 01 dan APL 02 ini adalah benar
  dan dapat dipertanggungjawabkan.
</p>
<table class="sig-table">
  <tr>
    <td class="sig-td" style="padding-right:20pt;">
      <p style="font-weight:bold;margin:0 0 4pt;">Pemohon,</p>
      <p style="margin:0 0 4pt;font-size:9pt;color:#555;">${city}, _______________ ${year}</p>
      <div class="sig-box">[Tanda Tangan]</div>
      <p class="sig-line">(${userName})</p>
    </td>
    <td class="sig-td" style="padding-left:20pt;">
      <p style="font-weight:bold;margin:0 0 4pt;">Mengetahui, Lembaga Sertifikasi (LSP),</p>
      <p style="margin:0 0 4pt;font-size:9pt;color:#555;">${city}, _______________ ${year}</p>
      <div class="sig-box" style="padding-top:18pt;">[Tanda Tangan &amp; Stempel]</div>
      <p class="sig-line">(${lsp})</p>
    </td>
  </tr>
</table>

<div class="footer">
  <p>Dokumen ini digenerate dari sistem Gustafta PKB. Harap diperiksa kembali sebelum diserahkan ke LSP.</p>
</div>
</body></html>`;
}
