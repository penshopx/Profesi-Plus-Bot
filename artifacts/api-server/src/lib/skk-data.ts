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
  // A. KLASIFIKASI: ARSITEKTUR
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
      { code: "M.71.ARS.202.01", name: "Melakukan Survei Lapangan", description: "Pengumpulan data lapangan sebagai dasar perancangan" },
      { code: "M.71.ARS.203.01", name: "Menyusun Materi Presentasi Desain", description: "Pembuatan materi visual untuk presentasi konsep desain" },
      { code: "M.71.ARS.204.01", name: "Memeriksa Kesesuaian Gambar dengan Spesifikasi", description: "Verifikasi gambar pelaksanaan dengan spesifikasi teknis" },
      { code: "M.71.ARS.205.01", name: "Membuat Perhitungan Volume Pekerjaan Arsitektur", description: "Perhitungan bill of quantity (BOQ) pekerjaan arsitektur" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL - GEDUNG
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
      { code: "M.71.GDG.006.01", name: "Memberikan Pendapat Teknis Profesional", description: "Penyusunan opini teknis untuk permasalahan bangunan gedung" },
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
      { code: "M.71.GDG.103.01", name: "Mengkoordinasikan Pekerjaan MEP Bangunan", description: "Koordinasi sistem Mekanikal, Elektrikal, dan Plumbing gedung" },
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
      { code: "M.71.GDG.205.01", name: "Mengelola Pelaksanaan Pekerjaan Finishing", description: "Pengawasan pekerjaan finishing, fasad, dan interior" },
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
      { code: "M.71.PBG.002.01", name: "Mengelola Sistem Utilitas Bangunan", description: "Pengelolaan sistem listrik, air, pendingin, dan utilitas gedung" },
      { code: "M.71.PBG.003.01", name: "Melaksanakan Program Pemeliharaan Gedung", description: "Pelaksanaan pemeliharaan preventif dan korektif gedung" },
      { code: "M.71.PBG.004.01", name: "Mengelola Keselamatan dan Keamanan Gedung", description: "Penerapan sistem fire safety dan keamanan gedung" },
      { code: "M.71.PBG.005.01", name: "Mengelola Anggaran Operasional Gedung", description: "Perencanaan dan pengendalian biaya operasional gedung" },
    ],
  },
  {
    id: "ahli-muda-bangunan-gedung-hijau",
    name: "Ahli Muda Bangunan Gedung Hijau",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Gedung",
    units: [
      { code: "M.71.GHJ.001.01", name: "Menerapkan Konsep Green Building dalam Perencanaan", description: "Integrasi prinsip bangunan hijau pada tahap desain" },
      { code: "M.71.GHJ.002.01", name: "Melakukan Audit Energi Bangunan Gedung", description: "Penilaian konsumsi energi dan identifikasi peluang efisiensi" },
      { code: "M.71.GHJ.003.01", name: "Merencanakan Sistem Pengelolaan Air Gedung", description: "Perencanaan sistem pemanenan air hujan dan daur ulang greywater" },
      { code: "M.71.GHJ.004.01", name: "Menyiapkan Dokumen Sertifikasi Greenship/EDGE", description: "Persiapan dokumen untuk sertifikasi bangunan hijau nasional/internasional" },
      { code: "M.71.GHJ.005.01", name: "Memantau Kinerja Lingkungan Bangunan", description: "Monitoring dan evaluasi performa lingkungan gedung terbangun" },
    ],
  },
  {
    id: "ahli-muda-penilai-laik-fungsi-bangunan-gedung",
    name: "Ahli Muda Penilai Laik Fungsi Bangunan Gedung",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Gedung",
    units: [
      { code: "M.71.PLF.001.01", name: "Melakukan Pemeriksaan Kelaikan Struktur Bangunan", description: "Inspeksi dan penilaian kondisi struktural bangunan gedung" },
      { code: "M.71.PLF.002.01", name: "Melakukan Pemeriksaan Kelaikan Sistem Utilitas", description: "Penilaian sistem MEP terhadap standar laik fungsi" },
      { code: "M.71.PLF.003.01", name: "Melakukan Pemeriksaan Kelaikan Proteksi Kebakaran", description: "Penilaian sistem proteksi kebakaran gedung" },
      { code: "M.71.PLF.004.01", name: "Menyusun Laporan Hasil Pemeriksaan Kelaikan Fungsi", description: "Penyusunan laporan teknis hasil assessment kelaikan gedung" },
      { code: "M.71.PLF.005.01", name: "Memberikan Rekomendasi Tindak Lanjut Hasil Pemeriksaan", description: "Penyusunan rekomendasi perbaikan atau peningkatan kelaikan gedung" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL - JALAN
  // =====================================================

  {
    id: "ahli-utama-teknik-jalan",
    name: "Ahli Utama Teknik Jalan",
    jenjang: "Utama",
    klasifikasi: "Sipil",
    subklasifikasi: "Jalan",
    units: [
      { code: "M.71.JLN.001.01", name: "Merumuskan Kebijakan Teknis Perkerasan Jalan", description: "Pengembangan standar dan kebijakan teknis jaringan jalan nasional" },
      { code: "M.71.JLN.002.01", name: "Melakukan Evaluasi Kinerja Jaringan Jalan", description: "Analisis kinerja jaringan jalan dan rekomendasi penanganan" },
      { code: "M.71.JLN.003.01", name: "Memimpin Perencanaan Jalan Nasional/Tol", description: "Kepemimpinan perencanaan teknis jalan bebas hambatan" },
      { code: "M.71.JLN.004.01", name: "Menyusun Standar dan Pedoman Teknis Jalan", description: "Penyusunan manual dan pedoman teknis konstruksi jalan" },
      { code: "M.71.JLN.005.01", name: "Memberikan Pendapat Teknis Profesional Bidang Jalan", description: "Expert opinion untuk permasalahan teknis jalan" },
      { code: "M.71.JLN.006.01", name: "Mengevaluasi Inovasi Teknologi Perkerasan", description: "Penilaian dan rekomendasi penerapan teknologi baru perkerasan jalan" },
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
      { code: "M.71.JLN.106.01", name: "Menyusun Laporan Teknis Proyek Jalan", description: "Penyusunan laporan teknis berkala dan akhir proyek jalan" },
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
      { code: "M.71.JLN.204.01", name: "Mengawasi Pekerjaan Lapis Aspal Perkerasan", description: "Pengawasan pekerjaan AC-BC, AC-WC, dan prime coat/tack coat" },
      { code: "M.71.JLN.205.01", name: "Mengawasi Pekerjaan Drainase Jalan", description: "Pengawasan sistem drainase jalan dan bangunan pelengkap" },
      { code: "M.71.JLN.206.01", name: "Melakukan Pengujian Kualitas Pekerjaan Jalan", description: "Core drill, density test, dan pengujian kualitas lapangan" },
    ],
  },
  {
    id: "ahli-muda-material-jalan",
    name: "Ahli Muda Material Jalan",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Jalan",
    units: [
      { code: "M.71.MTJ.001.01", name: "Melakukan Pengujian Material Agregat Jalan", description: "Uji gradasi, keausan Los Angeles, dan kelekatan agregat" },
      { code: "M.71.MTJ.002.01", name: "Melakukan Pengujian Campuran Aspal (Marshall Test)", description: "Desain campuran aspal dan marshall test di laboratorium" },
      { code: "M.71.MTJ.003.01", name: "Melakukan Pengujian Material Tanah Dasar", description: "CBR, Atterberg limit, kompaksi, dan klasifikasi tanah" },
      { code: "M.71.MTJ.004.01", name: "Mengelola Laboratorium Pengujian Jalan", description: "Manajemen dan kalibrasi peralatan laboratorium pengujian jalan" },
      { code: "M.71.MTJ.005.01", name: "Melakukan Pengujian Campuran Beton Semen Perkerasan", description: "Mix design dan pengujian perkerasan beton semen" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL - JEMBATAN
  // =====================================================

  {
    id: "ahli-utama-teknik-jembatan",
    name: "Ahli Utama Teknik Jembatan",
    jenjang: "Utama",
    klasifikasi: "Sipil",
    subklasifikasi: "Jembatan",
    units: [
      { code: "M.71.JBT.001.01", name: "Merumuskan Standar Teknis Perencanaan Jembatan", description: "Penyusunan standar dan pedoman teknis jembatan skala nasional" },
      { code: "M.71.JBT.002.01", name: "Melakukan Evaluasi Desain Jembatan Khusus", description: "Review desain jembatan cable-stayed, suspension, dan bentang panjang" },
      { code: "M.71.JBT.003.01", name: "Memimpin Program Inspeksi Jembatan Nasional", description: "Pengelolaan program inspeksi dan pemeliharaan aset jembatan" },
      { code: "M.71.JBT.004.01", name: "Memberikan Pendapat Teknis Profesional Jembatan", description: "Expert opinion untuk permasalahan teknis jembatan" },
      { code: "M.71.JBT.005.01", name: "Melakukan Evaluasi Kapasitas Jembatan Eksisting", description: "Load rating dan penilaian kemampuan struktural jembatan" },
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
  // B. KLASIFIKASI: SIPIL - BENDUNGAN
  // =====================================================

  {
    id: "ahli-utama-teknik-bendungan",
    name: "Ahli Utama Teknik Bendungan",
    jenjang: "Utama",
    klasifikasi: "Sipil",
    subklasifikasi: "Bendung dan Bendungan",
    units: [
      { code: "M.71.BND.001.01", name: "Merumuskan Kebijakan Keamanan Bendungan", description: "Penyusunan standar keamanan dan regulasi teknis bendungan" },
      { code: "M.71.BND.002.01", name: "Melakukan Evaluasi Keamanan Bendungan", description: "Penilaian komprehensif kondisi keamanan bendungan eksisting" },
      { code: "M.71.BND.003.01", name: "Memimpin Perencanaan Teknis Bendungan Besar", description: "Kepemimpinan desain bendungan dengan kapasitas > 10 juta m³" },
      { code: "M.71.BND.004.01", name: "Menyusun Rencana Tindak Darurat Bendungan", description: "Penyusunan Emergency Action Plan (EAP) bendungan" },
      { code: "M.71.BND.005.01", name: "Melakukan Pemantauan Perilaku Bendungan", description: "Analisis data instrumentasi dan kinerja bendungan" },
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
      { code: "M.71.BND.202.01", name: "Mengawasi Pekerjaan Beton Bendungan", description: "Pengawasan pekerjaan beton spillway, intake, dan bangunan pelengkap" },
      { code: "M.71.BND.203.01", name: "Melakukan Pengujian Material Bendungan", description: "Uji pemadatan, permeabilitas, dan kuat geser material timbunan" },
      { code: "M.71.BND.204.01", name: "Memantau Instalasi Alat Instrumentasi Bendungan", description: "Pemasangan dan pembacaan alat pantau bendungan" },
      { code: "M.71.BND.205.01", name: "Membuat Laporan Teknis Pelaksanaan Bendungan", description: "Penyusunan laporan harian dan rekaman as-built konstruksi bendungan" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL - IRIGASI DAN RAWA
  // =====================================================

  {
    id: "ahli-muda-perencanaan-irigasi",
    name: "Ahli Muda Perencanaan Irigasi",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Irigasi dan Rawa",
    units: [
      { code: "M.71.IRG.001.01", name: "Melakukan Analisis Kebutuhan Air Irigasi", description: "Perhitungan kebutuhan air tanaman dan debit rencana irigasi" },
      { code: "M.71.IRG.002.01", name: "Merencanakan Jaringan Irigasi", description: "Desain saluran primer, sekunder, dan tersier irigasi" },
      { code: "M.71.IRG.003.01", name: "Mengawasi Konstruksi Bangunan Irigasi", description: "Pengawasan pekerjaan saluran, bangunan bagi, dan pintu air" },
      { code: "M.71.IRG.004.01", name: "Mengelola Distribusi Air Irigasi", description: "Pengaturan giliran dan rotasi pemberian air irigasi" },
      { code: "M.71.IRG.005.01", name: "Melakukan Evaluasi Kinerja Jaringan Irigasi", description: "Penilaian efisiensi dan efektivitas jaringan irigasi" },
    ],
  },
  {
    id: "ahli-madya-perencanaan-irigasi",
    name: "Ahli Madya Perencanaan Irigasi",
    jenjang: "Madya",
    klasifikasi: "Sipil",
    subklasifikasi: "Irigasi dan Rawa",
    units: [
      { code: "M.71.IRG.101.01", name: "Merumuskan Rencana Pengelolaan Daerah Irigasi", description: "Penyusunan rencana pengelolaan DI secara terpadu" },
      { code: "M.71.IRG.102.01", name: "Mengelola Rehabilitasi Jaringan Irigasi", description: "Perencanaan dan pelaksanaan rehabilitasi jaringan irigasi" },
      { code: "M.71.IRG.103.01", name: "Mengelola Aset Irigasi", description: "Inventarisasi dan pengelolaan aset infrastruktur irigasi" },
      { code: "M.71.IRG.104.01", name: "Melakukan Koordinasi P3A/GP3A dalam Pengelolaan Irigasi", description: "Fasilitasi kelembagaan petani pemakai air" },
      { code: "M.71.IRG.105.01", name: "Menyusun Laporan Kinerja Pengelolaan Irigasi", description: "Penyusunan laporan IKSI dan kinerja pengelolaan irigasi" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL - SUNGAI DAN PANTAI
  // =====================================================

  {
    id: "ahli-muda-teknik-sumber-daya-air",
    name: "Ahli Muda Bidang Keahlian Teknik Sumber Daya Air",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Air Tanah dan Air Baku",
    units: [
      { code: "M.71.SDA.001.01", name: "Melakukan Analisis Hidrologi", description: "Perhitungan debit banjir, kekeringan, dan analisis data hujan" },
      { code: "M.71.SDA.002.01", name: "Melakukan Analisis Hidrolika Sungai", description: "Pemodelan aliran dan profil muka air sungai" },
      { code: "M.71.SDA.003.01", name: "Mengawasi Konstruksi Bangunan Sungai", description: "Pengawasan normalisasi sungai, tanggul, dan revetment" },
      { code: "M.71.SDA.004.01", name: "Melakukan Pengendalian Sedimen Sungai", description: "Analisis dan pengendalian sedimentasi sungai" },
      { code: "M.71.SDA.005.01", name: "Merencanakan Bangunan Pengendali Banjir", description: "Desain kolam retensi, floodway, dan polder" },
    ],
  },
  {
    id: "ahli-muda-teknik-pantai",
    name: "Ahli Muda Teknik Pantai",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Sungai dan Pantai",
    units: [
      { code: "M.71.PNT.001.01", name: "Melakukan Analisis Dinamika Pantai", description: "Analisis gelombang, arus, dan transpor sedimen pantai" },
      { code: "M.71.PNT.002.01", name: "Merencanakan Bangunan Pelindung Pantai", description: "Desain breakwater, groin, revetment, dan sea wall" },
      { code: "M.71.PNT.003.01", name: "Mengawasi Konstruksi Bangunan Pantai", description: "Pengawasan pelaksanaan konstruksi bangunan pengaman pantai" },
      { code: "M.71.PNT.004.01", name: "Melakukan Pemantauan Abrasi Pantai", description: "Monitoring perubahan garis pantai dan abrasi" },
      { code: "M.71.PNT.005.01", name: "Melakukan Kajian Dampak Bangunan Pantai", description: "Analisis dampak lingkungan bangunan pantai terhadap ekosistem" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL - DRAINASE PERKOTAAN
  // =====================================================

  {
    id: "ahli-muda-perencanaan-drainase",
    name: "Ahli Muda Perencanaan Jaringan Drainase",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Drainase Perkotaan",
    units: [
      { code: "M.71.DRN.001.01", name: "Melakukan Analisis Hidrologi Perkotaan", description: "Perhitungan debit rencana untuk sistem drainase kawasan" },
      { code: "M.71.DRN.002.01", name: "Merencanakan Sistem Drainase Kawasan", description: "Desain jaringan saluran drainase perkotaan" },
      { code: "M.71.DRN.003.01", name: "Mengawasi Konstruksi Saluran Drainase", description: "Pengawasan pelaksanaan pekerjaan saluran dan gorong-gorong" },
      { code: "M.71.DRN.004.01", name: "Merencanakan Pengelolaan Air Hujan (SPAH)", description: "Desain sumur resapan, biopori, dan sistem penampung air hujan" },
      { code: "M.71.DRN.005.01", name: "Melakukan Evaluasi Kinerja Sistem Drainase", description: "Penilaian efektivitas sistem drainase terhadap genangan/banjir" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL - GEOTEKNIK DAN PONDASI
  // =====================================================

  {
    id: "ahli-muda-geoteknik",
    name: "Ahli Muda Geoteknik",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Geoteknik dan Pondasi",
    units: [
      { code: "M.71.GTK.001.01", name: "Melakukan Penyelidikan Tanah di Lapangan", description: "Pelaksanaan boring, SPT, dan CPT untuk penyelidikan tanah" },
      { code: "M.71.GTK.002.01", name: "Melakukan Pengujian Tanah di Laboratorium", description: "Uji sifat fisik dan mekanik tanah di laboratorium" },
      { code: "M.71.GTK.003.01", name: "Menganalisis Daya Dukung Pondasi", description: "Perhitungan kapasitas dukung pondasi dangkal dan dalam" },
      { code: "M.71.GTK.004.01", name: "Menganalisis Stabilitas Lereng", description: "Analisis stabilitas lereng dan penentuan faktor keamanan" },
      { code: "M.71.GTK.005.01", name: "Mengawasi Pekerjaan Pondasi di Lapangan", description: "Pengawasan pelaksanaan pondasi tiang dan perbaikan tanah" },
    ],
  },
  {
    id: "ahli-muda-geologi-konstruksi",
    name: "Ahli Muda Geologi Pekerjaan Konstruksi",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Geoteknik dan Pondasi",
    units: [
      { code: "M.71.GEL.001.01", name: "Melakukan Pemetaan Geologi Teknik", description: "Pemetaan kondisi geologi untuk keperluan konstruksi" },
      { code: "M.71.GEL.002.01", name: "Melakukan Investigasi Geoteknik Lapangan", description: "Penyelidikan dan pengambilan sampel geoteknik di lapangan" },
      { code: "M.71.GEL.003.01", name: "Menganalisis Risiko Geologi pada Proyek Konstruksi", description: "Identifikasi dan mitigasi bahaya geologi (longsor, gempa, dll)" },
      { code: "M.71.GEL.004.01", name: "Menyusun Laporan Geologi Teknik", description: "Penyusunan laporan penyelidikan geologi untuk keperluan desain" },
      { code: "M.71.GEL.005.01", name: "Melakukan Pengujian Kekuatan Batuan", description: "Uji UCS, point load, dan Brazilian test pada sampel batuan" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL - TEROWONGAN
  // =====================================================

  {
    id: "ahli-muda-teknik-terowongan",
    name: "Ahli Muda Teknik Terowongan",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Terowongan",
    units: [
      { code: "M.71.TRW.001.01", name: "Melakukan Survei dan Investigasi Terowongan", description: "Survei rute dan investigasi geologi untuk perencanaan terowongan" },
      { code: "M.71.TRW.002.01", name: "Mengawasi Pelaksanaan Penggalian Terowongan", description: "Pengawasan metode NATM, TBM, dan blasting untuk terowongan" },
      { code: "M.71.TRW.003.01", name: "Mengawasi Pekerjaan Perkuatan Terowongan", description: "Pengawasan shotcrete, rockbolt, dan steel rib support" },
      { code: "M.71.TRW.004.01", name: "Memantau Perilaku Terowongan Selama Konstruksi", description: "Monitoring settlement, deformasi, dan stabilitas selama galian" },
      { code: "M.71.TRW.005.01", name: "Menerapkan K3 Khusus Pekerjaan Terowongan", description: "Penerapan standar keselamatan kerja di dalam terowongan" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL - JALAN REL
  // =====================================================

  {
    id: "ahli-muda-teknik-jalan-rel",
    name: "Ahli Muda Teknik Jalan Rel",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Jalan Rel",
    units: [
      { code: "M.71.REL.001.01", name: "Merencanakan Geometrik Jalan Rel", description: "Desain alinyemen horizontal dan vertikal jalan rel" },
      { code: "M.71.REL.002.01", name: "Mengawasi Pekerjaan Tubuh Baan Jalan Rel", description: "Pengawasan pekerjaan subgrade dan drainase rel kereta" },
      { code: "M.71.REL.003.01", name: "Mengawasi Pemasangan Ballast dan Bantalan", description: "Pengawasan pekerjaan balas, bantalan, dan geometri rel" },
      { code: "M.71.REL.004.01", name: "Melakukan Inspeksi Kondisi Jalan Rel", description: "Pemeriksaan kondisi rel, penambat, bantalan, dan balas" },
      { code: "M.71.REL.005.01", name: "Melakukan Pengujian Geometri Jalan Rel", description: "Pengukuran lebar sepur, kemiringan, dan kerataan rel" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL - BANGUNAN PELABUHAN
  // =====================================================

  {
    id: "ahli-muda-teknik-dermaga",
    name: "Ahli Muda Teknik Dermaga",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Bangunan Pelabuhan",
    units: [
      { code: "M.71.DRM.001.01", name: "Melakukan Studi Kelayakan Dermaga", description: "Analisis kelayakan teknis dan ekonomi pembangunan dermaga" },
      { code: "M.71.DRM.002.01", name: "Merencanakan Struktur Dermaga", description: "Desain struktur dermaga, dolphin, dan breasting dolphin" },
      { code: "M.71.DRM.003.01", name: "Mengawasi Konstruksi Dermaga", description: "Pengawasan pekerjaan pondasi tiang dan dek dermaga" },
      { code: "M.71.DRM.004.01", name: "Melakukan Analisis Gelombang untuk Dermaga", description: "Analisis kondisi gelombang dan arus untuk keamanan berlabuh" },
      { code: "M.71.DRM.005.01", name: "Melakukan Inspeksi Kondisi Dermaga", description: "Pemeriksaan kondisi struktural dan fungsional dermaga" },
    ],
  },

  // =====================================================
  // B. KLASIFIKASI: SIPIL - LANDASAN UDARA
  // =====================================================

  {
    id: "ahli-muda-teknik-landasan-terbang",
    name: "Ahli Muda Teknik Landasan Terbang",
    jenjang: "Muda",
    klasifikasi: "Sipil",
    subklasifikasi: "Landasan Udara",
    units: [
      { code: "M.71.LDN.001.01", name: "Merencanakan Perkerasan Runway dan Taxiway", description: "Desain perkerasan aerodrome berdasarkan standar ICAO" },
      { code: "M.71.LDN.002.01", name: "Mengawasi Konstruksi Perkerasan Bandara", description: "Pengawasan pekerjaan perkerasan runway, taxiway, dan apron" },
      { code: "M.71.LDN.003.01", name: "Melakukan Evaluasi Kondisi Perkerasan Bandara", description: "Penilaian kondisi perkerasan menggunakan metode PCI" },
      { code: "M.71.LDN.004.01", name: "Merencanakan Sistem Drainase Bandara", description: "Desain sistem drainase permukaan dan bawah permukaan bandara" },
      { code: "M.71.LDN.005.01", name: "Menerapkan Standar Keselamatan Operasional Bandara", description: "Penerapan persyaratan keselamatan area airside bandara" },
    ],
  },

  // =====================================================
  // C. KLASIFIKASI: MEKANIKAL
  // =====================================================

  {
    id: "ahli-muda-teknik-mekanikal",
    name: "Ahli Muda Bidang Keahlian Teknik Mekanikal",
    jenjang: "Muda",
    klasifikasi: "Mekanikal",
    subklasifikasi: "Teknik Mekanikal",
    units: [
      { code: "M.71.MKL.001.01", name: "Merencanakan Sistem HVAC Bangunan", description: "Desain sistem tata udara (AC, ventilasi, dan exhaust) gedung" },
      { code: "M.71.MKL.002.01", name: "Mengawasi Instalasi Sistem Mekanikal Gedung", description: "Pengawasan pemasangan sistem HVAC dan utilitas mekanikal" },
      { code: "M.71.MKL.003.01", name: "Melakukan Komisioning Sistem Mekanikal", description: "Pengujian dan komisioning sistem mekanikal gedung" },
      { code: "M.71.MKL.004.01", name: "Membuat Spesifikasi Teknis Peralatan Mekanikal", description: "Penyusunan spesifikasi teknis dan schedule peralatan mekanikal" },
      { code: "M.71.MKL.005.01", name: "Melakukan Pemeliharaan Sistem Mekanikal", description: "Perencanaan dan pelaksanaan pemeliharaan sistem mekanikal" },
    ],
  },
  {
    id: "ahli-muda-elektrikal-gedung",
    name: "Ahli Muda Elektrikal Konstruksi Bangunan Gedung",
    jenjang: "Muda",
    klasifikasi: "Mekanikal",
    subklasifikasi: "Teknik Mekanikal",
    units: [
      { code: "M.71.ELK.001.01", name: "Merencanakan Instalasi Listrik Tegangan Rendah Gedung", description: "Desain distribusi daya, panel, dan sistem grounding gedung" },
      { code: "M.71.ELK.002.01", name: "Merencanakan Sistem Tata Cahaya Bangunan", description: "Desain sistem pencahayaan buatan sesuai standar SNI" },
      { code: "M.71.ELK.003.01", name: "Merencanakan Sistem Penangkal Petir", description: "Desain sistem proteksi petir external dan internal gedung" },
      { code: "M.71.ELK.004.01", name: "Mengawasi Instalasi Sistem Elektrikal Gedung", description: "Pengawasan pemasangan instalasi listrik dan panel distribusi" },
      { code: "M.71.ELK.005.01", name: "Melakukan Pengujian dan Komisioning Sistem Elektrikal", description: "Testing dan commissioning instalasi listrik gedung" },
    ],
  },
  {
    id: "ahli-muda-plumbing-pompa",
    name: "Ahli Muda Teknik Plumbing dan Pompa Mekanik",
    jenjang: "Muda",
    klasifikasi: "Mekanikal",
    subklasifikasi: "Plumbing dan Pompa Mekanik",
    units: [
      { code: "M.71.PLB.001.01", name: "Merencanakan Sistem Distribusi Air Bersih Gedung", description: "Desain jaringan perpipaan air bersih dan titik layanan" },
      { code: "M.71.PLB.002.01", name: "Merencanakan Sistem Air Buangan dan Sanitasi", description: "Desain sistem perpipaan air kotor, air bekas, dan vent" },
      { code: "M.71.PLB.003.01", name: "Merencanakan Sistem Pompa Air Gedung", description: "Pemilihan dan desain sistem pompa transfer dan booster pump" },
      { code: "M.71.PLB.004.01", name: "Mengawasi Pemasangan Sistem Plumbing", description: "Pengawasan instalasi perpipaan plumbing gedung" },
      { code: "M.71.PLB.005.01", name: "Melakukan Pengujian Sistem Plumbing", description: "Pengujian kebocoran, tekanan, dan kualitas air sistem plumbing" },
    ],
  },
  {
    id: "ahli-muda-proteksi-kebakaran",
    name: "Ahli Muda Pengkaji Teknis Proteksi Kebakaran",
    jenjang: "Muda",
    klasifikasi: "Mekanikal",
    subklasifikasi: "Proteksi Kebakaran",
    units: [
      { code: "M.71.PKB.001.01", name: "Merencanakan Sistem Deteksi dan Alarm Kebakaran", description: "Desain sistem FACP, detektor, dan alarm kebakaran gedung" },
      { code: "M.71.PKB.002.01", name: "Merencanakan Sistem Sprinkler dan Hydrant", description: "Desain sistem pemadam kebakaran aktif gedung" },
      { code: "M.71.PKB.003.01", name: "Mengkaji Manajemen Evakuasi dan Keselamatan Jiwa", description: "Review sistem evakuasi, jalur keluar, dan safety egress" },
      { code: "M.71.PKB.004.01", name: "Melakukan Pengkajian Teknis Proteksi Kebakaran", description: "Kajian teknis sistem proteksi kebakaran terhadap standar dan regulasi" },
      { code: "M.71.PKB.005.01", name: "Menyusun Laporan Hasil Pengkajian Proteksi Kebakaran", description: "Penyusunan laporan dan rekomendasi proteksi kebakaran" },
    ],
  },
  {
    id: "ahli-muda-lift-eskalator",
    name: "Ahli Muda Pesawat Lift dan Eskalator",
    jenjang: "Muda",
    klasifikasi: "Mekanikal",
    subklasifikasi: "Transportasi Dalam Gedung",
    units: [
      { code: "M.71.LFT.001.01", name: "Merencanakan Sistem Transportasi Vertikal Gedung", description: "Perencanaan kebutuhan lift dan eskalator berdasarkan trafik" },
      { code: "M.71.LFT.002.01", name: "Mengawasi Instalasi Lift dan Eskalator", description: "Pengawasan pemasangan dan pengujian lift dan eskalator" },
      { code: "M.71.LFT.003.01", name: "Melakukan Pemeriksaan Keselamatan Lift", description: "Inspeksi keselamatan dan sertifikasi operasi lift" },
      { code: "M.71.LFT.004.01", name: "Mengelola Pemeliharaan Lift dan Eskalator", description: "Program pemeliharaan preventif dan korektif lift/eskalator" },
      { code: "M.71.LFT.005.01", name: "Menangani Gangguan Lift dan Eskalator", description: "Diagnosis dan penanganan kerusakan sistem lift/eskalator" },
    ],
  },

  // =====================================================
  // D. KLASIFIKASI: TATA LINGKUNGAN
  // =====================================================

  {
    id: "ahli-muda-teknik-lingkungan",
    name: "Ahli Muda Teknik Lingkungan Bidang Jasa Konstruksi",
    jenjang: "Muda",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Teknik Lingkungan",
    units: [
      { code: "M.71.TLH.001.01", name: "Menyusun Dokumen Lingkungan Proyek Konstruksi", description: "Penyusunan UKL-UPL atau AMDAL untuk proyek konstruksi" },
      { code: "M.71.TLH.002.01", name: "Melakukan Pemantauan Lingkungan Proyek", description: "Monitoring kualitas udara, air, kebisingan, dan lingkungan hidup" },
      { code: "M.71.TLH.003.01", name: "Merencanakan Pengelolaan Limbah Konstruksi", description: "Perencanaan sistem pengelolaan dan pembuangan limbah konstruksi" },
      { code: "M.71.TLH.004.01", name: "Mengawasi Pelaksanaan RKL-RPL", description: "Pengawasan pelaksanaan rencana pengelolaan dan pemantauan lingkungan" },
      { code: "M.71.TLH.005.01", name: "Menyusun Laporan Pelaksanaan RKL-RPL", description: "Penyusunan laporan semester dan tahunan pemantauan lingkungan" },
    ],
  },
  {
    id: "ahli-muda-teknik-air-minum",
    name: "Ahli Muda Teknik Air Minum",
    jenjang: "Muda",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Teknik Air Minum",
    units: [
      { code: "M.71.TAM.001.01", name: "Merencanakan Sistem Penyediaan Air Minum (SPAM)", description: "Desain sistem jaringan distribusi dan instalasi pengolahan air minum" },
      { code: "M.71.TAM.002.01", name: "Mengawasi Konstruksi SPAM", description: "Pengawasan pembangunan IPA dan jaringan pipa distribusi" },
      { code: "M.71.TAM.003.01", name: "Melakukan Uji Kualitas Air Minum", description: "Pengujian parameter fisik, kimia, dan biologis air minum" },
      { code: "M.71.TAM.004.01", name: "Mengelola Operasi Instalasi Pengolahan Air", description: "Pengelolaan proses pengolahan air di IPA" },
      { code: "M.71.TAM.005.01", name: "Melakukan Analisis Kehilangan Air (NRW)", description: "Identifikasi dan penanganan kehilangan air jaringan distribusi" },
    ],
  },
  {
    id: "ahli-muda-teknik-perpipaan",
    name: "Ahli Muda Teknik Perpipaan",
    jenjang: "Muda",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Teknik Perpipaan",
    units: [
      { code: "M.71.PRP.001.01", name: "Merencanakan Sistem Perpipaan", description: "Desain jaringan perpipaan transmisi dan distribusi" },
      { code: "M.71.PRP.002.01", name: "Mengawasi Pemasangan Pipa dan Fitting", description: "Pengawasan pekerjaan pemasangan pipa, fitting, dan aksesori" },
      { code: "M.71.PRP.003.01", name: "Melakukan Pengujian Kebocoran Pipa", description: "Uji tekanan dan deteksi kebocoran pada jaringan perpipaan" },
      { code: "M.71.PRP.004.01", name: "Mengelola Pemeliharaan Jaringan Pipa", description: "Pemeliharaan preventif dan perbaikan jaringan pipa" },
      { code: "M.71.PRP.005.01", name: "Membuat As-Built Drawing Jaringan Perpipaan", description: "Penyusunan gambar purna bangun jaringan perpipaan" },
    ],
  },
  {
    id: "ahli-muda-pengelolaan-sampah",
    name: "Ahli Muda Perencana Pengelolaan Sampah",
    jenjang: "Muda",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Teknik Persampahan",
    units: [
      { code: "M.71.SMP.001.01", name: "Merencanakan Sistem Pengelolaan Persampahan", description: "Desain sistem pengumpulan, pemindahan, dan pemrosesan sampah" },
      { code: "M.71.SMP.002.01", name: "Merencanakan Tempat Pemrosesan Akhir (TPA)", description: "Perencanaan teknis TPA sanitary landfill sesuai standar" },
      { code: "M.71.SMP.003.01", name: "Merencanakan Fasilitas Pengolahan Sampah 3R", description: "Desain TPS 3R, bank sampah, dan composting facility" },
      { code: "M.71.SMP.004.01", name: "Melakukan Kajian Timbulan dan Komposisi Sampah", description: "Pengukuran timbulan, komposisi, dan karakteristik sampah" },
      { code: "M.71.SMP.005.01", name: "Menyusun Rencana Pengelolaan Sampah Kawasan", description: "Penyusunan masterplan pengelolaan sampah kawasan/kota" },
    ],
  },
  {
    id: "arsitek-lanskap-muda",
    name: "Arsitek Lanskap Muda",
    jenjang: "Muda",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Arsitektur Lanskap",
    units: [
      { code: "M.71.LNK.001.01", name: "Membuat Rancangan Arsitektur Lanskap", description: "Perancangan taman, ruang terbuka hijau, dan landscape" },
      { code: "M.71.LNK.002.01", name: "Menyusun Spesifikasi Teknis Pekerjaan Lanskap", description: "Penyusunan gambar teknis dan spesifikasi pekerjaan taman" },
      { code: "M.71.LNK.003.01", name: "Mengawasi Pelaksanaan Pekerjaan Taman", description: "Pengawasan penanaman, pengerasan jalan taman, dan irigasi taman" },
      { code: "M.71.LNK.004.01", name: "Merencanakan Pengelolaan Ruang Terbuka Hijau", description: "Perencanaan operasi dan pemeliharaan RTH kawasan" },
      { code: "M.71.LNK.005.01", name: "Melakukan Kajian Lingkungan Visual Kawasan", description: "Analisis visual environment dan rekomendasi penataan lanskap" },
    ],
  },
  {
    id: "ahli-muda-perencanaan-iluminasi",
    name: "Ahli Muda Perencanaan Iluminasi",
    jenjang: "Muda",
    klasifikasi: "Tata Lingkungan",
    subklasifikasi: "Teknik Iluminasi",
    units: [
      { code: "M.71.ILM.001.01", name: "Membuat Konsep Perancangan Pencahayaan", description: "Perancangan konsep sistem pencahayaan interior dan eksterior" },
      { code: "M.71.ILM.002.01", name: "Melakukan Perhitungan Teknis Pencahayaan", description: "Simulasi dan kalkulasi tingkat pencahayaan berstandar SNI" },
      { code: "M.71.ILM.003.01", name: "Membuat Gambar Teknis Sistem Iluminasi", description: "Penyusunan gambar rencana sistem pencahayaan" },
      { code: "M.71.ILM.004.01", name: "Mengawasi Pemasangan Sistem Pencahayaan", description: "Pengawasan instalasi lampu, fitting, dan perangkat kontrol" },
      { code: "M.71.ILM.005.01", name: "Melakukan Pengukuran Kinerja Sistem Pencahayaan", description: "Pengukuran illuminance, luminance, dan uniformity ratio" },
    ],
  },

  // =====================================================
  // E. MANAJEMEN PELAKSANAAN - MANAJEMEN KONSTRUKSI
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
      { code: "M.711000.004.01", name: "Menyusun Standar Kompetensi Manajemen Konstruksi", description: "Pengembangan dan evaluasi standar kompetensi bidang manajemen konstruksi" },
      { code: "M.711000.005.01", name: "Memberikan Pendapat Teknis Profesional Manajemen Konstruksi", description: "Expert opinion dalam sengketa dan permasalahan konstruksi" },
      { code: "M.711000.006.01", name: "Memimpin Evaluasi Kontrak Konstruksi Kompleks", description: "Review dan evaluasi kontrak konstruksi berskala besar dan kompleks" },
    ],
  },
  {
    id: "ahli-madya-manajemen-konstruksi",
    name: "Ahli Madya Bidang Keahlian Manajemen Konstruksi",
    jenjang: "Madya",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Manajemen Konstruksi",
    units: [
      { code: "M.711000.101.01", name: "Merumuskan Strategi Manajemen Proyek", description: "Penyusunan strategi dan rencana manajemen proyek konstruksi" },
      { code: "M.711000.102.01", name: "Mengelola Komunikasi dan Pemangku Kepentingan", description: "Pengelolaan komunikasi proyek dan hubungan dengan stakeholder" },
      { code: "M.711000.103.01", name: "Mengelola Risiko Proyek Konstruksi", description: "Identifikasi, analisis, dan mitigasi risiko proyek" },
      { code: "M.711000.104.01", name: "Mengelola Pengadaan Proyek Konstruksi", description: "Proses pengadaan material, jasa, dan subkontraktor" },
      { code: "M.711000.105.01", name: "Mengelola Perubahan Proyek Konstruksi", description: "Pengendalian perubahan lingkup, jadwal, dan biaya proyek" },
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
      { code: "M.711000.203.01", name: "Mengelola Lingkup Pekerjaan Konstruksi", description: "Pengelolaan dan pengendalian ruang lingkup proyek konstruksi" },
      { code: "M.711000.204.01", name: "Mengelola Waktu Pelaksanaan Konstruksi", description: "Penyusunan dan pengendalian jadwal pelaksanaan proyek" },
      { code: "M.711000.205.01", name: "Mengelola Biaya Pekerjaan Konstruksi", description: "Perencanaan, pengendalian, dan pelaporan biaya proyek" },
      { code: "M.711000.206.01", name: "Mengelola Mutu Pekerjaan Konstruksi", description: "Pengendalian dan jaminan mutu hasil pekerjaan konstruksi" },
    ],
  },

  // =====================================================
  // E. MANAJEMEN PELAKSANAAN - MANAJEMEN PROYEK
  // =====================================================

  {
    id: "ahli-utama-manajemen-proyek",
    name: "Ahli Utama Manajemen Proyek",
    jenjang: "Utama",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Manajemen Konstruksi/Manajemen Proyek",
    units: [
      { code: "M.71.MPR.001.01", name: "Memimpin Program Konstruksi Multi-Proyek", description: "Pengelolaan program konstruksi dengan banyak proyek terintegrasi" },
      { code: "M.71.MPR.002.01", name: "Merumuskan Kebijakan Manajemen Proyek Organisasi", description: "Pengembangan sistem dan kebijakan manajemen proyek korporasi" },
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
      { code: "M.71.MPR.105.01", name: "Mengelola Sumber Daya Manusia Proyek", description: "Pengelolaan tim, sub-kontraktor, dan sumber daya manusia proyek" },
      { code: "M.71.MPR.106.01", name: "Mengelola Pengadaan dan Kontrak Proyek", description: "Manajemen pengadaan dan administrasi kontrak proyek" },
    ],
  },
  {
    id: "ahli-muda-manajemen-proyek",
    name: "Ahli Muda Manajemen Proyek",
    jenjang: "Muda",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Manajemen Konstruksi/Manajemen Proyek",
    units: [
      { code: "M.71.MPR.201.01", name: "Menyusun Rencana Pelaksanaan Proyek (RMP)", description: "Penyusunan Project Management Plan termasuk semua subsidiary plans" },
      { code: "M.71.MPR.202.01", name: "Membuat Work Breakdown Structure (WBS)", description: "Dekomposisi pekerjaan ke dalam WBS dan activity list" },
      { code: "M.71.MPR.203.01", name: "Membuat Jadwal Pelaksanaan Proyek (Network)", description: "Penyusunan network diagram, critical path, dan kurva-S" },
      { code: "M.71.MPR.204.01", name: "Melakukan Pengendalian Progres Proyek", description: "Monitoring dan pelaporan kemajuan pekerjaan terhadap baseline" },
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
      { code: "M.71.LOG.001.01", name: "Merencanakan Kebutuhan Material dan Peralatan Proyek", description: "Penyusunan material schedule dan equipment plan proyek" },
      { code: "M.71.LOG.002.01", name: "Mengelola Pengadaan Material Konstruksi", description: "Proses tender, seleksi vendor, dan pembelian material" },
      { code: "M.71.LOG.003.01", name: "Mengelola Gudang dan Stok Material Proyek", description: "Pengelolaan penerimaan, penyimpanan, dan pengeluaran material" },
      { code: "M.71.LOG.004.01", name: "Mengelola Transportasi Material dan Peralatan", description: "Koordinasi pengiriman material dan mobilisasi peralatan" },
      { code: "M.71.LOG.005.01", name: "Melakukan Pengendalian Biaya Logistik Proyek", description: "Pemantauan dan pengendalian anggaran logistik proyek" },
    ],
  },

  // =====================================================
  // E. MANAJEMEN PELAKSANAAN - K3 KONSTRUKSI
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
      { code: "F.43.91100.003.01", name: "Memberikan Pendapat Teknis Profesional K3", description: "Expert opinion dalam kasus kecelakaan kerja dan sengketa K3" },
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
      { code: "F.43.91100.202.01", name: "Melakukan Identifikasi Bahaya dan Penilaian Risiko", description: "IBPR (HIRADC) dan pengendalian risiko K3 konstruksi" },
      { code: "F.43.91100.203.01", name: "Mengelola Sistem Izin Kerja Berbahaya", description: "Sistem ijin kerja di ketinggian, ruang terbatas, pekerjaan panas" },
      { code: "F.43.91100.204.01", name: "Melakukan Inspeksi K3 di Tempat Kerja", description: "Inspeksi rutin K3 dan patroli keselamatan di proyek" },
      { code: "F.43.91100.205.01", name: "Mengelola Alat Pelindung Diri (APD)", description: "Pengelolaan, pemilihan, dan penggunaan APD yang tepat" },
      { code: "F.43.91100.206.01", name: "Melakukan Sosialisasi dan Induksi K3", description: "Safety induction, toolbox meeting, dan komunikasi K3 pekerja" },
    ],
  },

  // =====================================================
  // E. MANAJEMEN PELAKSANAAN - PENGENDALIAN MUTU
  // =====================================================

  {
    id: "ahli-muda-sistem-mutu-konstruksi",
    name: "Ahli Muda Sistem Manajemen Mutu Konstruksi",
    jenjang: "Muda",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Pengendalian Mutu Pekerjaan Konstruksi",
    units: [
      { code: "M.71.QMU.001.01", name: "Menyusun Rencana Mutu Proyek (RMP)", description: "Penyusunan Quality Management Plan proyek konstruksi" },
      { code: "M.71.QMU.002.01", name: "Melakukan Inspeksi dan Pengujian Pekerjaan Konstruksi", description: "Pelaksanaan inspection and test plan (ITP) di lapangan" },
      { code: "M.71.QMU.003.01", name: "Mengelola Ketidaksesuaian (Non-Conformance)", description: "Penanganan NCR dan tindakan perbaikan dalam konstruksi" },
      { code: "M.71.QMU.004.01", name: "Melakukan Kalibrasi Alat Ukur dan Uji", description: "Pengelolaan kalibrasi peralatan pengujian dan pengukuran" },
      { code: "M.71.QMU.005.01", name: "Menyusun Laporan Pengendalian Mutu Proyek", description: "Penyusunan quality report dan rekaman mutu proyek" },
    ],
  },
  {
    id: "ahli-madya-sistem-mutu-konstruksi",
    name: "Ahli Madya Sistem Manajemen Mutu Konstruksi",
    jenjang: "Madya",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Pengendalian Mutu Pekerjaan Konstruksi",
    units: [
      { code: "M.71.QMU.101.01", name: "Menerapkan Sistem Manajemen Mutu ISO 9001", description: "Implementasi SMM berbasis standar ISO 9001 dalam konstruksi" },
      { code: "M.71.QMU.102.01", name: "Melakukan Audit Mutu Internal Konstruksi", description: "Pelaksanaan audit internal SMM pada unit organisasi" },
      { code: "M.71.QMU.103.01", name: "Menganalisis Data Kinerja Mutu Proyek", description: "Analisis statistik data mutu dan tren kinerja proyek" },
      { code: "M.71.QMU.104.01", name: "Mengelola Program Continuous Improvement Konstruksi", description: "Program peningkatan berkelanjutan kualitas proses konstruksi" },
      { code: "M.71.QMU.105.01", name: "Menyusun Prosedur dan Standar Mutu Konstruksi", description: "Pengembangan SOP, instruksi kerja, dan standar mutu konstruksi" },
    ],
  },

  // =====================================================
  // E. MANAJEMEN PELAKSANAAN - HUKUM KONTRAK
  // =====================================================

  {
    id: "ahli-madya-kontrak-konstruksi",
    name: "Ahli Madya Kontrak Kerja Konstruksi",
    jenjang: "Madya",
    klasifikasi: "Manajemen Pelaksanaan",
    subklasifikasi: "Hukum Kontrak Konstruksi",
    units: [
      { code: "M.71.HKK.001.01", name: "Menyusun Dokumen Kontrak Konstruksi", description: "Penyusunan dan review dokumen kontrak konstruksi (FIDIC, GCC)" },
      { code: "M.71.HKK.002.01", name: "Melakukan Analisis Klaim Konstruksi", description: "Identifikasi, analisis, dan penyusunan klaim kontrak" },
      { code: "M.71.HKK.003.01", name: "Mengelola Administrasi Kontrak Konstruksi", description: "Pengelolaan amandemen, addendum, dan perubahan kontrak" },
      { code: "M.71.HKK.004.01", name: "Melakukan Penyelesaian Sengketa Konstruksi", description: "Mediasi, arbitrase, dan penyelesaian sengketa kontrak" },
      { code: "M.71.HKK.005.01", name: "Memberikan Pendapat Hukum atas Kontrak Konstruksi", description: "Review legal atas klausul kontrak dan posisi hukum para pihak" },
    ],
  },

  // =====================================================
  // F. SAINS DAN REKAYASA TEKNIK
  // =====================================================

  {
    id: "ahli-madya-perencanaan-proyek-infrastruktur",
    name: "Ahli Madya Perencanaan Proyek Infrastruktur",
    jenjang: "Madya",
    klasifikasi: "Sains dan Rekayasa Teknik",
    subklasifikasi: "Investasi Infrastruktur",
    units: [
      { code: "M.71.INV.001.01", name: "Melakukan Studi Kelayakan Proyek Infrastruktur", description: "Penyusunan feasibility study teknis, ekonomi, dan finansial" },
      { code: "M.71.INV.002.01", name: "Melakukan Analisis Biaya Manfaat Infrastruktur", description: "Cost-benefit analysis dan nilai ekonomi proyek infrastruktur" },
      { code: "M.71.INV.003.01", name: "Merencanakan Skema Pembiayaan Infrastruktur", description: "Perencanaan skema pendanaan APBN, PPP, dan alternatif lainnya" },
      { code: "M.71.INV.004.01", name: "Melakukan Analisis Risiko Investasi Infrastruktur", description: "Identifikasi dan mitigasi risiko investasi proyek infrastruktur" },
      { code: "M.71.INV.005.01", name: "Menyusun Business Case Proyek Infrastruktur", description: "Penyusunan justifikasi dan kasus bisnis proyek infrastruktur" },
    ],
  },
  {
    id: "ahli-rekayasa-nilai",
    name: "Ahli Rekayasa Nilai (Value Engineering)",
    jenjang: "Utama",
    klasifikasi: "Sains dan Rekayasa Teknik",
    subklasifikasi: "Investasi Infrastruktur",
    units: [
      { code: "M.71.VE.001.01", name: "Memimpin Studi Value Engineering", description: "Penyelenggaraan dan fasilitasi studi VE pada proyek konstruksi" },
      { code: "M.71.VE.002.01", name: "Melakukan Analisis Fungsi dan Nilai", description: "Function analysis, FAST diagram, dan value analysis" },
      { code: "M.71.VE.003.01", name: "Mengembangkan Alternatif Desain dan Konstruksi", description: "Generasi dan evaluasi ide alternatif untuk efisiensi nilai" },
      { code: "M.71.VE.004.01", name: "Menyusun Laporan Studi Value Engineering", description: "Dokumentasi hasil studi VE dan rekomendasi penghematan" },
      { code: "M.71.VE.005.01", name: "Melakukan Life Cycle Cost Analysis", description: "Analisis biaya siklus hidup aset infrastruktur" },
    ],
  },
  {
    id: "manager-bim-muda",
    name: "Manager BIM Muda",
    jenjang: "Muda",
    klasifikasi: "Sains dan Rekayasa Teknik",
    subklasifikasi: "Komputasi Konstruksi",
    units: [
      { code: "M.71.BIM.001.01", name: "Menyusun BIM Execution Plan (BEP)", description: "Penyusunan rencana implementasi BIM untuk proyek konstruksi" },
      { code: "M.71.BIM.002.01", name: "Mengelola Model BIM Proyek Konstruksi", description: "Pengelolaan dan koordinasi model BIM multidisiplin" },
      { code: "M.71.BIM.003.01", name: "Melakukan Clash Detection dan Koordinasi BIM", description: "Identifikasi dan resolusi konflik antar disiplin dalam model BIM" },
      { code: "M.71.BIM.004.01", name: "Menyusun Standar dan Prosedur BIM", description: "Pengembangan BIM standard, template, dan prosedur proyek" },
      { code: "M.71.BIM.005.01", name: "Melakukan Quantity Take-off berbasis BIM", description: "Ekstraksi data BOQ dan estimasi biaya dari model BIM" },
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
