export interface SkkUnit {
  code: string;
  name: string;
  description: string;
}

export interface JabkerGroup {
  id: string;
  name: string;
  jenjang: string;
  units: SkkUnit[];
}

export const SKK_DATA: JabkerGroup[] = [
  {
    id: "ahli-muda-manajemen-konstruksi",
    name: "Ahli Muda Manajemen Konstruksi",
    jenjang: "Muda",
    units: [
      { code: "M.711000.001.01", name: "Menerapkan Sistem Manajemen K3 Konstruksi", description: "Kemampuan menerapkan sistem keselamatan dan kesehatan kerja dalam pekerjaan konstruksi" },
      { code: "M.711000.002.01", name: "Menerapkan Peraturan Perundang-undangan Konstruksi", description: "Pemahaman dan penerapan regulasi terkait pekerjaan konstruksi" },
      { code: "M.711000.003.01", name: "Mengelola Lingkup Pekerjaan Konstruksi", description: "Pengelolaan dan pengendalian ruang lingkup proyek konstruksi" },
      { code: "M.711000.004.01", name: "Mengelola Waktu Pelaksanaan Konstruksi", description: "Penyusunan dan pengendalian jadwal pelaksanaan proyek" },
      { code: "M.711000.005.01", name: "Mengelola Biaya Pekerjaan Konstruksi", description: "Perencanaan, pengendalian, dan pelaporan biaya proyek" },
      { code: "M.711000.006.01", name: "Mengelola Mutu Pekerjaan Konstruksi", description: "Pengendalian dan jaminan mutu hasil pekerjaan konstruksi" },
    ],
  },
  {
    id: "ahli-madya-manajemen-konstruksi",
    name: "Ahli Madya Manajemen Konstruksi",
    jenjang: "Madya",
    units: [
      { code: "M.711000.101.01", name: "Merumuskan Strategi Manajemen Proyek", description: "Penyusunan strategi dan rencana manajemen proyek konstruksi skala menengah-besar" },
      { code: "M.711000.102.01", name: "Mengelola Komunikasi dan Pemangku Kepentingan", description: "Pengelolaan komunikasi proyek dan hubungan dengan stakeholder" },
      { code: "M.711000.103.01", name: "Mengelola Risiko Proyek Konstruksi", description: "Identifikasi, analisis, dan mitigasi risiko proyek" },
      { code: "M.711000.104.01", name: "Mengelola Pengadaan Proyek Konstruksi", description: "Proses pengadaan material, jasa, dan subkontraktor" },
      { code: "M.711000.105.01", name: "Mengelola Perubahan Proyek Konstruksi", description: "Pengendalian perubahan lingkup, jadwal, dan biaya proyek" },
      { code: "M.711000.106.01", name: "Melakukan Serah Terima Proyek Konstruksi", description: "Proses komisioning, serah terima, dan penutupan proyek" },
    ],
  },
  {
    id: "ahli-muda-k3-konstruksi",
    name: "Ahli Muda K3 Konstruksi",
    jenjang: "Muda",
    units: [
      { code: "F.43.91100.002.01", name: "Menerapkan Peraturan K3 di Tempat Kerja", description: "Implementasi regulasi dan standar K3 di lokasi konstruksi" },
      { code: "F.43.91100.003.01", name: "Melakukan Identifikasi Bahaya dan Penilaian Risiko", description: "HIRADC dan pengendalian risiko K3 konstruksi" },
      { code: "F.43.91100.004.01", name: "Mengelola Sistem Izin Kerja", description: "Sistem ijin kerja untuk pekerjaan berbahaya (bekerja di ketinggian, ruang terbatas, dll)" },
      { code: "F.43.91100.005.01", name: "Melakukan Inspeksi K3 di Tempat Kerja", description: "Pelaksanaan inspeksi rutin dan investigasi kecelakaan" },
      { code: "F.43.91100.006.01", name: "Mengelola Alat Pelindung Diri (APD)", description: "Pengelolaan, pemilihan, dan penggunaan APD yang tepat" },
      { code: "F.43.91100.007.01", name: "Melakukan Sosialisasi K3 kepada Tenaga Kerja", description: "Pelatihan, toolbox meeting, dan komunikasi K3 kepada pekerja" },
    ],
  },
  {
    id: "ahli-muda-teknik-bangunan-gedung",
    name: "Ahli Muda Teknik Bangunan Gedung",
    jenjang: "Muda",
    units: [
      { code: "M.711000.201.01", name: "Membuat Gambar Teknik Bangunan Gedung", description: "Penyusunan dan pembacaan gambar teknis bangunan gedung" },
      { code: "M.711000.202.01", name: "Melakukan Analisis Struktur Bangunan Gedung", description: "Perhitungan dan analisis kekuatan struktur bangunan" },
      { code: "M.711000.203.01", name: "Mengelola Pelaksanaan Pekerjaan Struktur", description: "Pengawasan dan pengendalian pekerjaan struktur di lapangan" },
      { code: "M.711000.204.01", name: "Mengelola Pelaksanaan Pekerjaan Arsitektur", description: "Pengawasan pekerjaan finishing, fasad, dan interior" },
      { code: "M.711000.205.01", name: "Mengelola Pelaksanaan Pekerjaan MEP", description: "Koordinasi pekerjaan Mekanikal, Elektrikal, dan Plumbing" },
      { code: "M.711000.206.01", name: "Melakukan Pengujian Material Bangunan", description: "Pengujian dan kontrol kualitas material di lapangan" },
    ],
  },
  {
    id: "ahli-muda-teknik-jalan",
    name: "Ahli Muda Teknik Jalan",
    jenjang: "Muda",
    units: [
      { code: "M.711000.301.01", name: "Melakukan Survei dan Investigasi Jalan", description: "Survei kondisi jalan, geometrik, dan investigasi lapangan" },
      { code: "M.711000.302.01", name: "Mengelola Pelaksanaan Pekerjaan Tanah", description: "Pengawasan pekerjaan galian, timbunan, dan pemadatan" },
      { code: "M.711000.303.01", name: "Mengelola Pelaksanaan Pekerjaan Perkerasan Jalan", description: "Pengawasan pekerjaan lapis pondasi, AC-BC, AC-WC" },
      { code: "M.711000.304.01", name: "Mengelola Pelaksanaan Pekerjaan Drainase Jalan", description: "Pengawasan sistem drainase jalan dan bangunan pelengkap" },
      { code: "M.711000.305.01", name: "Melakukan Pengujian Kualitas Pekerjaan Jalan", description: "Core drill, DCP, FWD, dan pengujian perkerasan lainnya" },
      { code: "M.711000.306.01", name: "Membuat Laporan Teknis Pekerjaan Jalan", description: "Penyusunan laporan harian, mingguan, dan bulanan proyek jalan" },
    ],
  },
  {
    id: "ahli-muda-teknik-jembatan",
    name: "Ahli Muda Teknik Jembatan",
    jenjang: "Muda",
    units: [
      { code: "M.711000.401.01", name: "Melakukan Inspeksi Kondisi Jembatan", description: "Pemeriksaan rutin dan inspeksi khusus kondisi jembatan" },
      { code: "M.711000.402.01", name: "Mengelola Pelaksanaan Pekerjaan Pondasi Jembatan", description: "Pengawasan pekerjaan pondasi tiang dan sumuran" },
      { code: "M.711000.403.01", name: "Mengelola Pelaksanaan Pekerjaan Struktur Atas Jembatan", description: "Pengawasan pekerjaan gelagar, lantai, dan elemen struktur atas" },
      { code: "M.711000.404.01", name: "Menerapkan Metode Pelaksanaan Jembatan", description: "Pemahaman dan penerapan metode konstruksi jembatan" },
      { code: "M.711000.405.01", name: "Melakukan Analisis Kerusakan Jembatan", description: "Identifikasi, analisis, dan rekomendasi penanganan kerusakan" },
    ],
  },
  {
    id: "ahli-muda-teknik-sumber-daya-air",
    name: "Ahli Muda Teknik Sumber Daya Air",
    jenjang: "Muda",
    units: [
      { code: "M.711000.501.01", name: "Melakukan Analisis Hidrologi dan Hidraulika", description: "Perhitungan debit banjir, analisis aliran, dan perencanaan hidrolika" },
      { code: "M.711000.502.01", name: "Mengelola Pelaksanaan Pekerjaan Irigasi", description: "Pengawasan konstruksi saluran irigasi dan bangunan pelengkap" },
      { code: "M.711000.503.01", name: "Mengelola Pelaksanaan Pekerjaan Sungai dan Pantai", description: "Pengawasan pekerjaan normalisasi sungai, tanggul, dan revetment" },
      { code: "M.711000.504.01", name: "Mengelola Operasi dan Pemeliharaan Irigasi", description: "Pengaturan air irigasi dan pemeliharaan infrastruktur" },
      { code: "M.711000.505.01", name: "Melakukan Pemantauan Kualitas Air", description: "Pengujian dan pemantauan kualitas air permukaan" },
    ],
  },
];

export function findJabkerGroup(jabkerQuery: string): JabkerGroup | null {
  if (!jabkerQuery) return null;
  const q = jabkerQuery.toLowerCase().trim();
  const exact = SKK_DATA.find((g) => g.name.toLowerCase() === q);
  if (exact) return exact;
  const partial = SKK_DATA.find(
    (g) => g.name.toLowerCase().includes(q) || q.includes(g.name.toLowerCase())
  );
  if (partial) return partial;
  const words = q.split(/\s+/).filter((w) => w.length > 3);
  const scored = SKK_DATA.map((g) => {
    const gLower = g.name.toLowerCase();
    const score = words.filter((w) => gLower.includes(w)).length;
    return { g, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].g : null;
}
