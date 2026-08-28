---
name: Regulation grounding (PKB docs)
description: Source-of-truth regulation docs for Gustafta and how they map into the app
---

Three official docs (user-attached PDFs in attached_assets/) are the regulatory ground truth:
- Permen PUPR 12/2021 — SKPK values/bobot (Lampiran I), komposisi Nilai Kredit (Pasal 20: utama ≥75%, nonformal ≤25%, terverifikasi ≥60%, khusus ≥60%), ambang 100/150/200 (Pasal 21), maks 25 SKPK per Exum produk.
- SE DJBK 214/SE/Dk/2022 — official Executive Summary format: I. Rincian Penugasan Kerja, II. Uraian Tugas Pekerjaan, III. Target Pengembangan Keahlian, IV. Pembelajaran Sehubungan dengan Penugasan Kerja. This PDF is SCANNED — text extraction yields nothing; render pages with `pdftoppm -png` and read the images.
- SK DJBK 114/2024 — jabker nomenclature (old→new mapping), revokes SK 33/2022; huge lampiran, extract with `pdftotext`.

**How to apply:** the condensed knowledge lives in api-server lib `regulation-knowledge.ts` (helpbot system prompt). Exum prompts for Pengalaman/Hybrid modes must keep the SE 214 4-section skeleton. Any new SKPK/composition feature should cite these pasal/lampiran, not invent numbers. pip installs are blocked (PEP 668) — use poppler tools for PDFs.

Jenis PKB saja tidak membuktikan unsur utama/penunjang, sifat khusus/umum, angka kredit, atau status verifikasi; semua itu memerlukan substansi dan bukti. Hanya status pendidikan nonformal yang boleh diberi default konservatif dari jenis Kursus/Pelatihan Mandiri, dan pengguna harus dapat mengoreksinya.

**Why:** Mengisi semua atribut dari label Seminar/Webinar/Kursus akan membuat pemeriksa komposisi tampak patuh berdasarkan klasifikasi yang tidak didukung regulasi.

**How to apply:** Terapkan default di server hanya ketika nilai tidak dikirim, jangan timpa override manual, dan jangan pernah mengubah status verifikasi dari jenis PKB.

- SK DJBK 114/2024 (scan; pdftotext works, columns jumbled) is the sole source for valid jabker nomenclature. Per that SK: irigasi = "Teknik Irigasi", spelling "Plambing dan Pompa Mekanik" (subklas stays "Plumbing"), and PLF BG Madya/Muda, Geologi PK Muda, Teknik Terowongan Muda no longer exist — do not reintroduce them in skk-data.
