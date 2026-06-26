type KbSeed = {
  seedKey: string;
  category: string;
  title: string;
  content: string;
  klasifikasi: string | null;
  jenjang: string | null;
  skkUnitCode: string | null;
  tags: string | null;
  source: string | null;
  priority: number;
  isActive: boolean;
};

export const KB_SEED: KbSeed[] = [
  {
    seedKey: "regulasi-permen-pupr-12-2021",
    category: "regulasi",
    title: "Permen PUPR No. 12 Tahun 2021 — Pedoman PKB Tenaga Kerja Konstruksi",
    content:
      "Permen PUPR No. 12 Tahun 2021 mengatur Pengembangan Keprofesian Berkelanjutan (PKB) bagi Tenaga Kerja Konstruksi (TKK). " +
      "PKB wajib dipenuhi pemegang Sertifikat Kompetensi Kerja (SKK) untuk perpanjangan sertifikat. " +
      "Pemenuhan dibuktikan melalui pencatatan kegiatan (pendidikan, pelatihan, pengalaman kerja/proyek, kegiatan profesi) yang dirangkum dalam Executive Summary (Exum). " +
      "Setiap kegiatan dikonversi ke Satuan Kredit PKB (SKPK) dan harus relevan dengan jabatan kerja serta jenjang kualifikasi pemegang SKK. " +
      "Exum harus mencerminkan capaian kompetensi NYATA, terukur, dan dapat diverifikasi.",
    klasifikasi: null,
    jenjang: null,
    skkUnitCode: null,
    tags: "permen pupr, pkb, skk, exum, regulasi, perpanjangan sertifikat",
    source: "Permen PUPR No. 12 Tahun 2021",
    priority: 10,
    isActive: true,
  },
  {
    seedKey: "regulasi-sk-djbk-114-2024",
    category: "regulasi",
    title: "SK Dirjen Bina Konstruksi No. 114 Tahun 2024 — Jabatan Kerja & Unit Kompetensi SKK",
    content:
      "SK Dirjen Bina Konstruksi No. 114 Tahun 2024 menetapkan jabatan kerja, jenjang kualifikasi, dan unit-unit kompetensi SKK Konstruksi. " +
      "Setiap jabatan kerja memiliki kode dan rangkaian unit kompetensi (dengan kode unit resmi). " +
      "Saat menyusun Exum, setiap capaian/pengalaman WAJIB dikaitkan dengan kode dan nama unit kompetensi yang benar sesuai jabatan kerja TKK. " +
      "Jangan menggunakan kode unit yang tidak terdaftar untuk jabatan kerja tersebut.",
    klasifikasi: null,
    jenjang: null,
    skkUnitCode: null,
    tags: "sk djbk, 114 2024, unit kompetensi, kode skk, jabatan kerja",
    source: "SK Dirjen Bina Konstruksi No. 114 Tahun 2024",
    priority: 10,
    isActive: true,
  },
  {
    seedKey: "rubrik-exum-struktur",
    category: "rubrik_exum",
    title: "Rubrik Executive Summary (Exum) PKB — Struktur & Kriteria Mutu",
    content:
      "Exum PKB yang berkualitas memuat: (1) Identitas & jabatan kerja/jenjang SKK; (2) Ringkasan profil profesional; " +
      "(3) Uraian kegiatan PKB (pembelajaran & pengalaman kerja) yang dipetakan ke unit SKK; (4) Capaian terukur dengan data kuantitatif; " +
      "(5) Refleksi pengembangan kompetensi; (6) Kesimpulan & rencana pengembangan lanjutan. " +
      "Kriteria mutu: spesifik (bukan generik), terukur (ada angka: %, Rp, durasi, jumlah personel, zero accident), relevan dengan jabatan kerja, " +
      "dapat diverifikasi (mengacu dokumen/proyek nyata), dan koheren. Panjang ideal setara 10-15 halaman A4 (2500-4000 kata).",
    klasifikasi: null,
    jenjang: null,
    skkUnitCode: null,
    tags: "rubrik, exum, struktur, mutu, kriteria, penilaian",
    source: "Pedoman Penyusunan Exum PKB",
    priority: 9,
    isActive: true,
  },
  {
    seedKey: "rubrik-exum-metode-star",
    category: "rubrik_exum",
    title: "Metode STAR untuk Menggali Pengalaman Kerja",
    content:
      "Gunakan metode STAR untuk menarasikan setiap pengalaman: " +
      "Situation (kondisi awal & tantangan), Task (tugas/tanggung jawab spesifik), Action (langkah konkret, metode/SOP/alat yang dipakai), " +
      "Result (hasil terukur: penghematan biaya Rp/%, percepatan jadwal hari/%, peningkatan mutu, zero accident). " +
      "Tambahkan Reflection (pembelajaran). Setiap STAR story sebaiknya dikaitkan ke minimal satu unit SKK dan diperkuat angka konkret.",
    klasifikasi: null,
    jenjang: null,
    skkUnitCode: null,
    tags: "star, situation task action result, pengalaman kerja, probing",
    source: "Metodologi Gustafta",
    priority: 7,
    isActive: true,
  },
  {
    seedKey: "panduan-jenjang-kualifikasi",
    category: "panduan_skk",
    title: "Panduan Fokus Berdasarkan Jenjang SKK (7, 8, 9)",
    content:
      "Jenjang 7 (Teknis-Operasional): fokus pada prosedur, pelaksanaan teknis, penerapan SOP, dan K3 di lapangan. " +
      "Jenjang 8 (Manajerial): fokus pada koordinasi tim, pengambilan keputusan, manajemen risiko, pengendalian mutu/biaya/waktu. " +
      "Jenjang 9 (Strategis): fokus pada kebijakan, inovasi, pengembangan metode baru, dan dampak pada organisasi/industri. " +
      "Sesuaikan kedalaman narasi Exum dan jenis bukti capaian dengan jenjang TKK.",
    klasifikasi: null,
    jenjang: null,
    skkUnitCode: null,
    tags: "jenjang, kualifikasi, 7 8 9, teknis, manajerial, strategis",
    source: "Pedoman Jenjang KKNI Konstruksi",
    priority: 6,
    isActive: true,
  },
];
