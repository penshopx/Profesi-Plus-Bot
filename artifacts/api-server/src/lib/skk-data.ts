export interface SkkUnit {
  code: string;
  name: string;
  description: string;
}

export interface JabkerGroup {
  id: string;
  name: string;
  jenjang: string;
  klasifikasi: string;
  subklasifikasi: string;
  units: SkkUnit[];
}

export const SKK_DATA: JabkerGroup[] = [

  // =====================================================
  // A. KLASIFIKASI: ARSITEKTUR — Arsitektural
  // =====================================================
  {
    id: "arsitek-utama",
    name: "Arsitek Utama",
    jenjang: "Utama",
    klasifikasi: "Arsitektur",
    subklasifikasi: "Arsitektural",
    units: [
      { code: "M.71.ARS.001.01", name: "Merumuskan Konsep Perancangan Arsitektur Skala Besar", description: "Perumusan konsep desain untuk proyek arsitektur berskala nasional/internasional" },
      { code: "M.71.ARS.002.01", name: "Mengintegrasikan Desain Arsitektur dengan Regulasi Tata Ruang", description: "Penyesuaian rancangan arsitektur dengan peraturan tata ruang dan bangunan" },
      { code: "M.71.ARS.003.01", name: "Memimpin Tim Perancangan Arsitektur", description: "Koordinasi dan kepemimpinan tim arsitek dalam proyek besar" },
      { code: "M.71.ARS.004.01", name: "Melakukan Evaluasi Pasca Huni Bangunan", description: "Post-occupancy evaluation dan rekomendasi perbaikan gedung" },
      { code: "M.71.ARS.005.01", name: "Menerapkan Prinsip Bangunan Berkelanjutan", description: "Integrasi konsep green building dan efisiensi energi dalam perancangan" },
      { code: "M.71.ARS.006.01", name: "Menyusun Spesifikasi Teknis Arsitektur", description: "Penyusunan spesifikasi material dan metode konstruksi arsitektur" },
    ],
  },
  {
    id: "arsitek-madya",
    name: "Arsitek Madya",
    jenjang: "Madya",
    klasifikasi: "Arsitektur",
    subklasifikasi: "Arsitektural",
    units: [
      { code: "M.71.ARS.101.01", name: "Membuat Rancangan Arsitektur Bangunan", description: "Perancangan bangunan sesuai kebutuhan dan persyaratan teknis" },
      { code: "M.71.ARS.102.01", name: "Menyusun Dokumen Perancangan Arsitektur", description: "Penyusunan gambar rencana, RKS, dan RAB arsitektur" },
      { code: "M.71.ARS.103.01", name: "Mengkoordinasikan Desain Multidisiplin", description: "Koordinasi desain arsitektur dengan struktur dan MEP" },
      { code: "M.71.ARS.104.01", name: "Mengendalikan Kualitas Pelaksanaan Arsitektur", description: "Pengawasan dan pengendalian mutu pekerjaan arsitektur di lapangan" },
      { code: "M.71.ARS.105.01", name: "Menyusun Laporan Pengawasan Berkala", description: "Pembuatan laporan teknis pengawasan pelaksanaan konstruksi" },
    ],
  },
  {
    id: "asisten-arsitek",
    name: "Asisten Arsitek",
    jenjang: "Muda",
    klasifikasi: "Arsitektur",
    subklasifikasi: "Arsitektural",
    units: [
      { code: "M.71.ARS.201.01", name: "Membuat Gambar Teknis Arsitektur", description: "Penyusunan gambar kerja, denah, tampak, dan potongan bangunan" },
      { code: "M.71.ARS.202.01", name: "Melakukan Survei Lapangan Arsitektur", description: "Pengumpulan data lapangan sebagai dasar perancangan" },
      { code: "M.71.ARS.203.01", name: "Menyusun Materi Presentasi Desain", description: "Pembuatan materi visual untuk presentasi konsep desain" },
      { code: "M.71.ARS.204.01", name: "Memeriksa Kesesuaian Gambar dengan Spesifikasi", description: "Verifikasi gambar pelaksanaan dengan spesifikasi teknis" },
      { code: "M.71.ARS.205.01", name: "Membuat Perhitungan Volume Pekerjaan Arsitektur", description: "Perhitungan bill of quantity (BOQ) pekerjaan arsitektur" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL — Gedung
  // =====================================================
  {
    id: "ahli-utama-teknik-bangunan-gedung",
    name: "Ahli Utama Teknik Bangunan Gedung",
    jenjang: "Utama",
    klasifikasi: "Sipil",
    subklasifikasi: "Gedung",
    units: [
      { code: "M.71.GDG.001.01", name: "Merumuskan Kebijakan Teknis Bangunan Gedung", description: "Penyusunan kebijakan dan standar teknis bangunan gedung skala nasional" },
      { code: "M.71.GDG.002.01", name: "Mengevaluasi Desain Struktur Bangunan Tinggi", description: "Review dan evaluasi desain struktur gedung bertingkat tinggi" },
      { code: "M.71.GDG.003.01", name: "Memimpin Pelaksanaan Proyek Gedung Kompleks", description: "Kepemimpinan dan pengendalian proyek gedung dengan kompleksitas tinggi" },
      { code: "M.71.GDG.004.01", name: "Melakukan Audit Teknis Bangunan Gedung", description: "Pemeriksaan menyeluruh kondisi teknis dan keselamatan bangunan" },
      { code: "M.71.GDG.005.01", name: "Mengintegrasikan Sistem Gedung Pintar (Smart Building)", description: "Perencanaan dan penerapan sistem BAS dan teknologi gedung cerdas" },
      { code: "M.71.GDG.006.01", name: "Memberikan Pendapat Teknis Profesional Bidang Gedung", description: "Penyusunan opini teknis untuk permasalahan bangunan gedung" },
    ],
  },
  {
    id: "ahli-madya-teknik-bangunan-gedung",
    name: "Ahli Madya Teknik Bangunan Gedung",
    jenjang: "Madya",
    klasifikasi: "Sipil",
    subklasifikasi: "Gedung",
    units: [
      { code: "M.71.GDG.101.01", name: "Mengelola Pelaksanaan Proyek Bangunan Gedung", description: "Manajemen pelaksanaan konstruksi gedung bertingkat" },
      { code: "M.71.GDG.102.01", name: "Mengendalikan Mutu Pekerjaan Struktur Gedung", description: "Pengendalian kualitas pekerjaan beton, baja, dan fondasi gedung" },
      { code: "M.71.GDG.103.01", name: "Mengkoordinasikan Pekerjaan MEP Bangunan Gedung", description: "Koordinasi sistem Mekanikal, Elektrikal, dan Plumbing gedung" },
      { code: "M.71.GDG.104.01", name: "Mengelola Keselamatan Konstruksi Gedung", description: "Penerapan sistem K3 dalam pelaksanaan konstruksi gedung" },
      { code: "M.71.GDG.105.01", name: "Mengendalikan Biaya dan Jadwal Konstruksi Gedung", description: "Pengendalian cost dan schedule proyek gedung" },
      { code: "M.71.GDG.106.01", name: "Melakukan Serah Terima Bangunan Gedung", description: "Proses komisioning dan serah terima proyek gedung" },
    ],
  },
  {
    id: "ahli-muda-teknik-bangunan-gedung",
    name: "Ahli Muda Teknik Bangunan Gedung",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Gedung",
    units: [
      { code: "M.71.GDG.201.01", name: "Membuat Gambar Teknik Bangunan Gedung", description: "Penyusunan dan pembacaan gambar teknis bangunan gedung" },
      { code: "M.71.GDG.202.01", name: "Melakukan Analisis Struktur Bangunan Gedung", description: "Perhitungan dan analisis kekuatan struktur bangunan" },
      { code: "M.71.GDG.203.01", name: "Mengawasi Pekerjaan Struktur Bawah (Fondasi)", description: "Pengawasan pekerjaan galian, pondasi, dan basement" },
      { code: "M.71.GDG.204.01", name: "Mengawasi Pekerjaan Struktur Atas Gedung", description: "Pengawasan pekerjaan kolom, balok, pelat, dan atap" },
      { code: "M.71.GDG.205.01", name: "Mengawasi Pelaksanaan Pekerjaan Finishing", description: "Pengawasan pekerjaan finishing, fasad, dan interior" },
      { code: "M.71.GDG.206.01", name: "Melakukan Pengujian Material Bangunan Gedung", description: "Pengujian beton, baja, dan material struktur di lapangan" },
    ],
  },
  {
    id: "manajer-pengelolaan-bangunan-gedung",
    name: "Manajer Pengelolaan Bangunan Gedung",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Gedung",
    units: [
      { code: "M.71.PBG.001.01", name: "Merencanakan Operasi dan Pemeliharaan Bangunan Gedung", description: "Penyusunan rencana O&M gedung secara komprehensif" },
      { code: "M.71.PBG.002.01", name: "Mengelola Sistem Utilitas Bangunan Gedung", description: "Pengelolaan sistem listrik, air, pendingin, dan utilitas gedung" },
      { code: "M.71.PBG.003.01", name: "Melaksanakan Program Pemeliharaan Gedung", description: "Pelaksanaan pemeliharaan preventif dan korektif gedung" },
      { code: "M.71.PBG.004.01", name: "Mengelola Keselamatan dan Keamanan Gedung", description: "Penerapan sistem fire safety dan keamanan gedung" },
      { code: "M.71.PBG.005.01", name: "Mengelola Anggaran Operasional Gedung", description: "Perencanaan dan pengendalian biaya operasional gedung" },
    ],
  },
  {
    id: "ahli-utama-bangunan-gedung-hijau",
    name: "Ahli Utama Bangunan Gedung Hijau",
    jenjang: "Utama",
    klasifikasi: "Sipil",
    subklasifikasi: "Gedung",
    units: [
      { code: "M.71.GHJ.001.01", name: "Merumuskan Kebijakan Bangunan Gedung Hijau Nasional", description: "Pengembangan regulasi dan insentif bangunan hijau skala nasional" },
      { code: "M.71.GHJ.002.01", name: "Memimpin Audit Energi dan Lingkungan Gedung", description: "Penilaian komprehensif kinerja energi dan lingkungan bangunan" },
      { code: "M.71.GHJ.003.01", name: "Memberikan Pendapat Teknis Sertifikasi Hijau", description: "Expert opinion untuk program sertifikasi Greenship/EDGE/LEED" },
      { code: "M.71.GHJ.004.01", name: "Mengembangkan Standar Bangunan Rendah Karbon", description: "Perumusan standar net-zero energy dan zero-carbon building" },
      { code: "M.71.GHJ.005.01", name: "Mengevaluasi Inovasi Teknologi Gedung Hijau", description: "Penilaian dan rekomendasi teknologi bangunan berkelanjutan" },
    ],
  },
  {
    id: "ahli-madya-bangunan-gedung-hijau",
    name: "Ahli Madya Bangunan Gedung Hijau",
    jenjang: "Madya",
    klasifikasi: "Sipil",
    subklasifikasi: "Gedung",
    units: [
      { code: "M.71.GHJ.101.01", name: "Mengelola Sertifikasi Bangunan Gedung Hijau", description: "Manajemen proses sertifikasi Greenship dan dokumen pendukung" },
      { code: "M.71.GHJ.102.01", name: "Melakukan Simulasi Kinerja Energi Bangunan", description: "Simulasi energi menggunakan software (EnergyPlus, DesignBuilder)" },
      { code: "M.71.GHJ.103.01", name: "Merencanakan Sistem Energi Terbarukan Gedung", description: "Desain PLTS atap, panas bumi, dan energi terbarukan gedung" },
      { code: "M.71.GHJ.104.01", name: "Merencanakan Sistem Pengelolaan Air Gedung Hijau", description: "Desain sistem pemanenan air hujan dan daur ulang greywater" },
      { code: "M.71.GHJ.105.01", name: "Mengelola Kualitas Lingkungan Dalam Ruang (IEQ)", description: "Pengelolaan kualitas udara, kenyamanan termal, dan akustik ruangan" },
    ],
  },
  {
    id: "ahli-muda-bangunan-gedung-hijau",
    name: "Ahli Muda Bangunan Gedung Hijau",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Gedung",
    units: [
      { code: "M.71.GHJ.201.01", name: "Menerapkan Konsep Green Building dalam Perencanaan", description: "Integrasi prinsip bangunan hijau pada tahap desain" },
      { code: "M.71.GHJ.202.01", name: "Melakukan Audit Energi Tingkat Awal", description: "Penilaian konsumsi energi dan identifikasi peluang efisiensi" },
      { code: "M.71.GHJ.203.01", name: "Menyiapkan Dokumen Sertifikasi Greenship/EDGE", description: "Persiapan dokumen untuk sertifikasi bangunan hijau" },
      { code: "M.71.GHJ.204.01", name: "Memantau Kinerja Lingkungan Bangunan", description: "Monitoring dan evaluasi performa lingkungan gedung terbangun" },
      { code: "M.71.GHJ.205.01", name: "Menerapkan Material Ramah Lingkungan pada Konstruksi", description: "Spesifikasi dan penggunaan material berkelanjutan dalam pembangunan" },
    ],
  },
  {
    id: "ahli-utama-penilai-laik-fungsi-bg",
    name: "Ahli Utama Penilai Laik Fungsi Bangunan Gedung",
    jenjang: "Utama",
    klasifikasi: "Sipil",
    subklasifikasi: "Gedung",
    units: [
      { code: "M.71.PLF.001.01", name: "Memimpin Tim Penilai Laik Fungsi Bangunan", description: "Koordinasi tim ahli multidisiplin dalam penilaian laik fungsi gedung" },
      { code: "M.71.PLF.002.01", name: "Menetapkan Metodologi Pemeriksaan Laik Fungsi", description: "Pengembangan standar dan prosedur penilaian laik fungsi bangunan" },
      { code: "M.71.PLF.003.01", name: "Melakukan Evaluasi Risiko Struktur Bangunan Gedung", description: "Penilaian risiko struktural dan rekomendasi perkuatan bangunan" },
      { code: "M.71.PLF.004.01", name: "Memberikan Rekomendasi Laik Fungsi Bangunan Strategis", description: "Penyusunan rekomendasi teknis bangunan gedung negara/strategis" },
      { code: "M.71.PLF.005.01", name: "Menyusun Laporan Ahli untuk Litigasi Bangunan", description: "Expert report untuk keperluan litigasi dan sengketa konstruksi" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL — Jalan
  // =====================================================
  {
    id: "ahli-utama-teknik-jalan",
    name: "Ahli Utama Teknik Jalan",
    jenjang: "Utama",
    klasifikasi: "Sipil",
    subklasifikasi: "Jalan",
    units: [
      { code: "M.71.JLN.001.01", name: "Merumuskan Kebijakan Teknis Perkerasan Jalan", description: "Pengembangan standar dan kebijakan teknis jaringan jalan nasional" },
      { code: "M.71.JLN.002.01", name: "Melakukan Evaluasi Kinerja Jaringan Jalan Nasional", description: "Analisis kinerja jaringan jalan dan rekomendasi penanganan" },
      { code: "M.71.JLN.003.01", name: "Memimpin Perencanaan Jalan Nasional/Tol", description: "Kepemimpinan perencanaan teknis jalan bebas hambatan" },
      { code: "M.71.JLN.004.01", name: "Menyusun Standar dan Pedoman Teknis Jalan", description: "Penyusunan manual dan pedoman teknis konstruksi jalan" },
      { code: "M.71.JLN.005.01", name: "Memberikan Pendapat Teknis Profesional Bidang Jalan", description: "Expert opinion untuk permasalahan teknis jalan" },
      { code: "M.71.JLN.006.01", name: "Mengevaluasi Inovasi Teknologi Perkerasan Jalan", description: "Penilaian dan rekomendasi penerapan teknologi baru perkerasan" },
    ],
  },
  {
    id: "ahli-madya-teknik-jalan",
    name: "Ahli Madya Teknik Jalan",
    jenjang: "Madya",
    klasifikasi: "Sipil",
    subklasifikasi: "Jalan",
    units: [
      { code: "M.71.JLN.101.01", name: "Merencanakan Perkerasan Jalan", description: "Desain perkerasan lentur dan kaku berdasarkan beban lalulintas" },
      { code: "M.71.JLN.102.01", name: "Mengendalikan Pelaksanaan Konstruksi Jalan", description: "Pengawasan dan pengendalian mutu pekerjaan jalan" },
      { code: "M.71.JLN.103.01", name: "Melakukan Evaluasi Material Jalan", description: "Penilaian kesesuaian material dengan spesifikasi teknis" },
      { code: "M.71.JLN.104.01", name: "Mengelola Program Pemeliharaan Jalan", description: "Perencanaan dan pelaksanaan pemeliharaan rutin dan berkala jalan" },
      { code: "M.71.JLN.105.01", name: "Melakukan Survei Kondisi Jalan Komprehensif", description: "Survei IRI, SDI, dan kondisi struktur jalan" },
    ],
  },
  {
    id: "ahli-muda-teknik-jalan",
    name: "Ahli Muda Teknik Jalan",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Jalan",
    units: [
      { code: "M.71.JLN.201.01", name: "Melakukan Survei dan Investigasi Jalan", description: "Survei kondisi jalan, geometrik, dan investigasi lapangan" },
      { code: "M.71.JLN.202.01", name: "Mengawasi Pekerjaan Tanah Dasar Jalan", description: "Pengawasan pekerjaan galian, timbunan, dan pemadatan tanah dasar" },
      { code: "M.71.JLN.203.01", name: "Mengawasi Pekerjaan Lapis Pondasi Jalan", description: "Pengawasan pekerjaan LPA, LPB, dan base course" },
      { code: "M.71.JLN.204.01", name: "Mengawasi Pekerjaan Lapis Aspal Perkerasan", description: "Pengawasan pekerjaan AC-BC, AC-WC, dan prime/tack coat" },
      { code: "M.71.JLN.205.01", name: "Mengawasi Pekerjaan Drainase Jalan", description: "Pengawasan sistem drainase jalan dan bangunan pelengkap" },
      { code: "M.71.JLN.206.01", name: "Melakukan Pengujian Kualitas Pekerjaan Jalan", description: "Core drill, density test, dan pengujian kualitas lapangan" },
    ],
  },
  {
    id: "ahli-utama-material-jalan",
    name: "Ahli Utama Material Jalan",
    jenjang: "Utama",
    klasifikasi: "Sipil",
    subklasifikasi: "Jalan",
    units: [
      { code: "M.71.MTJ.001.01", name: "Merumuskan Spesifikasi Material Jalan Nasional", description: "Pengembangan standar material dan spesifikasi umum jalan" },
      { code: "M.71.MTJ.002.01", name: "Melakukan Evaluasi Material Inovatif Perkerasan", description: "Penilaian material baru (warm mix, RAP, rubber asphalt) untuk jalan" },
      { code: "M.71.MTJ.003.01", name: "Memimpin Penelitian dan Pengembangan Material Jalan", description: "Koordinasi riset pengembangan material perkerasan jalan" },
      { code: "M.71.MTJ.004.01", name: "Memberikan Pendapat Teknis Material Jalan", description: "Expert opinion untuk permasalahan material dan kegagalan perkerasan" },
      { code: "M.71.MTJ.005.01", name: "Menyusun Panduan Teknis Material Perkerasan", description: "Penyusunan manual teknis penggunaan material jalan" },
    ],
  },
  {
    id: "ahli-madya-material-jalan",
    name: "Ahli Madya Material Jalan",
    jenjang: "Madya",
    klasifikasi: "Sipil",
    subklasifikasi: "Jalan",
    units: [
      { code: "M.71.MTJ.101.01", name: "Melakukan Mix Design Campuran Aspal", description: "Perancangan campuran aspal (Marshall/Superpave) sesuai spesifikasi" },
      { code: "M.71.MTJ.102.01", name: "Mengelola Laboratorium Pengujian Jalan", description: "Manajemen dan akreditasi laboratorium pengujian material jalan" },
      { code: "M.71.MTJ.103.01", name: "Melakukan Evaluasi Kegagalan Perkerasan Jalan", description: "Analisis distress perkerasan dan rekomendasi penanganan" },
      { code: "M.71.MTJ.104.01", name: "Mengendalikan Mutu Material di Lapangan dan Laboratorium", description: "Quality control material selama pelaksanaan konstruksi jalan" },
      { code: "M.71.MTJ.105.01", name: "Menyusun Laporan Teknis Pengujian Material", description: "Penyusunan laporan hasil uji dan sertifikat mutu material" },
    ],
  },
  {
    id: "ahli-muda-material-jalan",
    name: "Ahli Muda Material Jalan",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Jalan",
    units: [
      { code: "M.71.MTJ.201.01", name: "Melakukan Pengujian Material Agregat Jalan", description: "Uji gradasi, keausan Los Angeles, dan kelekatan agregat" },
      { code: "M.71.MTJ.202.01", name: "Melakukan Marshall Test Campuran Aspal", description: "Pengujian marshall dan analisis campuran aspal di laboratorium" },
      { code: "M.71.MTJ.203.01", name: "Melakukan Pengujian Material Tanah Dasar Jalan", description: "CBR, Atterberg limit, kompaksi, dan klasifikasi tanah" },
      { code: "M.71.MTJ.204.01", name: "Mengambil Sampel Material di Lapangan", description: "Pengambilan sampel core drill, agregat, dan aspal di lapangan" },
      { code: "M.71.MTJ.205.01", name: "Mengoperasikan Peralatan Laboratorium Pengujian", description: "Penggunaan dan perawatan peralatan uji laboratorium jalan" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL — Jembatan
  // =====================================================
  {
    id: "ahli-utama-teknik-jembatan",
    name: "Ahli Utama Teknik Jembatan",
    jenjang: "Utama",
    klasifikasi: "Sipil",
    subklasifikasi: "Jembatan",
    units: [
      { code: "M.71.JBT.001.01", name: "Merumuskan Standar Teknis Perencanaan Jembatan", description: "Penyusunan standar dan pedoman teknis jembatan skala nasional" },
      { code: "M.71.JBT.002.01", name: "Melakukan Evaluasi Desain Jembatan Bentang Panjang", description: "Review desain jembatan cable-stayed, suspension, dan bentang panjang" },
      { code: "M.71.JBT.003.01", name: "Memimpin Program Inspeksi dan Pemeliharaan Jembatan", description: "Pengelolaan program inspeksi dan pemeliharaan aset jembatan nasional" },
      { code: "M.71.JBT.004.01", name: "Memberikan Pendapat Teknis Profesional Jembatan", description: "Expert opinion untuk permasalahan teknis dan kegagalan jembatan" },
      { code: "M.71.JBT.005.01", name: "Melakukan Evaluasi Kapasitas Struktural Jembatan", description: "Load rating dan penilaian kemampuan struktural jembatan eksisting" },
    ],
  },
  {
    id: "ahli-madya-teknik-jembatan",
    name: "Ahli Madya Teknik Jembatan",
    jenjang: "Madya",
    klasifikasi: "Sipil",
    subklasifikasi: "Jembatan",
    units: [
      { code: "M.71.JBT.101.01", name: "Merencanakan Struktur Jembatan", description: "Desain struktur jembatan beton prategang dan baja" },
      { code: "M.71.JBT.102.01", name: "Mengelola Pelaksanaan Konstruksi Jembatan", description: "Manajemen dan pengendalian pelaksanaan konstruksi jembatan" },
      { code: "M.71.JBT.103.01", name: "Melakukan Inspeksi Berkala Jembatan", description: "Inspeksi rutin dan khusus kondisi struktural jembatan" },
      { code: "M.71.JBT.104.01", name: "Mengendalikan Mutu Konstruksi Jembatan", description: "Pengendalian kualitas material dan pekerjaan konstruksi jembatan" },
      { code: "M.71.JBT.105.01", name: "Menyusun Program Rehabilitasi Jembatan", description: "Perencanaan dan penanganan kerusakan jembatan" },
    ],
  },
  {
    id: "ahli-muda-teknik-jembatan",
    name: "Ahli Muda Teknik Jembatan",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Jembatan",
    units: [
      { code: "M.71.JBT.201.01", name: "Melakukan Inspeksi Kondisi Jembatan", description: "Pemeriksaan rutin dan inspeksi detail kondisi jembatan" },
      { code: "M.71.JBT.202.01", name: "Mengawasi Pekerjaan Fondasi Jembatan", description: "Pengawasan pekerjaan fondasi tiang pancang dan bore pile" },
      { code: "M.71.JBT.203.01", name: "Mengawasi Pekerjaan Abutmen dan Pilar Jembatan", description: "Pengawasan konstruksi bangunan bawah jembatan" },
      { code: "M.71.JBT.204.01", name: "Mengawasi Pekerjaan Gelagar dan Lantai Jembatan", description: "Pengawasan pekerjaan struktur atas dan lantai jembatan" },
      { code: "M.71.JBT.205.01", name: "Melakukan Analisis Kerusakan Jembatan", description: "Identifikasi dan analisis jenis kerusakan struktur jembatan" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL — Bendung dan Bendungan
  // =====================================================
  {
    id: "ahli-utama-teknik-bendungan",
    name: "Ahli Utama Teknik Bendungan",
    jenjang: "Utama",
    klasifikasi: "Sipil",
    subklasifikasi: "Bendung dan Bendungan",
    units: [
      { code: "M.71.BND.001.01", name: "Merumuskan Kebijakan Keamanan Bendungan Nasional", description: "Penyusunan standar keamanan dan regulasi teknis bendungan" },
      { code: "M.71.BND.002.01", name: "Melakukan Evaluasi Keamanan Bendungan", description: "Penilaian komprehensif kondisi keamanan bendungan eksisting" },
      { code: "M.71.BND.003.01", name: "Memimpin Perencanaan Teknis Bendungan Besar", description: "Kepemimpinan desain bendungan dengan kapasitas > 10 juta m³" },
      { code: "M.71.BND.004.01", name: "Menyusun Rencana Tindak Darurat (EAP) Bendungan", description: "Penyusunan Emergency Action Plan bendungan" },
      { code: "M.71.BND.005.01", name: "Memberikan Pendapat Teknis Profesional Bendungan", description: "Expert opinion untuk permasalahan teknis keamanan bendungan" },
    ],
  },
  {
    id: "ahli-madya-teknik-bendungan",
    name: "Ahli Madya Teknik Bendungan",
    jenjang: "Madya",
    klasifikasi: "Sipil",
    subklasifikasi: "Bendung dan Bendungan",
    units: [
      { code: "M.71.BND.101.01", name: "Merencanakan Teknis Bendungan Urugan", description: "Desain teknis bendungan urugan tanah/batu" },
      { code: "M.71.BND.102.01", name: "Mengelola Pelaksanaan Konstruksi Bendungan", description: "Manajemen dan pengendalian pelaksanaan konstruksi bendungan" },
      { code: "M.71.BND.103.01", name: "Melakukan Inspeksi Berkala Bendungan", description: "Inspeksi rutin dan pemantauan kondisi bendungan" },
      { code: "M.71.BND.104.01", name: "Mengelola Operasi dan Pemeliharaan Bendungan", description: "Pengelolaan O&M bendungan sesuai standar keamanan" },
      { code: "M.71.BND.105.01", name: "Menganalisis Data Instrumentasi Bendungan", description: "Interpretasi data piezometer, settlement point, dan seismograph" },
    ],
  },
  {
    id: "ahli-muda-teknik-bendungan",
    name: "Ahli Muda Teknik Bendungan",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Bendung dan Bendungan",
    units: [
      { code: "M.71.BND.201.01", name: "Mengawasi Pekerjaan Timbunan Bendungan", description: "Pengawasan pekerjaan timbunan inti, filter, dan rip-rap" },
      { code: "M.71.BND.202.01", name: "Mengawasi Pekerjaan Beton Bangunan Bendungan", description: "Pengawasan pekerjaan beton spillway, intake, dan bangunan pelengkap" },
      { code: "M.71.BND.203.01", name: "Melakukan Pengujian Material Timbunan", description: "Uji pemadatan, permeabilitas, dan kuat geser material timbunan" },
      { code: "M.71.BND.204.01", name: "Memantau Instalasi Alat Instrumentasi Bendungan", description: "Pemasangan dan pembacaan alat pantau bendungan" },
      { code: "M.71.BND.205.01", name: "Membuat Laporan Teknis Pelaksanaan Bendungan", description: "Penyusunan laporan harian dan rekaman as-built konstruksi bendungan" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL — Irigasi dan Rawa
  // =====================================================
  {
    id: "ahli-utama-teknik-irigasi",
    name: "Ahli Utama Teknik Irigasi",
    jenjang: "Utama",
    klasifikasi: "Sipil",
    subklasifikasi: "Irigasi dan Rawa",
    units: [
      { code: "M.71.IRG.001.01", name: "Merumuskan Kebijakan Pengelolaan Irigasi Nasional", description: "Pengembangan kebijakan dan regulasi pengelolaan irigasi" },
      { code: "M.71.IRG.002.01", name: "Memimpin Perencanaan Sistem Irigasi Strategis", description: "Kepemimpinan perencanaan daerah irigasi besar (> 3.000 ha)" },
      { code: "M.71.IRG.003.01", name: "Memberikan Pendapat Teknis Profesional Irigasi", description: "Expert opinion untuk permasalahan pengelolaan sumber daya air irigasi" },
      { code: "M.71.IRG.004.01", name: "Melakukan Evaluasi Kinerja Sistem Irigasi Nasional", description: "Penilaian komprehensif efektivitas dan efisiensi irigasi nasional" },
      { code: "M.71.IRG.005.01", name: "Mengembangkan Teknologi Irigasi Modern", description: "Rekomendasi penerapan irigasi presisi dan teknologi smart irrigation" },
    ],
  },
  {
    id: "ahli-madya-teknik-irigasi",
    name: "Ahli Madya Teknik Irigasi",
    jenjang: "Madya",
    klasifikasi: "Sipil",
    subklasifikasi: "Irigasi dan Rawa",
    units: [
      { code: "M.71.IRG.101.01", name: "Merumuskan Rencana Pengelolaan Daerah Irigasi", description: "Penyusunan rencana pengelolaan DI secara terpadu" },
      { code: "M.71.IRG.102.01", name: "Mengelola Rehabilitasi Jaringan Irigasi", description: "Perencanaan dan pelaksanaan rehabilitasi jaringan irigasi" },
      { code: "M.71.IRG.103.01", name: "Mengelola Aset Infrastruktur Irigasi", description: "Inventarisasi dan pengelolaan aset infrastruktur irigasi" },
      { code: "M.71.IRG.104.01", name: "Melakukan Koordinasi Kelembagaan P3A/GP3A", description: "Fasilitasi dan pembinaan kelembagaan petani pemakai air" },
      { code: "M.71.IRG.105.01", name: "Menyusun Laporan Kinerja Pengelolaan Irigasi (IKSI)", description: "Penyusunan laporan Indeks Kinerja Sistem Irigasi" },
    ],
  },
  {
    id: "ahli-muda-teknik-irigasi",
    name: "Ahli Muda Teknik Irigasi",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Irigasi dan Rawa",
    units: [
      { code: "M.71.IRG.201.01", name: "Melakukan Analisis Kebutuhan Air Irigasi", description: "Perhitungan kebutuhan air tanaman dan debit rencana irigasi" },
      { code: "M.71.IRG.202.01", name: "Merencanakan Jaringan Saluran Irigasi", description: "Desain saluran primer, sekunder, dan tersier irigasi" },
      { code: "M.71.IRG.203.01", name: "Mengawasi Konstruksi Bangunan Irigasi", description: "Pengawasan pekerjaan saluran, bangunan bagi, dan pintu air" },
      { code: "M.71.IRG.204.01", name: "Mengelola Distribusi Air Irigasi", description: "Pengaturan giliran dan rotasi pemberian air irigasi" },
      { code: "M.71.IRG.205.01", name: "Melakukan Evaluasi Kinerja Jaringan Irigasi", description: "Penilaian efisiensi dan efektivitas jaringan irigasi" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL — Sungai dan Pantai
  // =====================================================
  {
    id: "ahli-utama-teknik-pantai",
    name: "Ahli Utama Teknik Pantai",
    jenjang: "Utama",
    klasifikasi: "Sipil",
    subklasifikasi: "Sungai dan Pantai",
    units: [
      { code: "M.71.PNT.001.01", name: "Merumuskan Kebijakan Pengelolaan Wilayah Pesisir", description: "Pengembangan strategi nasional pengelolaan pantai dan pesisir" },
      { code: "M.71.PNT.002.01", name: "Memimpin Perencanaan Pengamanan Pantai Nasional", description: "Kepemimpinan program perlindungan dan rehabilitasi pantai" },
      { code: "M.71.PNT.003.01", name: "Memberikan Pendapat Teknis Profesional Pantai", description: "Expert opinion untuk permasalahan rekayasa pantai dan pesisir" },
      { code: "M.71.PNT.004.01", name: "Melakukan Evaluasi Kinerja Bangunan Pantai", description: "Penilaian efektivitas bangunan pengaman pantai yang ada" },
      { code: "M.71.PNT.005.01", name: "Mengembangkan Teknologi Perlindungan Pantai Inovatif", description: "Rekomendasi solusi berbasis alam dan teknologi terkini pantai" },
    ],
  },
  {
    id: "ahli-madya-teknik-pantai",
    name: "Ahli Madya Teknik Pantai",
    jenjang: "Madya",
    klasifikasi: "Sipil",
    subklasifikasi: "Sungai dan Pantai",
    units: [
      { code: "M.71.PNT.101.01", name: "Merencanakan Bangunan Pelindung Pantai", description: "Desain breakwater, groin, revetment, dan sea wall" },
      { code: "M.71.PNT.102.01", name: "Melakukan Pemodelan Gelombang dan Arus Pantai", description: "Simulasi hidrodinamika pantai menggunakan software numerik" },
      { code: "M.71.PNT.103.01", name: "Mengelola Program Restorasi Pantai", description: "Perencanaan beach nourishment dan mangrove rehabilitation" },
      { code: "M.71.PNT.104.01", name: "Melakukan Kajian Dampak Lingkungan Bangunan Pantai", description: "Analisis dampak bangunan pantai terhadap ekosistem pesisir" },
      { code: "M.71.PNT.105.01", name: "Mengendalikan Mutu Konstruksi Bangunan Pantai", description: "Quality control pelaksanaan bangunan pengaman pantai" },
    ],
  },
  {
    id: "ahli-muda-teknik-pantai",
    name: "Ahli Muda Teknik Pantai",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Sungai dan Pantai",
    units: [
      { code: "M.71.PNT.201.01", name: "Melakukan Analisis Dinamika Pantai", description: "Analisis gelombang, arus, dan transpor sedimen pantai" },
      { code: "M.71.PNT.202.01", name: "Mengawasi Konstruksi Bangunan Pengaman Pantai", description: "Pengawasan pelaksanaan konstruksi revetment dan breakwater" },
      { code: "M.71.PNT.203.01", name: "Melakukan Pemantauan Perubahan Garis Pantai", description: "Monitoring abrasi dan akresi pantai secara berkala" },
      { code: "M.71.PNT.204.01", name: "Melakukan Pengukuran Oseanografi Dasar", description: "Pengukuran gelombang, pasang surut, dan arus laut" },
      { code: "M.71.PNT.205.01", name: "Membuat Laporan Teknis Kondisi Pantai", description: "Penyusunan laporan teknis pemantauan dan kondisi pantai" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL — Air Tanah dan Air Baku
  // =====================================================
  {
    id: "ahli-utama-teknik-sumber-daya-air",
    name: "Ahli Utama Bidang Keahlian Teknik Sumber Daya Air",
    jenjang: "Utama",
    klasifikasi: "Sipil",
    subklasifikasi: "Air Tanah dan Air Baku",
    units: [
      { code: "M.71.SDA.001.01", name: "Merumuskan Kebijakan Pengelolaan Sumber Daya Air", description: "Pengembangan kebijakan nasional pengelolaan sumber daya air terpadu" },
      { code: "M.71.SDA.002.01", name: "Memimpin Perencanaan Wilayah Sungai Strategis", description: "Kepemimpinan penyusunan pola dan rencana pengelolaan WS" },
      { code: "M.71.SDA.003.01", name: "Memberikan Pendapat Teknis Profesional SDA", description: "Expert opinion untuk permasalahan sumber daya air dan banjir" },
      { code: "M.71.SDA.004.01", name: "Melakukan Evaluasi Daya Dukung Sumber Daya Air", description: "Penilaian ketersediaan dan kebutuhan air dalam wilayah sungai" },
      { code: "M.71.SDA.005.01", name: "Mengembangkan Model Pengelolaan Sumber Daya Air", description: "Pengembangan model WRM untuk perencanaan SDA terintegrasi" },
    ],
  },
  {
    id: "ahli-madya-teknik-sumber-daya-air",
    name: "Ahli Madya Bidang Keahlian Teknik Sumber Daya Air",
    jenjang: "Madya",
    klasifikasi: "Sipil",
    subklasifikasi: "Air Tanah dan Air Baku",
    units: [
      { code: "M.71.SDA.101.01", name: "Merencanakan Sistem Pengendalian Banjir", description: "Desain infrastruktur pengendalian banjir kawasan" },
      { code: "M.71.SDA.102.01", name: "Melakukan Analisis Ketersediaan Air Wilayah", description: "Analisis neraca air dan potensi sumber daya air wilayah" },
      { code: "M.71.SDA.103.01", name: "Mengelola Pelaksanaan Konstruksi Bangunan SDA", description: "Manajemen konstruksi bangunan pengendali banjir dan SDA" },
      { code: "M.71.SDA.104.01", name: "Mengelola Operasi dan Pemeliharaan Prasarana SDA", description: "Pengelolaan O&M bangunan sungai, waduk, dan pompa" },
      { code: "M.71.SDA.105.01", name: "Melakukan Pemantauan Hidrologi dan Hidrometri", description: "Pengelolaan jaringan pemantauan hidrologi wilayah sungai" },
    ],
  },
  {
    id: "ahli-muda-teknik-sumber-daya-air",
    name: "Ahli Muda Bidang Keahlian Teknik Sumber Daya Air",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Air Tanah dan Air Baku",
    units: [
      { code: "M.71.SDA.201.01", name: "Melakukan Analisis Hidrologi Dasar", description: "Perhitungan debit banjir, kekeringan, dan analisis data hujan" },
      { code: "M.71.SDA.202.01", name: "Melakukan Analisis Hidrolika Saluran", description: "Pemodelan aliran dan profil muka air sungai/saluran" },
      { code: "M.71.SDA.203.01", name: "Mengawasi Konstruksi Bangunan Pengendali Sungai", description: "Pengawasan normalisasi sungai, tanggul, dan revetment" },
      { code: "M.71.SDA.204.01", name: "Melakukan Pengendalian Sedimentasi Sungai", description: "Analisis dan penanganan sedimentasi sungai" },
      { code: "M.71.SDA.205.01", name: "Membuat Laporan Teknis Pelaksanaan Pekerjaan SDA", description: "Penyusunan laporan teknis dan as-built pekerjaan SDA" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL — Drainase Perkotaan
  // =====================================================
  {
    id: "ahli-utama-perencanaan-drainase",
    name: "Ahli Utama Perencanaan Jaringan Drainase",
    jenjang: "Utama",
    klasifikasi: "Sipil",
    subklasifikasi: "Drainase Perkotaan",
    units: [
      { code: "M.71.DRN.001.01", name: "Merumuskan Kebijakan Pengelolaan Drainase Perkotaan", description: "Pengembangan kebijakan dan standar drainase perkotaan nasional" },
      { code: "M.71.DRN.002.01", name: "Memimpin Perencanaan Drainase Kota Besar", description: "Kepemimpinan penyusunan masterplan drainase kota metropolitan" },
      { code: "M.71.DRN.003.01", name: "Memberikan Pendapat Teknis Profesional Drainase", description: "Expert opinion untuk permasalahan banjir dan genangan perkotaan" },
      { code: "M.71.DRN.004.01", name: "Mengembangkan Konsep Drainase Berwawasan Lingkungan", description: "Pengembangan SUDS, ecodrainase, dan konsep drainase hijau" },
    ],
  },
  {
    id: "ahli-madya-perencanaan-drainase",
    name: "Ahli Madya Perencanaan Jaringan Drainase",
    jenjang: "Madya",
    klasifikasi: "Sipil",
    subklasifikasi: "Drainase Perkotaan",
    units: [
      { code: "M.71.DRN.101.01", name: "Merencanakan Sistem Drainase Kawasan", description: "Desain masterplan drainase kawasan permukiman dan perkotaan" },
      { code: "M.71.DRN.102.01", name: "Melakukan Pemodelan Hidrolika Drainase", description: "Simulasi aliran menggunakan HEC-RAS, SWMM, atau sejenisnya" },
      { code: "M.71.DRN.103.01", name: "Mengelola Pelaksanaan Konstruksi Drainase", description: "Pengawasan dan pengendalian konstruksi saluran drainase" },
      { code: "M.71.DRN.104.01", name: "Mengevaluasi Kinerja Sistem Drainase Eksisting", description: "Penilaian efektivitas sistem drainase terhadap genangan" },
      { code: "M.71.DRN.105.01", name: "Menyusun Rencana Pengelolaan Drainase Perkotaan", description: "Penyusunan rencana induk drainase dan program prioritas" },
    ],
  },
  {
    id: "ahli-muda-perencanaan-drainase",
    name: "Ahli Muda Perencanaan Jaringan Drainase",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Drainase Perkotaan",
    units: [
      { code: "M.71.DRN.201.01", name: "Melakukan Analisis Hidrologi Perkotaan", description: "Perhitungan debit rencana untuk sistem drainase kawasan" },
      { code: "M.71.DRN.202.01", name: "Merencanakan Saluran Drainase", description: "Desain penampang saluran drainase dan gorong-gorong" },
      { code: "M.71.DRN.203.01", name: "Mengawasi Konstruksi Saluran Drainase", description: "Pengawasan pelaksanaan pekerjaan saluran dan gorong-gorong" },
      { code: "M.71.DRN.204.01", name: "Merencanakan Sistem Pengelolaan Air Hujan", description: "Desain sumur resapan, biopori, dan tampungan air hujan" },
      { code: "M.71.DRN.205.01", name: "Membuat Laporan Teknis Pekerjaan Drainase", description: "Penyusunan laporan teknis pelaksanaan pekerjaan drainase" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL — Geoteknik dan Pondasi
  // =====================================================
  {
    id: "ahli-utama-geoteknik",
    name: "Ahli Utama Geoteknik",
    jenjang: "Utama",
    klasifikasi: "Sipil",
    subklasifikasi: "Geoteknik dan Pondasi",
    units: [
      { code: "M.71.GTK.001.01", name: "Merumuskan Standar Penyelidikan Geoteknik", description: "Pengembangan standar dan panduan teknis penyelidikan tanah" },
      { code: "M.71.GTK.002.01", name: "Melakukan Evaluasi Risiko Geoteknik Proyek Besar", description: "Penilaian risiko geoteknik untuk infrastruktur skala besar" },
      { code: "M.71.GTK.003.01", name: "Memberikan Pendapat Teknis Profesional Geoteknik", description: "Expert opinion untuk permasalahan tanah, pondasi, dan lereng" },
      { code: "M.71.GTK.004.01", name: "Memimpin Penyelidikan Tanah Proyek Strategis", description: "Kepemimpinan program penyelidikan geoteknik komprehensif" },
      { code: "M.71.GTK.005.01", name: "Melakukan Evaluasi Kegagalan Geoteknik", description: "Investigasi dan analisis kegagalan fondasi dan lereng" },
    ],
  },
  {
    id: "ahli-madya-geoteknik",
    name: "Ahli Madya Geoteknik",
    jenjang: "Madya",
    klasifikasi: "Sipil",
    subklasifikasi: "Geoteknik dan Pondasi",
    units: [
      { code: "M.71.GTK.101.01", name: "Merencanakan Program Penyelidikan Geoteknik", description: "Penyusunan program penyelidikan tanah untuk proyek konstruksi" },
      { code: "M.71.GTK.102.01", name: "Melakukan Analisis Daya Dukung dan Penurunan", description: "Perhitungan kapasitas dukung dan settlement pondasi" },
      { code: "M.71.GTK.103.01", name: "Melakukan Analisis Stabilitas Lereng", description: "Analisis stabilitas lereng dan penentuan faktor keamanan" },
      { code: "M.71.GTK.104.01", name: "Merencanakan Sistem Perbaikan Tanah", description: "Desain ground improvement (preloading, PVD, grouting)" },
      { code: "M.71.GTK.105.01", name: "Mengelola Pengujian Beban Tiang Fondasi", description: "Perencanaan dan interpretasi uji beban statik dan dinamik tiang" },
    ],
  },
  {
    id: "ahli-muda-geoteknik",
    name: "Ahli Muda Geoteknik",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Geoteknik dan Pondasi",
    units: [
      { code: "M.71.GTK.201.01", name: "Melakukan Penyelidikan Tanah di Lapangan", description: "Pelaksanaan boring, SPT, CPT, dan test pit" },
      { code: "M.71.GTK.202.01", name: "Melakukan Pengujian Tanah di Laboratorium", description: "Uji sifat fisik dan mekanik tanah di laboratorium" },
      { code: "M.71.GTK.203.01", name: "Menginterpretasikan Data Penyelidikan Tanah", description: "Analisis dan interpretasi data lapangan dan laboratorium" },
      { code: "M.71.GTK.204.01", name: "Mengawasi Pekerjaan Pondasi di Lapangan", description: "Pengawasan pelaksanaan pondasi tiang dan perbaikan tanah" },
      { code: "M.71.GTK.205.01", name: "Menyusun Laporan Penyelidikan Geoteknik", description: "Penyusunan laporan geoteknik sebagai basis desain pondasi" },
    ],
  },
  {
    id: "ahli-utama-geologi-konstruksi",
    name: "Ahli Utama Geologi Pekerjaan Konstruksi",
    jenjang: "Utama",
    klasifikasi: "Sipil",
    subklasifikasi: "Geoteknik dan Pondasi",
    units: [
      { code: "M.71.GEL.001.01", name: "Merumuskan Standar Pemetaan Geologi Teknik", description: "Pengembangan standar pemetaan dan investigasi geologi teknik" },
      { code: "M.71.GEL.002.01", name: "Memberikan Pendapat Teknis Profesional Geologi", description: "Expert opinion untuk permasalahan geologi konstruksi" },
      { code: "M.71.GEL.003.01", name: "Melakukan Evaluasi Risiko Geologi Proyek Besar", description: "Penilaian risiko geologi untuk infrastruktur strategis nasional" },
      { code: "M.71.GEL.004.01", name: "Memimpin Investigasi Geologi Terowongan dan Bendungan", description: "Kepemimpinan investigasi geologi proyek underground dan bendungan" },
    ],
  },
  {
    id: "ahli-madya-geologi-konstruksi",
    name: "Ahli Madya Geologi Pekerjaan Konstruksi",
    jenjang: "Madya",
    klasifikasi: "Sipil",
    subklasifikasi: "Geoteknik dan Pondasi",
    units: [
      { code: "M.71.GEL.101.01", name: "Melakukan Pemetaan Geologi Teknik", description: "Pemetaan kondisi geologi untuk keperluan konstruksi" },
      { code: "M.71.GEL.102.01", name: "Menganalisis Risiko Geologi pada Proyek Konstruksi", description: "Identifikasi dan mitigasi bahaya geologi (longsor, gempa, dll)" },
      { code: "M.71.GEL.103.01", name: "Melakukan Investigasi Geoteknik Proyek", description: "Penyelidikan dan interpretasi data geologi teknik lapangan" },
      { code: "M.71.GEL.104.01", name: "Menyusun Laporan Geologi Teknik", description: "Penyusunan laporan geologi teknik untuk desain konstruksi" },
      { code: "M.71.GEL.105.01", name: "Melakukan Klasifikasi Massa Batuan", description: "Aplikasi RMR, Q-system, dan GSI untuk desain terowongan/lereng" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL — Terowongan
  // =====================================================
  {
    id: "ahli-utama-teknik-terowongan",
    name: "Ahli Utama Teknik Terowongan",
    jenjang: "Utama",
    klasifikasi: "Sipil",
    subklasifikasi: "Terowongan",
    units: [
      { code: "M.71.TRW.001.01", name: "Merumuskan Standar Teknis Perencanaan Terowongan", description: "Penyusunan standar dan panduan teknis konstruksi terowongan" },
      { code: "M.71.TRW.002.01", name: "Memimpin Perencanaan Terowongan Bawah Tanah Kompleks", description: "Kepemimpinan desain terowongan jalan, kereta, dan multi-tunnel" },
      { code: "M.71.TRW.003.01", name: "Memberikan Pendapat Teknis Profesional Terowongan", description: "Expert opinion untuk permasalahan teknis dan kegagalan terowongan" },
      { code: "M.71.TRW.004.01", name: "Melakukan Evaluasi Risiko Konstruksi Terowongan", description: "Penilaian dan mitigasi risiko konstruksi bawah tanah" },
    ],
  },
  {
    id: "ahli-madya-teknik-terowongan",
    name: "Ahli Madya Teknik Terowongan",
    jenjang: "Madya",
    klasifikasi: "Sipil",
    subklasifikasi: "Terowongan",
    units: [
      { code: "M.71.TRW.101.01", name: "Merencanakan Teknis Konstruksi Terowongan", description: "Desain penggalian dan perkuatan terowongan (NATM/TBM)" },
      { code: "M.71.TRW.102.01", name: "Mengelola Pelaksanaan Konstruksi Terowongan", description: "Manajemen dan pengendalian pelaksanaan konstruksi terowongan" },
      { code: "M.71.TRW.103.01", name: "Melakukan Monitoring Perilaku Terowongan", description: "Analisis data instrumen dan pemantauan stabilitas terowongan" },
      { code: "M.71.TRW.104.01", name: "Mengelola K3 Khusus Pekerjaan Bawah Tanah", description: "Sistem keselamatan kerja dalam konstruksi terowongan" },
      { code: "M.71.TRW.105.01", name: "Melakukan Inspeksi dan Pemeliharaan Terowongan", description: "Inspeksi berkala dan program pemeliharaan terowongan" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL — Jalan Rel
  // =====================================================
  {
    id: "ahli-utama-teknik-jalan-rel",
    name: "Ahli Utama Teknik Jalan Rel",
    jenjang: "Utama",
    klasifikasi: "Sipil",
    subklasifikasi: "Jalan Rel",
    units: [
      { code: "M.71.REL.001.01", name: "Merumuskan Standar Teknis Pembangunan Jalan Rel", description: "Penyusunan standar dan pedoman teknis konstruksi rel kereta" },
      { code: "M.71.REL.002.01", name: "Memimpin Perencanaan Infrastruktur Perkeretaapian", description: "Kepemimpinan desain jalur kereta baru (MRT/LRT/KA cepat)" },
      { code: "M.71.REL.003.01", name: "Memberikan Pendapat Teknis Profesional Perkeretaapian", description: "Expert opinion untuk permasalahan teknis infrastruktur rel" },
      { code: "M.71.REL.004.01", name: "Melakukan Evaluasi Kinerja Prasarana Perkeretaapian", description: "Penilaian kondisi dan kinerja jalur kereta yang ada" },
    ],
  },
  {
    id: "ahli-madya-teknik-jalan-rel",
    name: "Ahli Madya Teknik Jalan Rel",
    jenjang: "Madya",
    klasifikasi: "Sipil",
    subklasifikasi: "Jalan Rel",
    units: [
      { code: "M.71.REL.101.01", name: "Merencanakan Geometrik Jalan Rel", description: "Desain alinyemen horizontal dan vertikal jalur kereta" },
      { code: "M.71.REL.102.01", name: "Mengelola Konstruksi Jalan Rel", description: "Manajemen pelaksanaan pembangunan jalur dan stasiun kereta" },
      { code: "M.71.REL.103.01", name: "Melakukan Inspeksi Kondisi Jalan Rel", description: "Pemeriksaan kondisi rel, bantalan, penambat, dan balas" },
      { code: "M.71.REL.104.01", name: "Mengelola Pemeliharaan Prasarana Rel", description: "Program pemeliharaan preventif dan korektif jalur kereta" },
      { code: "M.71.REL.105.01", name: "Mengendalikan Mutu Konstruksi Rel", description: "Quality control pekerjaan geometri dan material rel kereta" },
    ],
  },
  {
    id: "ahli-muda-teknik-jalan-rel",
    name: "Ahli Muda Teknik Jalan Rel",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Jalan Rel",
    units: [
      { code: "M.71.REL.201.01", name: "Mengawasi Pekerjaan Tubuh Baan Jalan Rel", description: "Pengawasan pekerjaan subgrade dan drainase rel kereta" },
      { code: "M.71.REL.202.01", name: "Mengawasi Pemasangan Ballast dan Bantalan", description: "Pengawasan pekerjaan balas, bantalan, dan geometri rel" },
      { code: "M.71.REL.203.01", name: "Melakukan Pengujian Geometri Jalan Rel", description: "Pengukuran lebar sepur, kemiringan, dan kerataan rel" },
      { code: "M.71.REL.204.01", name: "Melakukan Pengujian Material Rel dan Bantalan", description: "Pengujian kualitas rel, bantalan beton, dan penambat" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL — Bangunan Pelabuhan
  // =====================================================
  {
    id: "ahli-utama-teknik-dermaga",
    name: "Ahli Utama Teknik Dermaga",
    jenjang: "Utama",
    klasifikasi: "Sipil",
    subklasifikasi: "Bangunan Pelabuhan",
    units: [
      { code: "M.71.DRM.001.01", name: "Merumuskan Kebijakan Pembangunan Pelabuhan", description: "Pengembangan standar dan kebijakan teknis infrastruktur pelabuhan" },
      { code: "M.71.DRM.002.01", name: "Memimpin Perencanaan Pelabuhan Strategis", description: "Kepemimpinan desain pelabuhan skala besar dan internasional" },
      { code: "M.71.DRM.003.01", name: "Memberikan Pendapat Teknis Profesional Pelabuhan", description: "Expert opinion untuk permasalahan teknis infrastruktur pelabuhan" },
      { code: "M.71.DRM.004.01", name: "Melakukan Evaluasi Kapasitas dan Kinerja Pelabuhan", description: "Penilaian kapasitas dan kinerja operasional pelabuhan" },
    ],
  },
  {
    id: "ahli-madya-teknik-dermaga",
    name: "Ahli Madya Teknik Dermaga",
    jenjang: "Madya",
    klasifikasi: "Sipil",
    subklasifikasi: "Bangunan Pelabuhan",
    units: [
      { code: "M.71.DRM.101.01", name: "Merencanakan Struktur Dermaga dan Fasilitas Pelabuhan", description: "Desain struktur dermaga, dolphin, dan trestle" },
      { code: "M.71.DRM.102.01", name: "Melakukan Analisis Gelombang dan Ketenangan Kolam", description: "Analisis kondisi hidrodinamika untuk keamanan berlabuh" },
      { code: "M.71.DRM.103.01", name: "Mengelola Pelaksanaan Konstruksi Dermaga", description: "Manajemen konstruksi dermaga dan bangunan pelabuhan" },
      { code: "M.71.DRM.104.01", name: "Melakukan Inspeksi dan Pemeliharaan Dermaga", description: "Inspeksi struktural dan program pemeliharaan dermaga" },
      { code: "M.71.DRM.105.01", name: "Mengendalikan Mutu Konstruksi Pelabuhan", description: "Quality control pekerjaan pondasi dan struktur dermaga" },
    ],
  },
  {
    id: "ahli-muda-teknik-dermaga",
    name: "Ahli Muda Teknik Dermaga",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Bangunan Pelabuhan",
    units: [
      { code: "M.71.DRM.201.01", name: "Mengawasi Konstruksi Pondasi Dermaga", description: "Pengawasan pekerjaan tiang pancang/bor untuk dermaga" },
      { code: "M.71.DRM.202.01", name: "Mengawasi Pekerjaan Dek dan Suprastruktur Dermaga", description: "Pengawasan pekerjaan beton dek dan elemen struktur atas dermaga" },
      { code: "M.71.DRM.203.01", name: "Melakukan Pengukuran Bathimetri dan Survei Laut", description: "Survei kedalaman laut dan kondisi dasar perairan" },
      { code: "M.71.DRM.204.01", name: "Membuat Laporan Teknis Pekerjaan Dermaga", description: "Penyusunan laporan kemajuan dan as-built pekerjaan dermaga" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL — Landasan Udara
  // =====================================================
  {
    id: "ahli-utama-teknik-landasan-terbang",
    name: "Ahli Utama Teknik Landasan Terbang",
    jenjang: "Utama",
    klasifikasi: "Sipil",
    subklasifikasi: "Landasan Udara",
    units: [
      { code: "M.71.LDN.001.01", name: "Merumuskan Standar Teknis Perkerasan Bandar Udara", description: "Pengembangan standar perkerasan bandara sesuai ICAO/SNI" },
      { code: "M.71.LDN.002.01", name: "Memimpin Perencanaan Pengembangan Bandara", description: "Kepemimpinan desain runway, taxiway, apron, dan fasilitas bandara" },
      { code: "M.71.LDN.003.01", name: "Memberikan Pendapat Teknis Profesional Bandara", description: "Expert opinion untuk permasalahan teknis infrastruktur bandara" },
      { code: "M.71.LDN.004.01", name: "Melakukan Evaluasi Kinerja Perkerasan Bandara", description: "Penilaian kondisi perkerasan dan PCN bandara" },
    ],
  },
  {
    id: "ahli-madya-teknik-landasan-terbang",
    name: "Ahli Madya Teknik Landasan Terbang",
    jenjang: "Madya",
    klasifikasi: "Sipil",
    subklasifikasi: "Landasan Udara",
    units: [
      { code: "M.71.LDN.101.01", name: "Merencanakan Perkerasan Runway dan Taxiway", description: "Desain perkerasan aerodrome berdasarkan standar ICAO" },
      { code: "M.71.LDN.102.01", name: "Mengelola Konstruksi Perkerasan Bandara", description: "Manajemen pelaksanaan pekerjaan perkerasan bandara" },
      { code: "M.71.LDN.103.01", name: "Merencanakan Sistem Drainase Bandara", description: "Desain sistem drainase permukaan dan bawah permukaan bandara" },
      { code: "M.71.LDN.104.01", name: "Melakukan Evaluasi Kondisi Perkerasan Bandara (PCI)", description: "Penilaian kondisi perkerasan dengan metode PCI" },
      { code: "M.71.LDN.105.01", name: "Mengendalikan Mutu Konstruksi Bandara", description: "Quality control pekerjaan perkerasan dan drainase bandara" },
    ],
  },
  {
    id: "ahli-muda-teknik-landasan-terbang",
    name: "Ahli Muda Teknik Landasan Terbang",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Landasan Udara",
    units: [
      { code: "M.71.LDN.201.01", name: "Mengawasi Konstruksi Perkerasan Bandara", description: "Pengawasan pekerjaan runway, taxiway, dan apron" },
      { code: "M.71.LDN.202.01", name: "Melakukan Pengujian Material Perkerasan Bandara", description: "Pengujian material agregat, aspal, dan beton perkerasan bandara" },
      { code: "M.71.LDN.203.01", name: "Menerapkan Standar Keselamatan Operasional Bandara", description: "Penerapan persyaratan keselamatan area airside bandara" },
      { code: "M.71.LDN.204.01", name: "Membuat Laporan Teknis Pekerjaan Bandara", description: "Penyusunan laporan teknis dan rekaman mutu pekerjaan bandara" },
    ],
  },

  // =====================================================
  // C. KLASIFIKASI: MEKANIKAL
  // =====================================================
  {
    id: "ahli-utama-teknik-mekanikal",
    name: "Ahli Utama Bidang Keahlian Teknik Mekanikal",
    jenjang: "Utama",
    klasifikasi: "Mekanikal",
    subklasifikasi: "Teknik Mekanikal",
    units: [
      { code: "M.71.MKL.001.01", name: "Merumuskan Standar Sistem Mekanikal Bangunan", description: "Pengembangan standar teknis sistem mekanikal gedung" },
      { code: "M.71.MKL.002.01", name: "Memimpin Perencanaan Sistem Mekanikal Proyek Besar", description: "Kepemimpinan desain sistem mekanikal gedung kompleks" },
      { code: "M.71.MKL.003.01", name: "Memberikan Pendapat Teknis Profesional Mekanikal", description: "Expert opinion untuk permasalahan sistem mekanikal gedung" },
      { code: "M.71.MKL.004.01", name: "Melakukan Evaluasi Kinerja Energi Sistem Mekanikal", description: "Penilaian efisiensi energi sistem HVAC dan mekanikal gedung" },
    ],
  },
  {
    id: "ahli-madya-teknik-mekanikal",
    name: "Ahli Madya Bidang Keahlian Teknik Mekanikal",
    jenjang: "Madya",
    klasifikasi: "Mekanikal",
    subklasifikasi: "Teknik Mekanikal",
    units: [
      { code: "M.71.MKL.101.01", name: "Merencanakan Sistem HVAC Bangunan Kompleks", description: "Desain sistem tata udara untuk gedung bertingkat dan pusat perbelanjaan" },
      { code: "M.71.MKL.102.01", name: "Mengendalikan Pelaksanaan Instalasi Mekanikal", description: "Pengawasan dan pengendalian pemasangan sistem mekanikal" },
      { code: "M.71.MKL.103.01", name: "Melakukan Komisioning Sistem Mekanikal Gedung", description: "Pengujian dan komisioning sistem HVAC dan utilitas mekanikal" },
      { code: "M.71.MKL.104.01", name: "Mengelola Pemeliharaan Sistem Mekanikal Gedung", description: "Program O&M preventif dan korektif sistem mekanikal" },
      { code: "M.71.MKL.105.01", name: "Menyusun Spesifikasi Teknis Peralatan Mekanikal", description: "Penyusunan spesifikasi peralatan dan material mekanikal" },
    ],
  },
  {
    id: "ahli-muda-teknik-mekanikal",
    name: "Ahli Muda Bidang Keahlian Teknik Mekanikal",
    jenjang: "Muda",
    klasifikasi: "Mekanikal",
    subklasifikasi: "Teknik Mekanikal",
    units: [
      { code: "M.71.MKL.201.01", name: "Merencanakan Sistem HVAC Bangunan Standar", description: "Desain sistem tata udara (AC, ventilasi, exhaust) bangunan" },
      { code: "M.71.MKL.202.01", name: "Mengawasi Instalasi Sistem Mekanikal Gedung", description: "Pengawasan pemasangan sistem HVAC dan utilitas mekanikal" },
      { code: "M.71.MKL.203.01", name: "Membuat Gambar Teknis Sistem Mekanikal", description: "Penyusunan shop drawing dan as-built sistem mekanikal" },
      { code: "M.71.MKL.204.01", name: "Melakukan Pengujian Fungsi Sistem Mekanikal", description: "Balancing, TAB, dan pengujian fungsi peralatan mekanikal" },
    ],
  },
  {
    id: "ahli-utama-elektrikal-gedung",
    name: "Ahli Utama Elektrikal Konstruksi Bangunan Gedung",
    jenjang: "Utama",
    klasifikasi: "Mekanikal",
    subklasifikasi: "Teknik Mekanikal",
    units: [
      { code: "M.71.ELK.001.01", name: "Merumuskan Standar Instalasi Listrik Gedung", description: "Pengembangan standar dan panduan teknis instalasi listrik bangunan" },
      { code: "M.71.ELK.002.01", name: "Memimpin Perencanaan Sistem Elektrikal Proyek Besar", description: "Kepemimpinan desain sistem kelistrikan gedung skala besar" },
      { code: "M.71.ELK.003.01", name: "Memberikan Pendapat Teknis Profesional Elektrikal", description: "Expert opinion untuk permasalahan sistem kelistrikan bangunan" },
      { code: "M.71.ELK.004.01", name: "Melakukan Evaluasi Keandalan Sistem Elektrikal Gedung", description: "Penilaian keandalan dan keselamatan sistem distribusi daya" },
    ],
  },
  {
    id: "ahli-madya-elektrikal-gedung",
    name: "Ahli Madya Elektrikal Konstruksi Bangunan Gedung",
    jenjang: "Madya",
    klasifikasi: "Mekanikal",
    subklasifikasi: "Teknik Mekanikal",
    units: [
      { code: "M.71.ELK.101.01", name: "Merencanakan Distribusi Daya Gedung Bertingkat", description: "Desain sistem distribusi daya TM/TR untuk gedung besar" },
      { code: "M.71.ELK.102.01", name: "Merencanakan Sistem Keamanan dan Proteksi Gedung", description: "Desain BAS, CCTV, fire alarm, dan sistem keamanan gedung" },
      { code: "M.71.ELK.103.01", name: "Mengendalikan Mutu Instalasi Elektrikal Gedung", description: "Quality control pekerjaan instalasi listrik dan pengujian" },
      { code: "M.71.ELK.104.01", name: "Melakukan Komisioning Sistem Elektrikal", description: "Testing dan commissioning instalasi listrik dan peralatan" },
      { code: "M.71.ELK.105.01", name: "Mengelola Pemeliharaan Sistem Elektrikal Gedung", description: "Program pemeliharaan preventif dan korektif sistem listrik" },
    ],
  },
  {
    id: "ahli-muda-elektrikal-gedung",
    name: "Ahli Muda Elektrikal Konstruksi Bangunan Gedung",
    jenjang: "Muda",
    klasifikasi: "Mekanikal",
    subklasifikasi: "Teknik Mekanikal",
    units: [
      { code: "M.71.ELK.201.01", name: "Merencanakan Instalasi Listrik Tegangan Rendah", description: "Desain distribusi daya, panel, dan sistem grounding gedung" },
      { code: "M.71.ELK.202.01", name: "Merencanakan Sistem Tata Cahaya Bangunan", description: "Desain sistem pencahayaan buatan sesuai standar SNI" },
      { code: "M.71.ELK.203.01", name: "Merencanakan Sistem Penangkal Petir Gedung", description: "Desain sistem proteksi petir eksternal dan internal gedung" },
      { code: "M.71.ELK.204.01", name: "Mengawasi Instalasi Sistem Elektrikal Gedung", description: "Pengawasan pemasangan instalasi listrik dan panel distribusi" },
      { code: "M.71.ELK.205.01", name: "Melakukan Pengujian Sistem Kelistrikan Gedung", description: "Insulation test, grounding test, dan load test sistem listrik" },
    ],
  },
  {
    id: "ahli-utama-plambing-pompa",
    name: "Ahli Utama Teknik Plambing dan Pompa Mekanik",
    jenjang: "Utama",
    klasifikasi: "Mekanikal",
    subklasifikasi: "Plumbing dan Pompa Mekanik",
    units: [
      { code: "M.71.PLB.001.01", name: "Merumuskan Standar Teknis Plumbing Bangunan", description: "Pengembangan standar dan panduan plumbing gedung nasional" },
      { code: "M.71.PLB.002.01", name: "Memberikan Pendapat Teknis Profesional Plumbing", description: "Expert opinion untuk permasalahan sistem plumbing bangunan" },
      { code: "M.71.PLB.003.01", name: "Memimpin Perencanaan Sistem Plumbing Proyek Kompleks", description: "Kepemimpinan desain plumbing gedung/kawasan skala besar" },
      { code: "M.71.PLB.004.01", name: "Melakukan Evaluasi Keandalan Sistem Plumbing", description: "Penilaian keandalan sistem air bersih, sanitasi, dan pompa gedung" },
    ],
  },
  {
    id: "ahli-madya-plambing-pompa",
    name: "Ahli Madya Teknik Plambing dan Pompa Mekanik",
    jenjang: "Madya",
    klasifikasi: "Mekanikal",
    subklasifikasi: "Plumbing dan Pompa Mekanik",
    units: [
      { code: "M.71.PLB.101.01", name: "Merencanakan Sistem Plumbing Gedung Bertingkat", description: "Desain komprehensif sistem air bersih, kotor, dan pompa" },
      { code: "M.71.PLB.102.01", name: "Merencanakan Sistem Pengolahan Air Limbah Gedung", description: "Desain STP (Sewage Treatment Plant) dan grey water recycling" },
      { code: "M.71.PLB.103.01", name: "Mengendalikan Mutu Instalasi Plumbing", description: "Quality control pemasangan dan pengujian sistem plumbing" },
      { code: "M.71.PLB.104.01", name: "Mengelola Pemeliharaan Sistem Plumbing dan Pompa", description: "Program O&M sistem plumbing dan pompa gedung" },
      { code: "M.71.PLB.105.01", name: "Melakukan Komisioning Sistem Plumbing", description: "Testing dan commissioning sistem plumbing gedung" },
    ],
  },
  {
    id: "ahli-muda-plambing-pompa",
    name: "Ahli Muda Teknik Plambing dan Pompa Mekanik",
    jenjang: "Muda",
    klasifikasi: "Mekanikal",
    subklasifikasi: "Plumbing dan Pompa Mekanik",
    units: [
      { code: "M.71.PLB.201.01", name: "Merencanakan Sistem Distribusi Air Bersih Gedung", description: "Desain jaringan perpipaan air bersih dan titik layanan" },
      { code: "M.71.PLB.202.01", name: "Merencanakan Sistem Air Buangan dan Sanitasi", description: "Desain sistem perpipaan air kotor, air bekas, dan vent" },
      { code: "M.71.PLB.203.01", name: "Merencanakan Sistem Pompa Air Gedung", description: "Pemilihan dan desain sistem pompa transfer dan booster pump" },
      { code: "M.71.PLB.204.01", name: "Mengawasi Pemasangan Sistem Plumbing", description: "Pengawasan instalasi perpipaan plumbing gedung" },
      { code: "M.71.PLB.205.01", name: "Melakukan Pengujian Kebocoran Sistem Plumbing", description: "Uji tekanan, kebocoran, dan kualitas air sistem plumbing" },
    ],
  },
  {
    id: "ahli-utama-proteksi-kebakaran",
    name: "Ahli Utama Pengkaji Teknis Proteksi Kebakaran",
    jenjang: "Utama",
    klasifikasi: "Mekanikal",
    subklasifikasi: "Proteksi Kebakaran",
    units: [
      { code: "M.71.PKB.001.01", name: "Merumuskan Kebijakan Proteksi Kebakaran Bangunan", description: "Pengembangan standar dan regulasi proteksi kebakaran gedung" },
      { code: "M.71.PKB.002.01", name: "Memimpin Pengkajian Teknis Proteksi Kebakaran Kompleks", description: "Kepemimpinan kajian fire safety untuk gedung khusus/high-rise" },
      { code: "M.71.PKB.003.01", name: "Memberikan Pendapat Teknis Profesional Fire Safety", description: "Expert opinion untuk permasalahan dan sengketa proteksi kebakaran" },
      { code: "M.71.PKB.004.01", name: "Mengembangkan Performance-Based Fire Safety", description: "Kajian rekayasa kebakaran berbasis kinerja (fire engineering)" },
    ],
  },
  {
    id: "ahli-madya-proteksi-kebakaran",
    name: "Ahli Madya Pengkaji Teknis Proteksi Kebakaran",
    jenjang: "Madya",
    klasifikasi: "Mekanikal",
    subklasifikasi: "Proteksi Kebakaran",
    units: [
      { code: "M.71.PKB.101.01", name: "Melakukan Kajian Teknis Proteksi Kebakaran Gedung", description: "Review sistem fire safety gedung terhadap SNI dan regulasi" },
      { code: "M.71.PKB.102.01", name: "Merencanakan Sistem Proteksi Kebakaran Aktif", description: "Desain sistem sprinkler, hydrant, dan clean agent suppression" },
      { code: "M.71.PKB.103.01", name: "Merencanakan Sistem Manajemen Evakuasi Gedung", description: "Desain sistem evakuasi, signage, dan APAR gedung" },
      { code: "M.71.PKB.104.01", name: "Mengelola Pemeliharaan Sistem Proteksi Kebakaran", description: "Program pemeliharaan dan pengujian berkala sistem fire protection" },
      { code: "M.71.PKB.105.01", name: "Menyusun Laporan Hasil Pengkajian Fire Safety", description: "Penyusunan laporan dan rekomendasi teknis proteksi kebakaran" },
    ],
  },
  {
    id: "ahli-muda-proteksi-kebakaran",
    name: "Ahli Muda Pengkaji Teknis Proteksi Kebakaran",
    jenjang: "Muda",
    klasifikasi: "Mekanikal",
    subklasifikasi: "Proteksi Kebakaran",
    units: [
      { code: "M.71.PKB.201.01", name: "Merencanakan Sistem Deteksi dan Alarm Kebakaran", description: "Desain FACP, detektor asap/panas, dan alarm gedung" },
      { code: "M.71.PKB.202.01", name: "Merencanakan Sistem Sprinkler dan Hydrant Gedung", description: "Desain sistem sprinkler otomatis dan hydrant box gedung" },
      { code: "M.71.PKB.203.01", name: "Mengkaji Sistem Proteksi Kebakaran Pasif", description: "Review fire compartmentation, material tahan api, dan fire door" },
      { code: "M.71.PKB.204.01", name: "Mengawasi Instalasi Sistem Proteksi Kebakaran", description: "Pengawasan pemasangan sistem fire alarm dan pemadam kebakaran" },
      { code: "M.71.PKB.205.01", name: "Melakukan Pengujian Sistem Proteksi Kebakaran", description: "Acceptance testing sistem fire protection sebelum serah terima" },
    ],
  },
  {
    id: "ahli-utama-lift-eskalator",
    name: "Ahli Utama Pesawat Lift dan Eskalator",
    jenjang: "Utama",
    klasifikasi: "Mekanikal",
    subklasifikasi: "Transportasi Dalam Gedung",
    units: [
      { code: "M.71.LFT.001.01", name: "Merumuskan Standar Keselamatan Lift dan Eskalator", description: "Pengembangan standar dan regulasi keselamatan lift/eskalator" },
      { code: "M.71.LFT.002.01", name: "Memberikan Pendapat Teknis Profesional Lift", description: "Expert opinion untuk permasalahan teknis dan kecelakaan lift" },
      { code: "M.71.LFT.003.01", name: "Memimpin Program Sertifikasi Lift Nasional", description: "Kepemimpinan program pengawasan dan sertifikasi lift nasional" },
      { code: "M.71.LFT.004.01", name: "Mengembangkan Teknologi Transportasi Gedung Inovatif", description: "Evaluasi dan rekomendasi teknologi lift terbaru (smart elevator, MRL)" },
    ],
  },
  {
    id: "ahli-madya-lift-eskalator",
    name: "Ahli Madya Pesawat Lift dan Eskalator",
    jenjang: "Madya",
    klasifikasi: "Mekanikal",
    subklasifikasi: "Transportasi Dalam Gedung",
    units: [
      { code: "M.71.LFT.101.01", name: "Merencanakan Sistem Transportasi Vertikal Gedung", description: "Perencanaan kebutuhan dan pemilihan lift/eskalator berdasarkan trafik" },
      { code: "M.71.LFT.102.01", name: "Mengelola Instalasi Lift dan Eskalator", description: "Manajemen dan pengawasan pemasangan lift dan eskalator" },
      { code: "M.71.LFT.103.01", name: "Melakukan Inspeksi Keselamatan Berkala Lift", description: "Inspeksi keselamatan dan sertifikasi lift sesuai peraturan" },
      { code: "M.71.LFT.104.01", name: "Mengelola Program Pemeliharaan Lift dan Eskalator", description: "Program pemeliharaan preventif dan korektif lift/eskalator" },
      { code: "M.71.LFT.105.01", name: "Melakukan Modernisasi Lift Eksisting", description: "Perencanaan dan pengelolaan program modernisasi lift tua" },
    ],
  },
  {
    id: "ahli-muda-lift-eskalator",
    name: "Ahli Muda Pesawat Lift dan Eskalator",
    jenjang: "Muda",
    klasifikasi: "Mekanikal",
    subklasifikasi: "Transportasi Dalam Gedung",
    units: [
      { code: "M.71.LFT.201.01", name: "Mengawasi Instalasi Lift dan Eskalator", description: "Pengawasan pemasangan dan pengujian lift dan eskalator" },
      { code: "M.71.LFT.202.01", name: "Melakukan Pemeriksaan Keselamatan Lift", description: "Inspeksi keselamatan dan persiapan sertifikasi lift" },
      { code: "M.71.LFT.203.01", name: "Menangani Gangguan dan Troubleshooting Lift", description: "Diagnosis dan penanganan kerusakan sistem lift/eskalator" },
      { code: "M.71.LFT.204.01", name: "Membuat Laporan Teknis Pemasangan dan Pemeliharaan", description: "Penyusunan laporan teknis instalasi dan rekaman pemeliharaan" },
    ],
  },

  // =====================================================
  // D. KLASIFIKASI: TATA LINGKUNGAN
  // =====================================================
  {
    id: "ahli-utama-teknik-lingkungan",
    name: "Ahli Utama Teknik Lingkungan Bidang Jasa Konstruksi",
    jenjang: "Utama",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Teknik Lingkungan",
    units: [
      { code: "M.71.TLH.001.01", name: "Merumuskan Kebijakan Pengelolaan Lingkungan Konstruksi", description: "Pengembangan standar AMDAL dan pengelolaan lingkungan konstruksi" },
      { code: "M.71.TLH.002.01", name: "Memberikan Pendapat Teknis Profesional Lingkungan", description: "Expert opinion untuk permasalahan dampak lingkungan konstruksi" },
      { code: "M.71.TLH.003.01", name: "Memimpin Penilaian Dampak Lingkungan Proyek Strategis", description: "Kepemimpinan penyusunan AMDAL proyek strategis nasional" },
      { code: "M.71.TLH.004.01", name: "Mengembangkan Standar Konstruksi Berkelanjutan", description: "Pengembangan green construction standard dan low-carbon construction" },
    ],
  },
  {
    id: "ahli-madya-teknik-lingkungan",
    name: "Ahli Madya Teknik Lingkungan Bidang Jasa Konstruksi",
    jenjang: "Madya",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Teknik Lingkungan",
    units: [
      { code: "M.71.TLH.101.01", name: "Menyusun Dokumen AMDAL Proyek Konstruksi", description: "Penyusunan Analisis Mengenai Dampak Lingkungan proyek konstruksi" },
      { code: "M.71.TLH.102.01", name: "Mengelola Pelaksanaan RKL-RPL", description: "Pengelolaan implementasi rencana pemantauan dan pengelolaan lingkungan" },
      { code: "M.71.TLH.103.01", name: "Merencanakan Sistem Pengelolaan Limbah Konstruksi", description: "Perencanaan sistem pengelolaan dan daur ulang limbah konstruksi" },
      { code: "M.71.TLH.104.01", name: "Melakukan Audit Lingkungan Proyek", description: "Audit kinerja lingkungan dan kepatuhan proyek konstruksi" },
      { code: "M.71.TLH.105.01", name: "Menyusun Laporan Pemantauan Lingkungan Berkala", description: "Penyusunan laporan semester RKL-RPL untuk DPLH" },
    ],
  },
  {
    id: "ahli-muda-teknik-lingkungan",
    name: "Ahli Muda Teknik Lingkungan Bidang Jasa Konstruksi",
    jenjang: "Muda",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Teknik Lingkungan",
    units: [
      { code: "M.71.TLH.201.01", name: "Menyusun UKL-UPL Proyek Konstruksi", description: "Penyusunan Upaya Pengelolaan dan Pemantauan Lingkungan Hidup" },
      { code: "M.71.TLH.202.01", name: "Melakukan Pemantauan Lingkungan Proyek", description: "Monitoring kualitas udara, air, kebisingan, dan getaran di proyek" },
      { code: "M.71.TLH.203.01", name: "Menerapkan Pengelolaan Limbah Konstruksi", description: "Pelaksanaan pengelolaan dan pembuangan limbah konstruksi" },
      { code: "M.71.TLH.204.01", name: "Menyusun Laporan Pelaksanaan RKL-RPL", description: "Penyusunan laporan pengelolaan dan pemantauan lingkungan" },
    ],
  },
  {
    id: "ahli-utama-teknik-air-minum",
    name: "Ahli Utama Teknik Air Minum",
    jenjang: "Utama",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Teknik Air Minum",
    units: [
      { code: "M.71.TAM.001.01", name: "Merumuskan Kebijakan Penyelenggaraan SPAM", description: "Pengembangan regulasi dan kebijakan Sistem Penyediaan Air Minum" },
      { code: "M.71.TAM.002.01", name: "Memimpin Perencanaan SPAM Regional", description: "Kepemimpinan perencanaan SPAM skala regional/metropolitan" },
      { code: "M.71.TAM.003.01", name: "Memberikan Pendapat Teknis Profesional SPAM", description: "Expert opinion untuk permasalahan teknis air minum" },
      { code: "M.71.TAM.004.01", name: "Melakukan Evaluasi Kinerja Penyelenggaraan SPAM", description: "Penilaian kinerja SPAM berdasarkan BPPSPAM nasional" },
    ],
  },
  {
    id: "ahli-madya-teknik-air-minum",
    name: "Ahli Madya Teknik Air Minum",
    jenjang: "Madya",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Teknik Air Minum",
    units: [
      { code: "M.71.TAM.101.01", name: "Merencanakan Sistem Penyediaan Air Minum (SPAM)", description: "Desain IPA dan jaringan distribusi air minum" },
      { code: "M.71.TAM.102.01", name: "Mengelola Konstruksi Infrastruktur SPAM", description: "Manajemen pembangunan IPA dan jaringan pipa distribusi" },
      { code: "M.71.TAM.103.01", name: "Mengelola Operasi Instalasi Pengolahan Air", description: "Pengelolaan proses pengolahan air di IPA" },
      { code: "M.71.TAM.104.01", name: "Melakukan Evaluasi Kinerja Teknis SPAM", description: "Penilaian efisiensi produksi, distribusi, dan NRW" },
      { code: "M.71.TAM.105.01", name: "Menyusun Rencana Induk SPAM", description: "Penyusunan masterplan pengembangan SPAM kawasan" },
    ],
  },
  {
    id: "ahli-muda-teknik-air-minum",
    name: "Ahli Muda Teknik Air Minum",
    jenjang: "Muda",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Teknik Air Minum",
    units: [
      { code: "M.71.TAM.201.01", name: "Merencanakan Jaringan Distribusi Air Minum", description: "Desain sistem jaringan distribusi dan titik layanan air minum" },
      { code: "M.71.TAM.202.01", name: "Mengawasi Konstruksi SPAM", description: "Pengawasan pembangunan jaringan pipa dan bangunan air" },
      { code: "M.71.TAM.203.01", name: "Melakukan Uji Kualitas Air Minum", description: "Pengujian parameter fisik, kimia, dan biologis air minum" },
      { code: "M.71.TAM.204.01", name: "Melakukan Analisis Kehilangan Air (NRW)", description: "Identifikasi dan penanganan kebocoran jaringan distribusi" },
    ],
  },
  {
    id: "ahli-utama-teknik-perpipaan",
    name: "Ahli Utama Teknik Perpipaan",
    jenjang: "Utama",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Teknik Perpipaan",
    units: [
      { code: "M.71.PRP.001.01", name: "Merumuskan Standar Teknis Perpipaan", description: "Pengembangan standar dan pedoman teknis sistem perpipaan" },
      { code: "M.71.PRP.002.01", name: "Memberikan Pendapat Teknis Profesional Perpipaan", description: "Expert opinion untuk permasalahan sistem perpipaan" },
      { code: "M.71.PRP.003.01", name: "Memimpin Perencanaan Sistem Perpipaan Besar", description: "Kepemimpinan desain pipa transmisi air dan gas" },
      { code: "M.71.PRP.004.01", name: "Melakukan Evaluasi Integritas Jaringan Pipa", description: "Penilaian integritas dan keandalan infrastruktur perpipaan" },
    ],
  },
  {
    id: "ahli-madya-teknik-perpipaan",
    name: "Ahli Madya Teknik Perpipaan",
    jenjang: "Madya",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Teknik Perpipaan",
    units: [
      { code: "M.71.PRP.101.01", name: "Merencanakan Sistem Perpipaan Transmisi", description: "Desain pipa transmisi air bersih dan air limbah" },
      { code: "M.71.PRP.102.01", name: "Mengelola Konstruksi Jaringan Perpipaan", description: "Manajemen pelaksanaan pemasangan pipa dan aksesori" },
      { code: "M.71.PRP.103.01", name: "Melakukan Pengujian Integritas Jaringan Pipa", description: "Uji tekanan, kebocoran, dan NDT pada jaringan pipa" },
      { code: "M.71.PRP.104.01", name: "Mengelola Pemeliharaan Jaringan Perpipaan", description: "Program pemeliharaan dan perbaikan jaringan pipa" },
      { code: "M.71.PRP.105.01", name: "Menyusun As-Built Drawing Jaringan Perpipaan", description: "Penyusunan gambar purna bangun jaringan pipa" },
    ],
  },
  {
    id: "ahli-muda-teknik-perpipaan",
    name: "Ahli Muda Teknik Perpipaan",
    jenjang: "Muda",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Teknik Perpipaan",
    units: [
      { code: "M.71.PRP.201.01", name: "Merencanakan Sistem Perpipaan Distribusi", description: "Desain jaringan distribusi perpipaan air dan sanitasi" },
      { code: "M.71.PRP.202.01", name: "Mengawasi Pemasangan Pipa dan Fitting", description: "Pengawasan pemasangan pipa, fitting, dan aksesori" },
      { code: "M.71.PRP.203.01", name: "Melakukan Pengujian Kebocoran Sistem Pipa", description: "Uji tekanan dan deteksi kebocoran pada jaringan pipa" },
      { code: "M.71.PRP.204.01", name: "Membuat Gambar Teknis Jaringan Perpipaan", description: "Penyusunan shop drawing dan as-built jaringan pipa" },
    ],
  },
  {
    id: "ahli-utama-perencana-pengelolaan-sampah",
    name: "Ahli Utama Perencana Pengelolaan Sampah",
    jenjang: "Utama",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Teknik Persampahan",
    units: [
      { code: "M.71.SMP.001.01", name: "Merumuskan Kebijakan Pengelolaan Sampah Nasional", description: "Pengembangan regulasi dan kebijakan pengelolaan sampah" },
      { code: "M.71.SMP.002.01", name: "Memberikan Pendapat Teknis Profesional Persampahan", description: "Expert opinion untuk permasalahan teknis persampahan" },
      { code: "M.71.SMP.003.01", name: "Memimpin Perencanaan Pengelolaan Sampah Kota Besar", description: "Kepemimpinan masterplan persampahan kota metropolitan" },
      { code: "M.71.SMP.004.01", name: "Mengembangkan Teknologi Pengolahan Sampah Inovatif", description: "Rekomendasi teknologi WtE, anaerobic digestion, dan RDF" },
    ],
  },
  {
    id: "ahli-madya-perencana-pengelolaan-sampah",
    name: "Ahli Madya Perencana Pengelolaan Sampah",
    jenjang: "Madya",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Teknik Persampahan",
    units: [
      { code: "M.71.SMP.101.01", name: "Merencanakan Sistem Pengelolaan Persampahan Kawasan", description: "Desain sistem pengumpulan, pemindahan, dan TPS kawasan" },
      { code: "M.71.SMP.102.01", name: "Merencanakan Tempat Pemrosesan Akhir (TPA)", description: "Perencanaan teknis TPA sanitary landfill sesuai standar" },
      { code: "M.71.SMP.103.01", name: "Melakukan Kajian Timbulan dan Komposisi Sampah", description: "Pengukuran timbulan, komposisi, dan karakteristik sampah" },
      { code: "M.71.SMP.104.01", name: "Mengelola Konstruksi Fasilitas Persampahan", description: "Manajemen pembangunan TPA, TPS 3R, dan fasilitas persampahan" },
      { code: "M.71.SMP.105.01", name: "Melakukan Evaluasi Kinerja Pengelolaan Sampah", description: "Penilaian efektivitas sistem pengelolaan sampah kawasan" },
    ],
  },
  {
    id: "ahli-muda-perencana-pengelolaan-sampah",
    name: "Ahli Muda Perencana Pengelolaan Sampah",
    jenjang: "Muda",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Teknik Persampahan",
    units: [
      { code: "M.71.SMP.201.01", name: "Merencanakan Fasilitas Pengolahan Sampah 3R", description: "Desain TPS 3R, bank sampah, dan composting facility" },
      { code: "M.71.SMP.202.01", name: "Mengawasi Konstruksi Fasilitas Persampahan", description: "Pengawasan pembangunan TPS, TPS 3R, dan TPA" },
      { code: "M.71.SMP.203.01", name: "Melakukan Survei Timbulan Sampah", description: "Pengukuran timbulan dan komposisi sampah kawasan" },
      { code: "M.71.SMP.204.01", name: "Menyusun Rencana Pengelolaan Sampah Kawasan", description: "Penyusunan dokumen rencana pengelolaan sampah kawasan/kota" },
    ],
  },
  {
    id: "arsitek-lanskap-utama",
    name: "Arsitek Lanskap Utama",
    jenjang: "Utama",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Arsitektur Lanskap",
    units: [
      { code: "M.71.LNK.001.01", name: "Merumuskan Konsep Desain Lanskap Kawasan Besar", description: "Perancangan konsep lanskap untuk taman kota dan kawasan besar" },
      { code: "M.71.LNK.002.01", name: "Memberikan Pendapat Teknis Profesional Lanskap", description: "Expert opinion untuk permasalahan desain dan rekayasa lanskap" },
      { code: "M.71.LNK.003.01", name: "Memimpin Perencanaan Ruang Terbuka Hijau Kota", description: "Kepemimpinan masterplan RTH kota dan kawasan" },
      { code: "M.71.LNK.004.01", name: "Mengembangkan Konsep Lanskap Berkelanjutan", description: "Pengembangan konsep nature-based solutions dalam perencanaan kota" },
    ],
  },
  {
    id: "arsitek-lanskap-madya",
    name: "Arsitek Lanskap Madya",
    jenjang: "Madya",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Arsitektur Lanskap",
    units: [
      { code: "M.71.LNK.101.01", name: "Merancang Taman dan Ruang Terbuka Hijau", description: "Desain detail taman kota, taman lingkungan, dan plaza" },
      { code: "M.71.LNK.102.01", name: "Mengelola Pelaksanaan Pekerjaan Lanskap", description: "Manajemen konstruksi taman, lanskap, dan irigasi taman" },
      { code: "M.71.LNK.103.01", name: "Merencanakan Pengelolaan RTH Kawasan", description: "Perencanaan operasi dan pemeliharaan ruang terbuka hijau" },
      { code: "M.71.LNK.104.01", name: "Melakukan Kajian Lingkungan Visual Kawasan", description: "Analisis visual environment dan rekomendasi penataan lanskap" },
      { code: "M.71.LNK.105.01", name: "Menyusun Dokumen Perencanaan Lanskap", description: "Penyusunan gambar rencana, spesifikasi, dan RAB lanskap" },
    ],
  },
  {
    id: "arsitek-lanskap-muda",
    name: "Arsitek Lanskap Muda",
    jenjang: "Muda",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Arsitektur Lanskap",
    units: [
      { code: "M.71.LNK.201.01", name: "Membuat Rancangan Arsitektur Lanskap", description: "Perancangan taman, ruang terbuka hijau, dan landscape" },
      { code: "M.71.LNK.202.01", name: "Membuat Gambar Teknis Pekerjaan Taman", description: "Penyusunan gambar teknis dan spesifikasi pekerjaan lanskap" },
      { code: "M.71.LNK.203.01", name: "Mengawasi Pelaksanaan Pekerjaan Taman", description: "Pengawasan penanaman, pengerasan jalan taman, dan irigasi" },
      { code: "M.71.LNK.204.01", name: "Melakukan Pemilihan Jenis Tanaman Lanskap", description: "Pemilihan spesies tanaman sesuai kondisi iklim dan site" },
    ],
  },
  {
    id: "ahli-utama-perencanaan-iluminasi",
    name: "Ahli Utama Perencanaan Iluminasi",
    jenjang: "Utama",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Teknik Iluminasi",
    units: [
      { code: "M.71.ILM.001.01", name: "Merumuskan Standar Pencahayaan Bangunan Nasional", description: "Pengembangan standar dan pedoman teknis sistem pencahayaan" },
      { code: "M.71.ILM.002.01", name: "Memberikan Pendapat Teknis Profesional Iluminasi", description: "Expert opinion untuk permasalahan sistem pencahayaan" },
      { code: "M.71.ILM.003.01", name: "Memimpin Perencanaan Sistem Pencahayaan Proyek Besar", description: "Kepemimpinan desain pencahayaan kawasan dan gedung ikonik" },
      { code: "M.71.ILM.004.01", name: "Mengembangkan Konsep Pencahayaan Hemat Energi", description: "Pengembangan sistem smart lighting dan efisiensi pencahayaan" },
    ],
  },
  {
    id: "ahli-madya-perencanaan-iluminasi",
    name: "Ahli Madya Perencanaan Iluminasi",
    jenjang: "Madya",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Teknik Iluminasi",
    units: [
      { code: "M.71.ILM.101.01", name: "Merencanakan Sistem Pencahayaan Interior dan Eksterior", description: "Desain pencahayaan interior gedung dan eksterior kawasan" },
      { code: "M.71.ILM.102.01", name: "Melakukan Simulasi dan Kalkulasi Pencahayaan", description: "Simulasi pencahayaan menggunakan software (DIALux, Relux)" },
      { code: "M.71.ILM.103.01", name: "Merencanakan Sistem Pencahayaan Jalan dan Kawasan", description: "Desain penerangan jalan umum dan kawasan outdoor" },
      { code: "M.71.ILM.104.01", name: "Mengendalikan Mutu Instalasi Sistem Pencahayaan", description: "Quality control pemasangan lampu dan perangkat kontrol" },
      { code: "M.71.ILM.105.01", name: "Melakukan Audit Energi Sistem Pencahayaan", description: "Penilaian efisiensi energi dan rekomendasi perbaikan sistem pencahayaan" },
    ],
  },
  {
    id: "ahli-muda-perencanaan-iluminasi",
    name: "Ahli Muda Perencanaan Iluminasi",
    jenjang: "Muda",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Teknik Iluminasi",
    units: [
      { code: "M.71.ILM.201.01", name: "Membuat Konsep Perancangan Sistem Pencahayaan", description: "Perancangan konsep sistem pencahayaan bangunan" },
      { code: "M.71.ILM.202.01", name: "Melakukan Perhitungan Teknis Pencahayaan", description: "Kalkulasi tingkat pencahayaan berdasarkan standar SNI" },
      { code: "M.71.ILM.203.01", name: "Membuat Gambar Teknis Sistem Iluminasi", description: "Penyusunan gambar rencana dan shop drawing sistem pencahayaan" },
      { code: "M.71.ILM.204.01", name: "Mengawasi Pemasangan Sistem Pencahayaan", description: "Pengawasan instalasi lampu, fitting, dan perangkat kontrol" },
      { code: "M.71.ILM.205.01", name: "Melakukan Pengukuran Kinerja Sistem Pencahayaan", description: "Pengukuran illuminance, luminance, dan uniformity ratio" },
    ],
  },

  // =====================================================
  // E. MANAJEMEN PELAKSANAAN — Manajemen Konstruksi
  // =====================================================
  {
    id: "ahli-utama-manajemen-konstruksi",
    name: "Ahli Utama Bidang Keahlian Manajemen Konstruksi",
    jenjang: "Utama",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Manajemen Konstruksi",
    units: [
      { code: "M.711000.001.01", name: "Merumuskan Strategi Manajemen Konstruksi Nasional", description: "Pengembangan sistem dan kebijakan manajemen konstruksi skala nasional" },
      { code: "M.711000.002.01", name: "Memimpin Program Pembangunan Infrastruktur Strategis", description: "Kepemimpinan dan pengendalian program konstruksi skala besar" },
      { code: "M.711000.003.01", name: "Melakukan Evaluasi Kinerja Proyek Konstruksi", description: "Penilaian komprehensif kinerja proyek konstruksi nasional" },
      { code: "M.711000.004.01", name: "Menyusun Standar Kompetensi Manajemen Konstruksi", description: "Pengembangan dan evaluasi standar kompetensi bidang MK" },
      { code: "M.711000.005.01", name: "Memberikan Pendapat Teknis Profesional Manajemen Konstruksi", description: "Expert opinion dalam sengketa dan permasalahan konstruksi" },
      { code: "M.711000.006.01", name: "Memimpin Evaluasi Kontrak Konstruksi Kompleks", description: "Review dan evaluasi kontrak konstruksi berskala besar" },
    ],
  },
  {
    id: "ahli-madya-manajemen-konstruksi",
    name: "Ahli Madya Bidang Keahlian Manajemen Konstruksi",
    jenjang: "Madya",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Manajemen Konstruksi",
    units: [
      { code: "M.711000.101.01", name: "Merumuskan Strategi Manajemen Proyek Konstruksi", description: "Penyusunan strategi dan rencana manajemen proyek konstruksi" },
      { code: "M.711000.102.01", name: "Mengelola Komunikasi dan Pemangku Kepentingan Proyek", description: "Pengelolaan komunikasi proyek dan hubungan dengan stakeholder" },
      { code: "M.711000.103.01", name: "Mengelola Risiko Proyek Konstruksi", description: "Identifikasi, analisis, dan mitigasi risiko proyek" },
      { code: "M.711000.104.01", name: "Mengelola Pengadaan Proyek Konstruksi", description: "Proses pengadaan material, jasa, dan subkontraktor" },
      { code: "M.711000.105.01", name: "Mengelola Perubahan Lingkup Proyek Konstruksi", description: "Pengendalian perubahan lingkup, jadwal, dan biaya proyek" },
      { code: "M.711000.106.01", name: "Melakukan Serah Terima Proyek Konstruksi", description: "Proses komisioning, serah terima, dan penutupan proyek" },
    ],
  },
  {
    id: "ahli-muda-manajemen-konstruksi",
    name: "Ahli Muda Bidang Keahlian Manajemen Konstruksi",
    jenjang: "Muda",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Manajemen Konstruksi",
    units: [
      { code: "M.711000.201.01", name: "Menerapkan Sistem Manajemen K3 Konstruksi", description: "Penerapan sistem keselamatan dan kesehatan kerja dalam proyek" },
      { code: "M.711000.202.01", name: "Menerapkan Peraturan Perundang-undangan Konstruksi", description: "Pemahaman dan penerapan regulasi terkait pekerjaan konstruksi" },
      { code: "M.711000.203.01", name: "Mengelola Lingkup Pekerjaan Konstruksi", description: "Pengelolaan dan pengendalian ruang lingkup proyek" },
      { code: "M.711000.204.01", name: "Mengelola Waktu Pelaksanaan Konstruksi", description: "Penyusunan dan pengendalian jadwal pelaksanaan proyek" },
      { code: "M.711000.205.01", name: "Mengelola Biaya Pekerjaan Konstruksi", description: "Perencanaan, pengendalian, dan pelaporan biaya proyek" },
      { code: "M.711000.206.01", name: "Mengelola Mutu Pekerjaan Konstruksi", description: "Pengendalian dan jaminan mutu hasil pekerjaan konstruksi" },
    ],
  },

  // =====================================================
  // E. MANAJEMEN PELAKSANAAN — Manajemen Proyek
  // =====================================================
  {
    id: "ahli-utama-manajemen-proyek",
    name: "Ahli Utama Manajemen Proyek",
    jenjang: "Utama",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Manajemen Konstruksi/Manajemen Proyek",
    units: [
      { code: "M.71.MPR.001.01", name: "Memimpin Program Konstruksi Multi-Proyek", description: "Pengelolaan program konstruksi dengan banyak proyek terintegrasi" },
      { code: "M.71.MPR.002.01", name: "Merumuskan Kebijakan Manajemen Proyek Organisasi", description: "Pengembangan PMO dan standar manajemen proyek korporasi" },
      { code: "M.71.MPR.003.01", name: "Mengelola Portofolio Proyek Konstruksi", description: "Pengelolaan portofolio dan prioritisasi program konstruksi" },
      { code: "M.71.MPR.004.01", name: "Memberikan Pendapat Ahli dalam Sengketa Proyek", description: "Expert witness dan mediasi dalam sengketa konstruksi" },
      { code: "M.71.MPR.005.01", name: "Melakukan Evaluasi Kinerja Kontraktor", description: "Penilaian kinerja dan kapasitas kontraktor" },
    ],
  },
  {
    id: "ahli-madya-manajemen-proyek",
    name: "Ahli Madya Manajemen Proyek",
    jenjang: "Madya",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Manajemen Konstruksi/Manajemen Proyek",
    units: [
      { code: "M.71.MPR.101.01", name: "Mengelola Integrasi Proyek Konstruksi", description: "Koordinasi dan integrasi semua aspek manajemen proyek" },
      { code: "M.71.MPR.102.01", name: "Mengelola Jadwal Proyek Konstruksi Kompleks", description: "Penyusunan dan pengendalian master schedule proyek" },
      { code: "M.71.MPR.103.01", name: "Mengelola Biaya Proyek Konstruksi", description: "Estimasi, anggaran, dan pengendalian biaya proyek" },
      { code: "M.71.MPR.104.01", name: "Mengelola Kualitas Proyek Konstruksi", description: "Sistem penjaminan mutu dan quality control proyek" },
      { code: "M.71.MPR.105.01", name: "Mengelola Sumber Daya Manusia Proyek", description: "Pengelolaan tim, subkontraktor, dan SDM proyek" },
    ],
  },
  {
    id: "ahli-muda-manajemen-proyek",
    name: "Ahli Muda Manajemen Proyek",
    jenjang: "Muda",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Manajemen Konstruksi/Manajemen Proyek",
    units: [
      { code: "M.71.MPR.201.01", name: "Menyusun Rencana Pelaksanaan Proyek (PMP)", description: "Penyusunan Project Management Plan seluruh area pengetahuan" },
      { code: "M.71.MPR.202.01", name: "Membuat Work Breakdown Structure (WBS)", description: "Dekomposisi pekerjaan ke dalam WBS dan activity list" },
      { code: "M.71.MPR.203.01", name: "Membuat Jadwal Proyek dan Network Diagram", description: "Penyusunan network diagram, critical path, dan kurva-S" },
      { code: "M.71.MPR.204.01", name: "Melakukan Pengendalian Progres Proyek", description: "Monitoring dan pelaporan kemajuan pekerjaan vs baseline" },
      { code: "M.71.MPR.205.01", name: "Menyusun Laporan Kemajuan Proyek", description: "Penyusunan progress report harian, mingguan, dan bulanan" },
    ],
  },
  {
    id: "manajer-logistik-proyek",
    name: "Manajer Logistik Proyek",
    jenjang: "Muda",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Manajemen Konstruksi/Manajemen Proyek",
    units: [
      { code: "M.71.LOG.001.01", name: "Merencanakan Kebutuhan Material dan Peralatan Proyek", description: "Penyusunan material schedule dan equipment plan" },
      { code: "M.71.LOG.002.01", name: "Mengelola Pengadaan Material Konstruksi", description: "Proses tender, seleksi vendor, dan pembelian material" },
      { code: "M.71.LOG.003.01", name: "Mengelola Gudang dan Stok Material Proyek", description: "Pengelolaan penerimaan, penyimpanan, dan pengeluaran material" },
      { code: "M.71.LOG.004.01", name: "Mengelola Transportasi Material dan Peralatan", description: "Koordinasi pengiriman material dan mobilisasi peralatan" },
      { code: "M.71.LOG.005.01", name: "Melakukan Pengendalian Biaya Logistik Proyek", description: "Pemantauan dan pengendalian anggaran logistik" },
    ],
  },

  // =====================================================
  // E. MANAJEMEN PELAKSANAAN — K3 Konstruksi
  // =====================================================
  {
    id: "ahli-utama-k3-konstruksi",
    name: "Ahli Utama K3 Konstruksi",
    jenjang: "Utama",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Keselamatan Konstruksi",
    units: [
      { code: "F.43.91100.001.01", name: "Merumuskan Kebijakan K3 Konstruksi Nasional", description: "Pengembangan sistem dan regulasi K3 konstruksi skala nasional" },
      { code: "F.43.91100.002.01", name: "Memimpin Audit Sistem Manajemen K3 Konstruksi", description: "Audit dan evaluasi SMKK pada proyek konstruksi besar" },
      { code: "F.43.91100.003.01", name: "Memberikan Pendapat Teknis Profesional K3", description: "Expert opinion dalam kasus kecelakaan dan sengketa K3" },
      { code: "F.43.91100.004.01", name: "Memimpin Investigasi Kecelakaan Kerja Berat", description: "Investigasi dan analisis akar masalah kecelakaan kerja fatal" },
      { code: "F.43.91100.005.01", name: "Mengembangkan Sistem Manajemen K3 Konstruksi", description: "Pengembangan SMKK berbasis risiko dan standar internasional" },
      { code: "F.43.91100.006.01", name: "Menyusun Standar Kompetensi K3 Konstruksi", description: "Pengembangan dan evaluasi standar kompetensi K3 konstruksi" },
    ],
  },
  {
    id: "ahli-madya-k3-konstruksi",
    name: "Ahli Madya K3 Konstruksi",
    jenjang: "Madya",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Keselamatan Konstruksi",
    units: [
      { code: "F.43.91100.101.01", name: "Mengelola Sistem Manajemen K3 Konstruksi", description: "Implementasi SMKK pada proyek konstruksi besar" },
      { code: "F.43.91100.102.01", name: "Melakukan Audit Internal K3 Konstruksi", description: "Pelaksanaan audit internal SMKK secara berkala" },
      { code: "F.43.91100.103.01", name: "Melakukan Investigasi Kecelakaan Kerja", description: "Investigasi kecelakaan, near miss, dan penyusunan laporan" },
      { code: "F.43.91100.104.01", name: "Mengelola Rencana Tanggap Darurat Konstruksi", description: "Penyusunan dan pengujian ERP di proyek konstruksi" },
      { code: "F.43.91100.105.01", name: "Mengelola Program Keselamatan Konstruksi", description: "Perencanaan, implementasi, dan evaluasi program K3 proyek" },
      { code: "F.43.91100.106.01", name: "Menyusun Rencana Keselamatan Konstruksi (RKK)", description: "Penyusunan dokumen RKK dan HSEMP proyek" },
    ],
  },
  {
    id: "ahli-muda-k3-konstruksi",
    name: "Ahli Muda K3 Konstruksi",
    jenjang: "Muda",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Keselamatan Konstruksi",
    units: [
      { code: "F.43.91100.201.01", name: "Menerapkan Peraturan K3 di Tempat Kerja", description: "Implementasi regulasi dan standar K3 di lokasi konstruksi" },
      { code: "F.43.91100.202.01", name: "Melakukan Identifikasi Bahaya dan Penilaian Risiko (IBPR)", description: "HIRADC dan pengendalian risiko K3 konstruksi" },
      { code: "F.43.91100.203.01", name: "Mengelola Sistem Izin Kerja Berbahaya", description: "Sistem ijin kerja di ketinggian, ruang terbatas, pekerjaan panas" },
      { code: "F.43.91100.204.01", name: "Melakukan Inspeksi K3 dan Patroli Keselamatan", description: "Inspeksi rutin K3 dan patroli keselamatan di proyek" },
      { code: "F.43.91100.205.01", name: "Mengelola Alat Pelindung Diri (APD)", description: "Pengelolaan, pemilihan, dan penggunaan APD yang tepat" },
      { code: "F.43.91100.206.01", name: "Melakukan Sosialisasi dan Induksi K3", description: "Safety induction, toolbox meeting, dan komunikasi K3 pekerja" },
    ],
  },

  // =====================================================
  // E. MANAJEMEN PELAKSANAAN — Pengendalian Mutu
  // =====================================================
  {
    id: "ahli-utama-sistem-mutu-konstruksi",
    name: "Ahli Utama Sistem Manajemen Mutu Konstruksi",
    jenjang: "Utama",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Pengendalian Mutu Pekerjaan Konstruksi",
    units: [
      { code: "M.71.QMU.001.01", name: "Merumuskan Kebijakan Mutu Konstruksi Nasional", description: "Pengembangan standar dan kebijakan mutu konstruksi" },
      { code: "M.71.QMU.002.01", name: "Memimpin Program Sertifikasi ISO 9001 Konstruksi", description: "Kepemimpinan implementasi SMM ISO 9001 di perusahaan konstruksi" },
      { code: "M.71.QMU.003.01", name: "Memberikan Pendapat Teknis Profesional Mutu Konstruksi", description: "Expert opinion untuk permasalahan mutu dan kegagalan konstruksi" },
      { code: "M.71.QMU.004.01", name: "Mengembangkan Standar Mutu Pekerjaan Konstruksi", description: "Pengembangan standar mutu dan spesifikasi teknis konstruksi" },
    ],
  },
  {
    id: "ahli-madya-sistem-mutu-konstruksi",
    name: "Ahli Madya Sistem Manajemen Mutu Konstruksi",
    jenjang: "Madya",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Pengendalian Mutu Pekerjaan Konstruksi",
    units: [
      { code: "M.71.QMU.101.01", name: "Menerapkan Sistem Manajemen Mutu ISO 9001", description: "Implementasi SMM berbasis ISO 9001 dalam konstruksi" },
      { code: "M.71.QMU.102.01", name: "Melakukan Audit Mutu Internal Konstruksi", description: "Pelaksanaan audit internal SMM pada unit organisasi" },
      { code: "M.71.QMU.103.01", name: "Menganalisis Data Kinerja Mutu Proyek", description: "Analisis statistik data mutu dan tren kinerja proyek" },
      { code: "M.71.QMU.104.01", name: "Mengelola Program Peningkatan Mutu Berkelanjutan", description: "Program continuous improvement kualitas proses konstruksi" },
      { code: "M.71.QMU.105.01", name: "Menyusun Prosedur dan Standar Mutu Konstruksi", description: "Pengembangan SOP, instruksi kerja, dan standar mutu" },
    ],
  },
  {
    id: "ahli-muda-sistem-mutu-konstruksi",
    name: "Ahli Muda Sistem Manajemen Mutu Konstruksi",
    jenjang: "Muda",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Pengendalian Mutu Pekerjaan Konstruksi",
    units: [
      { code: "M.71.QMU.201.01", name: "Menyusun Rencana Mutu Proyek (RMP)", description: "Penyusunan Quality Management Plan proyek konstruksi" },
      { code: "M.71.QMU.202.01", name: "Melakukan Inspeksi dan Pengujian Pekerjaan Konstruksi", description: "Pelaksanaan inspection and test plan (ITP) di lapangan" },
      { code: "M.71.QMU.203.01", name: "Mengelola Ketidaksesuaian (Non-Conformance Report)", description: "Penanganan NCR dan tindakan perbaikan dalam konstruksi" },
      { code: "M.71.QMU.204.01", name: "Melakukan Kalibrasi Alat Ukur dan Uji", description: "Pengelolaan kalibrasi peralatan pengujian dan pengukuran" },
      { code: "M.71.QMU.205.01", name: "Menyusun Laporan Pengendalian Mutu Proyek", description: "Penyusunan quality report dan rekaman mutu proyek" },
    ],
  },

  // =====================================================
  // E. MANAJEMEN PELAKSANAAN — Hukum Kontrak Konstruksi
  // =====================================================
  {
    id: "ahli-utama-kontrak-konstruksi",
    name: "Ahli Utama Kontrak Kerja Konstruksi",
    jenjang: "Utama",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Hukum Kontrak Konstruksi",
    units: [
      { code: "M.71.HKK.001.01", name: "Merumuskan Standar Kontrak Konstruksi Nasional", description: "Pengembangan standar dokumen kontrak konstruksi Indonesia" },
      { code: "M.71.HKK.002.01", name: "Memberikan Pendapat Hukum Profesional Kontrak", description: "Expert opinion dan opini hukum kontrak konstruksi" },
      { code: "M.71.HKK.003.01", name: "Memimpin Penyelesaian Sengketa Konstruksi Besar", description: "Kepemimpinan proses arbitrase dan penyelesaian sengketa" },
      { code: "M.71.HKK.004.01", name: "Melakukan Evaluasi Dokumen Kontrak Kompleks", description: "Review klausul kontrak FIDIC dan kontrak internasional" },
    ],
  },
  {
    id: "ahli-madya-kontrak-konstruksi",
    name: "Ahli Madya Kontrak Kerja Konstruksi",
    jenjang: "Madya",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Hukum Kontrak Konstruksi",
    units: [
      { code: "M.71.HKK.101.01", name: "Menyusun Dokumen Kontrak Konstruksi", description: "Penyusunan dan review dokumen kontrak konstruksi" },
      { code: "M.71.HKK.102.01", name: "Melakukan Analisis Klaim Konstruksi", description: "Identifikasi, analisis, dan penyusunan klaim kontrak" },
      { code: "M.71.HKK.103.01", name: "Mengelola Administrasi Kontrak Konstruksi", description: "Pengelolaan amandemen, addendum, dan perubahan kontrak" },
      { code: "M.71.HKK.104.01", name: "Melakukan Mediasi Sengketa Konstruksi", description: "Mediasi dan negosiasi penyelesaian sengketa kontrak" },
      { code: "M.71.HKK.105.01", name: "Menyusun Laporan Klaim dan Dokumentasi Kontrak", description: "Dokumentasi klaim, amandemen, dan rekaman kontrak proyek" },
    ],
  },

  // =====================================================
  // F. SAINS DAN REKAYASA TEKNIK
  // =====================================================
  {
    id: "ahli-utama-perencanaan-proyek-infrastruktur",
    name: "Ahli Utama Perencanaan Proyek Infrastruktur",
    jenjang: "Utama",
    klasifikasi: "Sains dan Rekayasa Teknik",
    subklasifikasi: "Investasi Infrastruktur",
    units: [
      { code: "M.71.INV.001.01", name: "Merumuskan Kebijakan Investasi Infrastruktur", description: "Pengembangan framework investasi infrastruktur nasional" },
      { code: "M.71.INV.002.01", name: "Memimpin Penyusunan Feasibility Study Proyek Besar", description: "Kepemimpinan studi kelayakan infrastruktur strategis" },
      { code: "M.71.INV.003.01", name: "Memberikan Pendapat Profesional Investasi Infrastruktur", description: "Expert opinion untuk bankability dan investasi infrastruktur" },
      { code: "M.71.INV.004.01", name: "Melakukan Evaluasi Program Infrastruktur Nasional", description: "Penilaian dan prioritisasi program infrastruktur nasional" },
    ],
  },
  {
    id: "ahli-madya-perencanaan-proyek-infrastruktur",
    name: "Ahli Madya Perencanaan Proyek Infrastruktur",
    jenjang: "Madya",
    klasifikasi: "Sains dan Rekayasa Teknik",
    subklasifikasi: "Investasi Infrastruktur",
    units: [
      { code: "M.71.INV.101.01", name: "Melakukan Studi Kelayakan Proyek Infrastruktur", description: "Penyusunan feasibility study teknis, ekonomi, dan finansial" },
      { code: "M.71.INV.102.01", name: "Melakukan Analisis Biaya Manfaat Infrastruktur", description: "Cost-benefit analysis dan nilai ekonomi proyek infrastruktur" },
      { code: "M.71.INV.103.01", name: "Merencanakan Skema Pembiayaan Infrastruktur", description: "Perencanaan skema APBN, PPP, dan alternatif pendanaan" },
      { code: "M.71.INV.104.01", name: "Melakukan Analisis Risiko Investasi Infrastruktur", description: "Identifikasi dan mitigasi risiko investasi proyek infrastruktur" },
      { code: "M.71.INV.105.01", name: "Menyusun Business Case Proyek Infrastruktur", description: "Penyusunan justifikasi dan kasus bisnis proyek infrastruktur" },
    ],
  },
  {
    id: "ahli-rekayasa-nilai",
    name: "Ahli Rekayasa Nilai (Value Engineering)",
    jenjang: "Utama",
    klasifikasi: "Sains dan Rekayasa Teknik",
    subklasifikasi: "Investasi Infrastruktur",
    units: [
      { code: "M.71.VE.001.01", name: "Memimpin Studi Value Engineering Konstruksi", description: "Penyelenggaraan dan fasilitasi studi VE pada proyek konstruksi" },
      { code: "M.71.VE.002.01", name: "Melakukan Analisis Fungsi dan Nilai", description: "Function analysis, FAST diagram, dan value analysis" },
      { code: "M.71.VE.003.01", name: "Mengembangkan Alternatif Desain dan Konstruksi", description: "Generasi dan evaluasi ide alternatif untuk efisiensi nilai" },
      { code: "M.71.VE.004.01", name: "Menyusun Laporan Studi Value Engineering", description: "Dokumentasi hasil studi VE dan rekomendasi penghematan biaya" },
      { code: "M.71.VE.005.01", name: "Melakukan Life Cycle Cost Analysis", description: "Analisis biaya siklus hidup aset infrastruktur" },
    ],
  },
  {
    id: "manager-bim-madya",
    name: "Manager BIM Madya",
    jenjang: "Madya",
    klasifikasi: "Sains dan Rekayasa Teknik",
    subklasifikasi: "Komputasi Konstruksi",
    units: [
      { code: "M.71.BIM.001.01", name: "Menyusun BIM Execution Plan (BEP) Proyek", description: "Penyusunan rencana implementasi BIM untuk proyek konstruksi" },
      { code: "M.71.BIM.002.01", name: "Mengelola Model BIM Multidisiplin", description: "Pengelolaan dan koordinasi model BIM multidisiplin" },
      { code: "M.71.BIM.003.01", name: "Melakukan Clash Detection dan Koordinasi BIM", description: "Identifikasi dan resolusi konflik antar disiplin dalam model BIM" },
      { code: "M.71.BIM.004.01", name: "Menyusun Standar dan Template BIM", description: "Pengembangan BIM standard, template, dan prosedur proyek" },
      { code: "M.71.BIM.005.01", name: "Melakukan 4D/5D BIM Scheduling dan Cost Control", description: "Implementasi BIM 4D (jadwal) dan 5D (biaya) dalam proyek" },
    ],
  },
  {
    id: "manager-bim-muda",
    name: "Manager BIM Muda",
    jenjang: "Muda",
    klasifikasi: "Sains dan Rekayasa Teknik",
    subklasifikasi: "Komputasi Konstruksi",
    units: [
      { code: "M.71.BIM.201.01", name: "Membuat dan Mengelola Model BIM 3D", description: "Pembuatan dan pengelolaan model BIM 3D sesuai LOD" },
      { code: "M.71.BIM.202.01", name: "Melakukan Quantity Take-off berbasis BIM", description: "Ekstraksi data BOQ dan estimasi biaya dari model BIM" },
      { code: "M.71.BIM.203.01", name: "Melakukan Koordinasi Gambar BIM", description: "Koordinasi gambar antar disiplin menggunakan software BIM" },
      { code: "M.71.BIM.204.01", name: "Membuat Laporan Teknis Pengelolaan BIM", description: "Penyusunan BIM progress report dan rekaman BIM proyek" },
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

export function getAllJabkerNames(): string[] {
  return SKK_DATA.map((g) => g.name);
}

export function getJabkerByKlasifikasi(klasifikasi: string): JabkerGroup[] {
  return SKK_DATA.filter((g) =>
    g.klasifikasi.toLowerCase().includes(klasifikasi.toLowerCase())
  );
}

export function getJabkerBySubklasifikasi(subklasifikasi: string): JabkerGroup[] {
  return SKK_DATA.filter((g) =>
    g.subklasifikasi.toLowerCase().includes(subklasifikasi.toLowerCase())
  );
}
