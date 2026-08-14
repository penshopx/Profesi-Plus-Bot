import { describe, it, expect } from "vitest";
import { APL01_FIELDS, getMissingAplFields, getAplCompleteness } from "../apl-fields";
import type { Profile } from "../api-profile";

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 1,
    userId: 1,
    nik: "3271000000000001",
    tempatLahir: "Bogor",
    tanggalLahir: "1990-01-01",
    jenisKelamin: "L",
    agama: "Islam",
    nomorHp: "0812345678",
    alamat: "Jl. Merdeka 1",
    rt: "001",
    rw: "002",
    kelurahan: "Menteng",
    kecamatan: "Bogor Barat",
    kotaKabupaten: "Bogor",
    provinsi: "Jawa Barat",
    kodePos: "16111",
    jenjangPendidikan: "S1",
    namaInstitusi: "Universitas X",
    jurusan: "Teknik Sipil",
    tahunLulus: 2012,
    namaPerusahaan: "PT Konstruksi",
    jabatanSekarang: "Site Manager",
    tahunMulaiBekerja: 2015,
    alamatPerusahaan: "Jl. Industri 2",
    nomorSkk: "SKK-1234",
    masaBerlakuSkk: "2027-01-01",
    lembagaSertifikasi: "LSP Konstruksi Indonesia",
    ...overrides,
  } as Profile;
}

describe("getMissingAplFields", () => {
  it("returns empty array for a fully filled profile", () => {
    expect(getMissingAplFields(makeProfile())).toEqual([]);
  });

  it("lists every blank field label, treating null/undefined/empty string as blank", () => {
    const missing = getMissingAplFields(
      makeProfile({ nik: null, agama: undefined, kodePos: "", lembagaSertifikasi: null }),
    );
    expect(missing).toEqual(
      expect.arrayContaining(["NIK", "Agama", "Kode Pos", "Lembaga Sertifikasi (LSP)"]),
    );
    expect(missing).toHaveLength(4);
  });

  it("covers every editable field printed on APL 01 (including Jenis Kelamin, RT/RW, SKK expiry)", () => {
    const allNull = makeProfile({
      nik: null, tempatLahir: null, tanggalLahir: null, jenisKelamin: null, agama: null,
      nomorHp: null, alamat: null, rt: null, rw: null, kelurahan: null, kecamatan: null,
      kotaKabupaten: null, provinsi: null, kodePos: null, jenjangPendidikan: null,
      namaInstitusi: null, jurusan: null, tahunLulus: null, namaPerusahaan: null,
      jabatanSekarang: null, tahunMulaiBekerja: null, alamatPerusahaan: null,
      nomorSkk: null, masaBerlakuSkk: null, lembagaSertifikasi: null,
    });
    const missing = getMissingAplFields(allNull);
    expect(missing).toHaveLength(APL01_FIELDS.length);
    for (const label of [
      "Jenis Kelamin", "RT", "RW", "Masa Berlaku SKK", "Nomor HP",
      "Kelurahan/Desa", "Kecamatan", "Jurusan/Program Studi",
      "Tahun Lulus", "Tahun Mulai Bekerja", "Alamat Perusahaan",
    ]) {
      expect(missing).toContain(label);
    }
  });

  it("treats whitespace-only strings as blank but keeps numeric values filled", () => {
    const missing = getMissingAplFields(
      makeProfile({ alamat: "   ", nomorSkk: "\t\n", tahunLulus: 2012, tahunMulaiBekerja: 0 as unknown as number }),
    );
    expect(missing).toContain("Alamat Lengkap");
    expect(missing).toContain("Nomor SKK");
    expect(missing).not.toContain("Tahun Lulus");
    expect(missing).not.toContain("Tahun Mulai Bekerja");
    expect(missing).toHaveLength(2);
  });

  it("flags Tempat Lahir independently of Tanggal Lahir", () => {
    const missing = getMissingAplFields(makeProfile({ tempatLahir: null }));
    expect(missing).toEqual(["Tempat Lahir"]);
  });
});

describe("getAplCompleteness", () => {
  it("is 100 for a complete profile", () => {
    expect(getAplCompleteness(makeProfile())).toBe(100);
  });

  it("drops below 100 when any printed field is blank", () => {
    expect(getAplCompleteness(makeProfile({ jenisKelamin: null }))).toBeLessThan(100);
  });
});
