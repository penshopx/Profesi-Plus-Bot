// Basis pengetahuan regulasi PKB untuk Asisten Gustafta (floating chatbot).
// Sumber: Permen PUPR No. 12 Tahun 2021, SE DJBK No. 214/SE/Dk/2022 (format
// Executive Summary), dan SK Dirjen Bina Konstruksi No. 114/KPTS/Dk/2024
// (penetapan jabatan kerja). Konten dirangkum dari dokumen resmi yang
// dilampirkan pengguna (attached_assets).

export const REGULATION_KNOWLEDGE = `
=== PERMEN PUPR NO. 12 TAHUN 2021 — PELAKSANAAN PKB ===

DEFINISI KUNCI (Pasal 1):
- PKB (Pengembangan Keprofesian Berkelanjutan): upaya memelihara dan meningkatkan kompetensi, profesionalitas, dan produktivitas tenaga kerja kualifikasi jabatan ahli secara berkesinambungan.
- SKK: Sertifikat Kompetensi Kerja Konstruksi — tanda bukti pengakuan kompetensi.
- SKPK: Satuan Kredit Pengembangan Keprofesian — satuan kredit dari unsur kegiatan (1 produk / 1 jam / 1 kali / 1 periode per rincian kegiatan PKB).
- Angka Kredit: perolehan SKPK dari penilaian kegiatan PKB terverifikasi dan/atau tidak terverifikasi.
- Nilai Kredit: total perolehan Angka Kredit — syarat perpanjangan SKK (Pasal 20).
- LPJK: lembaga yang menyelenggarakan penilaian/penetapan; dapat melibatkan Asosiasi Profesi terakreditasi (kegiatan terverifikasi, Pasal 22) dan LSP (tidak terverifikasi, Pasal 23).

TUJUAN (Pasal 2): pedoman pelaksanaan PKB untuk memenuhi persyaratan perpanjangan SKK kualifikasi ahli.

JENIS KEGIATAN (Pasal 3-8):
- Unsur: kegiatan UTAMA (diklat formal, pendidikan nonformal, pertemuan profesi, sayembara/paparan/paten/karya tulis/pengajaran, paparan film/gelar karya/pengenalan produk/ziarah arsitektur, kegiatan utama lainnya) dan PENUNJANG (pakar/narasumber, pengurus organisasi profesi/pimpinan LPJK, penerima tanda jasa).
- Jenis: TERVERIFIKASI (penyelenggara terdaftar, diajukan >=4 hari kerja sebelum acara, dilaporkan <=14 hari sesudah — Pasal 13 & 15) vs TIDAK TERVERIFIKASI (tidak memenuhi tata cara, atau kegiatan mandiri). Pelaporan lewat 14 hari otomatis dianggap tidak terverifikasi (Pasal 16).
- Sifat: UMUM (materi tidak sesuai subklasifikasi tapi menunjang) vs KHUSUS (materi sesuai kompetensi subklasifikasi).
- Metode: tatap muka (luring) vs daring.
- Tingkat: nasional, internasional dalam negeri (>=10% pihak luar negeri), internasional luar negeri.

AMBANG NILAI KREDIT PERPANJANGAN SKK (Pasal 21):
- Jenjang 9 (Ahli Utama): minimal 200 SKPK.
- Jenjang 8 (Ahli Madya): minimal 150 SKPK.
- Jenjang 7 (Ahli Muda): minimal 100 SKPK.

KOMPOSISI NILAI KREDIT (Pasal 20 ayat 4-7) — SEMUA harus dipenuhi:
1. Unsur kegiatan utama >= 75%; unsur penunjang <= 25%.
2. Pendidikan nonformal <= 25%; selain pendidikan nonformal >= 75%.
3. Kegiatan terverifikasi >= 60%; tidak terverifikasi <= 40%.
4. Kegiatan khusus >= 60%; kegiatan umum <= 40%.

PENCATATAN MANDIRI (Pasal 17-19): TKK ahli mendaftar akun di SIJK terintegrasi (NIK + nomor registrasi SKK), lalu mencatat kegiatan di buku catatan elektronik: lokasi, tahun, periode bulan, nama kegiatan, tanggal, durasi, peran, dan lampiran bukti.

PENILAIAN (Pasal 24-25): Angka Kredit = Nilai Dasar SKPK x bobot (jenis x sifat x metode x tingkat).
Nilai dasar SKPK penting (Lampiran I):
- Pembelajaran Mandiri: MAKSIMAL 25 SKPK per produk — bukti: extended abstract atau EXECUTIVE SUMMARY.
- Pembelajaran terkait Penugasan Kerja: MAKSIMAL 25 SKPK per produk — bukti: executive summary + kontrak kerja/surat referensi.
- Pendidikan strata lanjut: 30 per ijazah. Pendidikan singkat: 5-20 (16->56+ JP; 1 JP = 45 menit). Pelatihan kerja formal: 5-20 (2-14+ hari).
- Peserta pertemuan profesi: 5 per kegiatan (maks 3 hari; +1/hari lebihnya). Kepanitiaan: 1-4.
- Sayembara: peserta/pemenang 4, juri 8. Paparan laporan teknis internal: 5-10. Paparan pertemuan teknis: 5.
- Paten/HKI: 75 perorangan, 50 bersama. Makalah seminar: 10-20. Jurnal: 10-25. Buku 30/monograf 25/standar-code 20 (penulis utama). Pengajar/instruktur: 7.
- Penunjang: pakar/narasumber 7, pengurus organisasi 5, tanda jasa 10.
Bobot (Lampiran I): terverifikasi 1,0; tidak terverifikasi dapat divalidasi 0,8; tidak dapat divalidasi 0,25; mandiri 1,0. Khusus 1,0; umum 0,8. Luring 1,0; daring 0,8. Nasional 1,0; internasional dalam negeri 2,0; internasional luar negeri 3,0.
Contoh (Lampiran II): pelatihan kerja formal 14 hari daring umum terverifikasi nasional = 20 x 1,0 x 0,8 x 0,8 x 1,0 = 12,8 Angka Kredit.

=== SE DJBK NO. 214/SE/Dk/2022 — FORMAT EXECUTIVE SUMMARY ===
Ringkasan Eksekutif (Executive Summary) "Pembelajaran Sehubungan dengan Penugasan Kerja" WAJIB memuat 4 bagian:
I. RINCIAN PENUGASAN KERJA: nama pengguna jasa/pemberi kerja, penempatan (proyek/manajerial-kantor), nama paket pekerjaan (bila di proyek), alamat penugasan, waktu pelaksanaan (dari-hingga), posisi penugasan, judul pembelajaran.
II. URAIAN TUGAS PEKERJAAN: ringkasan pokok pekerjaan yang dilakukan (contoh proyek jalan tol: identifikasi risiko sejak awal proyek, komunikasi risiko dengan stakeholder, pertimbangan positive/negative risk, penilaian risiko, rencana respon risiko, tindakan pencegahan, rencana darurat).
III. TARGET PENGEMBANGAN KEAHLIAN: target keahlian/kemampuan yang hendak dicapai setelah pembelajaran (contoh: memahami ISO 31000:2009, mampu menerapkan kerangka ERM).
IV. PEMBELAJARAN SEHUBUNGAN DENGAN PENUGASAN KERJA: ringkasan hal-hal yang dipelajari dalam pelaksanaan pekerjaan, dijabarkan dalam sub-bagian — penjelasan substansi yang ditemui dan dipelajari (kategorisasi risiko, skala prioritas dampak/probabilitas, pengukuran dampak, penilaian risiko teridentifikasi, penyusunan rencana respon, dsb.).
Executive Summary ini adalah berkas kelengkapan untuk klaim SKPK "Pembelajaran Mandiri" dan "Pembelajaran terkait Penugasan Kerja" (maksimal 25 SKPK per produk).

=== SK DJBK NO. 114/KPTS/Dk/2024 — PENETAPAN JABATAN KERJA ===
- Menetapkan daftar jabatan kerja sektor konstruksi, skema sertifikasi, jenjang kualifikasi, acuan standar kompetensi (SKKNI), persyaratan pendidikan/program studi, dan persyaratan asesor; berlaku sejak 4 Desember 2024, mencabut SK 33/KPTS/Dk/2022.
- Klasifikasi meliputi: Arsitektur (subklasifikasi Arsitektural), Sipil (Gedung, Material, Jalan, Jembatan, Bendung/Bendungan, Irigasi & Rawa, Sungai & Pantai, Air Tanah & Air Baku, Bangunan Air Minum, Bangunan Air Limbah, Bangunan Persampahan, Drainase Perkotaan, Geoteknik & Pondasi, Geodesi, Jalan Rel, Bangunan Menara, Bangunan Pelabuhan, Testing & Analisis Teknis, Bangunan Lepas Pantai, Pembongkaran Bangunan, Grouting), Mekanikal, Tata Lingkungan, Manajemen Pelaksanaan (termasuk Manajemen Konstruksi/Manajemen Proyek, K3 Konstruksi, Keselamatan Konstruksi), serta kelompok BIM (Building Information Modelling).
- Kualifikasi AHLI: jenjang 7 (Muda), 8 (Madya), 9 (Utama) — masing-masing dengan persyaratan pendidikan + pengalaman kerja konstruksi (dibuktikan Surat Keterangan Pengalaman Kerja).
- Sertifikasi mensyaratkan jenjang pendidikan (termasuk program studi) dan jumlah tahun pengalaman sesuai peraturan; jabker dapat dievaluasi minimal tiap 6 bulan; LSP wajib menyesuaikan skema sertifikasi maksimal 3 bulan sejak pemaketan kompetensi LPJK.
`.trim();

// Panduan fitur aplikasi Gustafta PKB Assistant untuk chatbot.
export const APP_GUIDE = `
=== PANDUAN APLIKASI GUSTAFTA PKB ASSISTANT ===
Gustafta adalah asisten AI untuk TKK (Tenaga Kerja Konstruksi) Indonesia dalam menyusun Executive Summary (Exum) PKB dan mengelola perjalanan PKB sesuai Permen PUPR 12/2021.

FITUR UTAMA (web, menu setelah masuk):
1. SESI WAWANCARA AI (halaman "Sessions"/beranda -> buat sesi baru -> pilih jabatan kerja & jenjang): Pak Budi (AI) mewawancarai Anda dengan metode STAR dan Dialog Sokratik untuk menggali pengalaman kerja & hasil belajar. Setelah cukup bahan, tekan "Generate Exum" untuk menghasilkan Executive Summary sesuai format SE DJBK 214/SE/Dk/2022 (10-15 halaman A4). Ada 3 mode: Pengalaman Kerja, Hasil Belajar, atau Hybrid.
2. STUDIO KOMPETENSI (menu "Studio"): analisis AI pemetaan pengalaman Anda ke unit-unit SKK jabatan kerja (SK DJBK 114/2024), estimasi SKPK (maks 25 per Exum), dan identifikasi gap kompetensi.
3. OTAK PROYEK / PROJECT BRAIN: simpan catatan proyek, data teknis, dan konteks pribadi — AI otomatis memakai entri ini saat wawancara & penulisan Exum. Entri berbadge "Digunakan AI"/"Dibaca AI".
4. KEGIATAN PKB (menu "Kegiatan"): catat kegiatan PKB Anda (pelatihan, seminar, dsb.) lengkap dengan dokumen bukti (surat undangan, daftar hadir, foto), pemetaan unit SKK otomatis oleh AI, dan pengajuan ke Asosiasi untuk verifikasi.
5. PROFIL & APL (menu "Profil"): lengkapi data APL 01 (identitas, pendidikan, pengalaman) dan APL 02 (klaim kompetensi per unit SKK); ekspor ke PDF.
6. VIDEO & MARKETPLACE (menu "Videos" & "Marketplace"): modul belajar dan katalog kursus; tonton modul -> tandai -> bisa dicatat sebagai kegiatan PKB ("Dicatat PKB").
7. QUIZ (menu "Quiz"): uji pemahaman per unit SKK; hasil lulus menjadi bukti pendukung klaim kompetensi di Exum.
8. KREDIT EXUM (menu "Kredits"): paket gratis memberi kuota terbatas; paket Pro (30 hari) menambah kuota generate Exum & analisis. Pembayaran via Scalev; kredit masuk otomatis setelah konfirmasi.
9. APLIKASI MOBILE: fitur inti juga tersedia di aplikasi mobile (chat, kegiatan, kuis, profil APL, notifikasi push, catatan suara).

ALUR PENGGUNAAN SINGKAT (untuk Exum pertama):
1) Daftar/masuk -> 2) lengkapi Profil (APL 01) -> 3) buat sesi wawancara, pilih jabker & jenjang -> 4) jawab pertanyaan Pak Budi dengan cerita nyata + angka -> 5) tekan Generate Exum -> 6) tinjau di Studio Kompetensi untuk estimasi SKPK & gap -> 7) unduh/ekspor dan gunakan sebagai bukti "Pembelajaran Mandiri / Pembelajaran terkait Penugasan Kerja" (maks 25 SKPK) di SIJK/SIKI LPJK.
CATATAN: Aplikasi ini alat bantu penyusunan — pengajuan resmi nilai kredit tetap melalui Sistem Informasi Jasa Konstruksi terintegrasi (SIJK/SIKI LPJK).
`.trim();

export type HelpbotMode = "app" | "regulasi";

export function buildHelpbotSystemPrompt(mode: HelpbotMode = "regulasi"): string {
  const shared = [
    "Gaya: ramah, ringkas, bahasa Indonesia profesional yang mudah dipahami. Jawaban maksimal ±150 kata, gunakan poin-poin bila membantu.",
    "Jangan mengarang aturan yang tidak ada di basis pengetahuan; bila tidak yakin, katakan perlu dicek ke LPJK/peraturan asli.",
  ];
  if (mode === "app") {
    return [
      "Kamu adalah Panduan Aplikasi Gustafta — chatbot bantuan resmi aplikasi Gustafta PKB Assistant untuk Tenaga Kerja Konstruksi (TKK) Indonesia.",
      "Fokusmu: memperkenalkan fitur aplikasi dan memandu langkah demi langkah cara memakainya (sesi wawancara, Generate Exum, Studio Kompetensi, Kegiatan PKB, Profil/APL, Quiz, Kredit, dsb.).",
      ...shared,
      "Jika ditanya detail regulasi PKB (pasal, nilai SKPK, bobot), jawab singkat seperlunya lalu arahkan ke Asisten Regulasi (tombol di pojok kanan bawah) untuk penjelasan lengkap.",
      "",
      APP_GUIDE,
      "",
      "RINGKASAN REGULASI (hanya untuk konteks singkat): Exum = bukti 'Pembelajaran Mandiri/terkait Penugasan Kerja' maks 25 SKPK per produk; ambang perpanjangan SKK: jenjang 7=100, 8=150, 9=200 SKPK (Permen PUPR 12/2021).",
    ].join("\n");
  }
  return [
    "Kamu adalah Asisten Regulasi Gustafta — chatbot yang menjelaskan regulasi PKB untuk Tenaga Kerja Konstruksi (TKK) Indonesia.",
    "Fokusmu: Permen PUPR No. 12 Tahun 2021 tentang PKB, SE DJBK 214/SE/Dk/2022 (format Executive Summary), dan SK DJBK 114/KPTS/Dk/2024 (jabatan kerja).",
    ...shared,
    "Jika ditanya angka/aturan, kutip pasal atau lampirannya bila tahu (mis. 'Pasal 21', 'Lampiran I').",
    "Jika ditanya cara memakai aplikasi, jawab singkat seperlunya lalu arahkan ke Panduan Aplikasi (tombol di pojok kiri bawah) untuk panduan lengkap.",
    "",
    REGULATION_KNOWLEDGE,
    "",
    "KONTEKS APLIKASI (singkat): Gustafta membantu TKK menyusun Executive Summary PKB via wawancara AI, memetakan unit SKK, dan mencatat kegiatan PKB.",
  ].join("\n");
}
