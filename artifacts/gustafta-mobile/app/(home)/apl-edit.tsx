/**
 * Edit APL 01 profile — mirrors the web APL01Form (profil.tsx) fields:
 * identitas diri, alamat, pendidikan, pekerjaan, SKK.
 * Saves via PATCH /profiles/me (same endpoint the web uses).
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, 
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getMyAplProfile, updateMyAplProfile, type AplProfile } from '@/lib/api';

const AGAMA_OPTIONS = ['Islam', 'Kristen Protestan', 'Kristen Katolik', 'Hindu', 'Buddha', 'Konghucu'];
const PENDIDIKAN_OPTIONS = ['SD', 'SMP', 'SMA/SMK', 'D1', 'D2', 'D3', 'D4', 'S1', 'S2', 'S3'];

type FormState = {
  nik: string;
  tempatLahir: string;
  tanggalLahir: string;
  jenisKelamin: string;
  agama: string;
  nomorHp: string;
  alamat: string;
  rt: string;
  rw: string;
  kodePos: string;
  kelurahan: string;
  kecamatan: string;
  kotaKabupaten: string;
  provinsi: string;
  jenjangPendidikan: string;
  namaInstitusi: string;
  jurusan: string;
  tahunLulus: string;
  namaPerusahaan: string;
  jabatanSekarang: string;
  tahunMulaiBekerja: string;
  alamatPerusahaan: string;
  nomorSkk: string;
  masaBerlakuSkk: string;
  lembagaSertifikasi: string;
};

function fromProfile(p: AplProfile): FormState {
  const s = (v: string | number | null | undefined) => (v == null ? '' : String(v));
  return {
    nik: s(p.nik), tempatLahir: s(p.tempatLahir), tanggalLahir: s(p.tanggalLahir),
    jenisKelamin: s(p.jenisKelamin), agama: s(p.agama), nomorHp: s(p.nomorHp),
    alamat: s(p.alamat), rt: s(p.rt), rw: s(p.rw), kodePos: s(p.kodePos),
    kelurahan: s(p.kelurahan), kecamatan: s(p.kecamatan),
    kotaKabupaten: s(p.kotaKabupaten), provinsi: s(p.provinsi),
    jenjangPendidikan: s(p.jenjangPendidikan), namaInstitusi: s(p.namaInstitusi),
    jurusan: s(p.jurusan), tahunLulus: s(p.tahunLulus),
    namaPerusahaan: s(p.namaPerusahaan), jabatanSekarang: s(p.jabatanSekarang),
    tahunMulaiBekerja: s(p.tahunMulaiBekerja), alamatPerusahaan: s(p.alamatPerusahaan),
    nomorSkk: s(p.nomorSkk), masaBerlakuSkk: s(p.masaBerlakuSkk),
    lembagaSertifikasi: s(p.lembagaSertifikasi),
  };
}

/** Returns { field: message } for invalid fields; empty object = valid. */
export function validateAplForm(f: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  const t = (v: string) => v.trim();
  if (t(f.nik) && !/^\d{16}$/.test(t(f.nik))) errors.nik = 'NIK harus 16 digit angka';
  if (t(f.nomorHp) && !/^0\d{8,14}$/.test(t(f.nomorHp).replace(/[\s-]/g, ''))) {
    errors.nomorHp = 'Nomor HP tidak valid (contoh: 08123456789)';
  }
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (t(f.tanggalLahir) && !dateRe.test(t(f.tanggalLahir))) {
    errors.tanggalLahir = 'Format tanggal: YYYY-MM-DD';
  }
  if (t(f.masaBerlakuSkk) && !dateRe.test(t(f.masaBerlakuSkk))) {
    errors.masaBerlakuSkk = 'Format tanggal: YYYY-MM-DD';
  }
  const yearOk = (v: string) => /^\d{4}$/.test(v) && +v >= 1940 && +v <= new Date().getFullYear() + 1;
  if (t(f.tahunLulus) && !yearOk(t(f.tahunLulus))) errors.tahunLulus = 'Tahun tidak valid';
  if (t(f.tahunMulaiBekerja) && !yearOk(t(f.tahunMulaiBekerja))) errors.tahunMulaiBekerja = 'Tahun tidak valid';
  if (t(f.kodePos) && !/^\d{5}$/.test(t(f.kodePos))) errors.kodePos = 'Kode pos harus 5 digit';
  return errors;
}

function toPatchBody(f: FormState) {
  const v = (s: string) => (s.trim() ? s.trim() : null);
  const n = (s: string) => (s.trim() ? Number(s.trim()) : null);
  return {
    nik: v(f.nik), tempatLahir: v(f.tempatLahir), tanggalLahir: v(f.tanggalLahir),
    jenisKelamin: v(f.jenisKelamin), agama: v(f.agama), nomorHp: v(f.nomorHp),
    alamat: v(f.alamat), rt: v(f.rt), rw: v(f.rw), kodePos: v(f.kodePos),
    kelurahan: v(f.kelurahan), kecamatan: v(f.kecamatan),
    kotaKabupaten: v(f.kotaKabupaten), provinsi: v(f.provinsi),
    jenjangPendidikan: v(f.jenjangPendidikan), namaInstitusi: v(f.namaInstitusi),
    jurusan: v(f.jurusan), tahunLulus: n(f.tahunLulus),
    namaPerusahaan: v(f.namaPerusahaan), jabatanSekarang: v(f.jabatanSekarang),
    tahunMulaiBekerja: n(f.tahunMulaiBekerja), alamatPerusahaan: v(f.alamatPerusahaan),
    nomorSkk: v(f.nomorSkk), masaBerlakuSkk: v(f.masaBerlakuSkk),
    lembagaSertifikasi: v(f.lembagaSertifikasi),
  };
}

export default function AplEditScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;

  const { data: profile, isLoading } = useQuery({
    queryKey: ['apl-profile'],
    queryFn: getMyAplProfile,
    retry: 1,
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize the form once the profile has loaded (don't clobber edits on refetch).
  useEffect(() => {
    if (profile && !form) setForm(fromProfile(profile));
  }, [profile, form]);

  const saveMut = useMutation({
    mutationFn: (f: FormState) => updateMyAplProfile(toPatchBody(f)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apl-profile'] });
      showAlert('Tersimpan', 'Profil APL 01 berhasil disimpan.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (e: unknown) => {
      showAlert('Gagal menyimpan', e instanceof Error ? e.message : 'Coba lagi.');
    },
  });

  const set = (key: keyof FormState) => (val: string) => {
    setForm((f) => (f ? { ...f, [key]: val } : f));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const handleSave = () => {
    if (!form) return;
    const errs = validateAplForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      showAlert('Periksa isian', Object.values(errs).join('\n'));
      return;
    }
    saveMut.mutate(form);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[st.header, { paddingTop: topPad + 8, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 4 }]}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[st.headerTitle, { color: colors.foreground }]}>Edit Profil APL 01</Text>
        <View style={{ width: 30 }} />
      </View>

      {isLoading || !form ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 + insets.bottom, gap: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          <Section title="Identitas Diri" icon="user" colors={colors}>
            <Field label="NIK (16 digit)" value={form.nik} onChange={set('nik')} error={errors.nik} colors={colors} keyboardType="number-pad" maxLength={16} placeholder="3271XXXXXXXXXXXX" />
            <Field label="Tempat Lahir" value={form.tempatLahir} onChange={set('tempatLahir')} colors={colors} />
            <Field label="Tanggal Lahir (YYYY-MM-DD)" value={form.tanggalLahir} onChange={set('tanggalLahir')} error={errors.tanggalLahir} colors={colors} placeholder="1990-01-31" />
            <ChipPicker
              label="Jenis Kelamin"
              value={form.jenisKelamin}
              options={[{ value: 'L', label: 'Laki-laki' }, { value: 'P', label: 'Perempuan' }]}
              onChange={set('jenisKelamin')}
              colors={colors}
            />
            <ChipPicker
              label="Agama"
              value={form.agama}
              options={AGAMA_OPTIONS.map((a) => ({ value: a, label: a }))}
              onChange={set('agama')}
              colors={colors}
            />
            <Field label="Nomor HP" value={form.nomorHp} onChange={set('nomorHp')} error={errors.nomorHp} colors={colors} keyboardType="phone-pad" placeholder="08XXXXXXXXXX" />
          </Section>

          <Section title="Alamat Tempat Tinggal" icon="map-pin" colors={colors}>
            <Field label="Alamat Lengkap" value={form.alamat} onChange={set('alamat')} colors={colors} multiline placeholder="Jl. ..." />
            <View style={st.row}>
              <View style={{ flex: 1 }}><Field label="RT" value={form.rt} onChange={set('rt')} colors={colors} keyboardType="number-pad" placeholder="001" /></View>
              <View style={{ flex: 1 }}><Field label="RW" value={form.rw} onChange={set('rw')} colors={colors} keyboardType="number-pad" placeholder="002" /></View>
              <View style={{ flex: 1 }}><Field label="Kode Pos" value={form.kodePos} onChange={set('kodePos')} error={errors.kodePos} colors={colors} keyboardType="number-pad" maxLength={5} placeholder="12345" /></View>
            </View>
            <Field label="Kelurahan/Desa" value={form.kelurahan} onChange={set('kelurahan')} colors={colors} />
            <Field label="Kecamatan" value={form.kecamatan} onChange={set('kecamatan')} colors={colors} />
            <Field label="Kota/Kabupaten" value={form.kotaKabupaten} onChange={set('kotaKabupaten')} colors={colors} />
            <Field label="Provinsi" value={form.provinsi} onChange={set('provinsi')} colors={colors} />
          </Section>

          <Section title="Pendidikan Terakhir" icon="book" colors={colors}>
            <ChipPicker
              label="Jenjang Pendidikan"
              value={form.jenjangPendidikan}
              options={PENDIDIKAN_OPTIONS.map((p) => ({ value: p, label: p }))}
              onChange={set('jenjangPendidikan')}
              colors={colors}
            />
            <Field label="Nama Institusi/Sekolah" value={form.namaInstitusi} onChange={set('namaInstitusi')} colors={colors} />
            <Field label="Jurusan/Program Studi" value={form.jurusan} onChange={set('jurusan')} colors={colors} />
            <Field label="Tahun Lulus" value={form.tahunLulus} onChange={set('tahunLulus')} error={errors.tahunLulus} colors={colors} keyboardType="number-pad" maxLength={4} placeholder="2010" />
          </Section>

          <Section title="Pekerjaan Saat Ini" icon="briefcase" colors={colors}>
            <Field label="Nama Perusahaan" value={form.namaPerusahaan} onChange={set('namaPerusahaan')} colors={colors} />
            <Field label="Jabatan Sekarang" value={form.jabatanSekarang} onChange={set('jabatanSekarang')} colors={colors} />
            <Field label="Tahun Mulai Bekerja" value={form.tahunMulaiBekerja} onChange={set('tahunMulaiBekerja')} error={errors.tahunMulaiBekerja} colors={colors} keyboardType="number-pad" maxLength={4} placeholder="2015" />
            <Field label="Alamat Perusahaan" value={form.alamatPerusahaan} onChange={set('alamatPerusahaan')} colors={colors} multiline placeholder="Jl. ..." />
          </Section>

          <Section title="Sertifikat Kompetensi Kerja (SKK)" icon="award" colors={colors}>
            <Field label="Nomor SKK" value={form.nomorSkk} onChange={set('nomorSkk')} colors={colors} placeholder="SKK-XXXX-XXXX" />
            <Field label="Masa Berlaku SKK (YYYY-MM-DD)" value={form.masaBerlakuSkk} onChange={set('masaBerlakuSkk')} error={errors.masaBerlakuSkk} colors={colors} placeholder="2027-12-31" />
            <Field label="Lembaga Sertifikasi (LSP)" value={form.lembagaSertifikasi} onChange={set('lembagaSertifikasi')} colors={colors} placeholder="LSP Konstruksi Indonesia" />
          </Section>

          <Pressable
            testID="btn-save-apl"
            onPress={handleSave}
            disabled={saveMut.isPending}
            style={({ pressed }) => [
              st.saveBtn,
              { backgroundColor: colors.primary, opacity: pressed || saveMut.isPending ? 0.7 : 1 },
            ]}
          >
            {saveMut.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Feather name="save" size={18} color="#fff" />
            )}
            <Text style={st.saveText}>{saveMut.isPending ? 'Menyimpan…' : 'Simpan Profil APL 01'}</Text>
          </Pressable>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Small building blocks ────────────────────────────────────────────────────

function Section({
  title, icon, colors, children,
}: {
  title: string;
  icon: string;
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={[st.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={st.sectionHeader}>
        <Feather name={icon as any} size={16} color={colors.primary} />
        <Text style={[st.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      </View>
      <View style={{ gap: 12 }}>{children}</View>
    </View>
  );
}

function Field({
  label, value, onChange, colors, error, placeholder, keyboardType, maxLength, multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  colors: ReturnType<typeof useColors>;
  error?: string;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'phone-pad';
  maxLength?: number;
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={[st.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground + '88'}
        keyboardType={keyboardType ?? 'default'}
        maxLength={maxLength}
        multiline={multiline}
        style={[
          st.input,
          multiline && { minHeight: 64, textAlignVertical: 'top' },
          {
            backgroundColor: colors.background,
            borderColor: error ? colors.destructive : colors.border,
            color: colors.foreground,
          },
        ]}
      />
      {error ? <Text style={[st.error, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

function ChipPicker({
  label, value, options, onChange, colors,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[st.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={st.chipRow}>
        {options.map((o) => {
          const selected = value === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(selected ? '' : o.value)}
              style={[
                st.chip,
                {
                  backgroundColor: selected ? colors.primary : colors.background,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[st.chipText, { color: selected ? '#fff' : colors.foreground }]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold' },
  section: { borderRadius: 14, borderWidth: 1, padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold' },
  label: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  error: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
  row: { flexDirection: 'row', gap: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  saveText: { color: '#fff', fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
