/**
 * Dokumentasi Kegiatan PKB — Mobile
 *
 * Halaman untuk mencatat dan mengelola kegiatan PKB dari perangkat mobile.
 * Mendukung 11 field standar BNSP/LPJK (field 1–8, 10, 11 — dokumen fisik
 * diupload via web app). Field 5 (SKK mapping) dapat diisi secara manual.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, TextInput, Alert,
  Modal, ActivityIndicator, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import {
  listMyKegiatanPkb, createKegiatanPkb, updateKegiatanPkb, deleteKegiatanPkb,
  updateKegiatanSkk,
  type PkbActivity, type CreateKegiatanBody, type PkbSkkUnit,
} from '@/lib/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const JENIS_PKB = ['Seminar', 'Webinar', 'Diklatkerja', 'Workshop', 'Kursus Online', 'Pelatihan Mandiri', 'Lainnya'];
const MODE_OPTIONS = ['Online', 'Offline', 'Hybrid'];

const STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  draft:        { label: 'Draft',          bg: '#F3F4F6', text: '#6B7280' },
  lengkap:      { label: 'Lengkap',        bg: '#ECFDF5', text: '#059669' },
  diajukan:     { label: 'Diajukan',       bg: '#EFF6FF', text: '#2563EB' },
  diverifikasi: { label: 'Terverifikasi',  bg: '#EDE9FE', text: '#7C3AED' },
  ditolak:      { label: 'Perlu Perbaikan', bg: '#FEF2F2', text: '#DC2626' },
};

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, colors }: { status: string; colors: ReturnType<typeof useColors> }) {
  const m = STATUS_META[status] ?? { label: status, bg: colors.muted, text: colors.mutedForeground };
  return (
    <View style={{ backgroundColor: m.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 }}>
      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: m.text }}>{m.label}</Text>
    </View>
  );
}

// ─── Date input helper ────────────────────────────────────────────────────────

function DateInput({
  value, onChange, placeholder, colors,
}: {
  value: string; onChange: (v: string) => void; placeholder: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={(t) => {
        // Auto-format: insert dashes at positions 4 and 7
        const digits = t.replace(/\D/g, '').slice(0, 8);
        let formatted = digits;
        if (digits.length > 4) formatted = `${digits.slice(0,4)}-${digits.slice(4)}`;
        if (digits.length > 6) formatted = `${digits.slice(0,4)}-${digits.slice(4,6)}-${digits.slice(6)}`;
        onChange(formatted);
      }}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      keyboardType="numeric"
      maxLength={10}
      style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
    />
  );
}

// ─── Field row ────────────────────────────────────────────────────────────────

function FieldLabel({ children, colors }: { children: string; colors: ReturnType<typeof useColors> }) {
  return (
    <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{children}</Text>
  );
}

function TextAreaInput({
  value, onChange, placeholder, colors, rows = 3,
}: {
  value: string; onChange: (v: string) => void; placeholder: string;
  colors: ReturnType<typeof useColors>; rows?: number;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      multiline
      numberOfLines={rows}
      textAlignVertical="top"
      style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background, minHeight: rows * 22 }]}
    />
  );
}

// ─── Chip selector ────────────────────────────────────────────────────────────

function ChipSelector({
  options, value, onChange, colors,
}: {
  options: string[]; value: string; onChange: (v: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => {
        const selected = value.toLowerCase() === opt.toLowerCase();
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(selected ? '' : opt.toLowerCase())}
            style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99,
              backgroundColor: selected ? colors.primary : colors.muted,
              borderWidth: 1, borderColor: selected ? colors.primary : colors.border,
            }}
          >
            <Text style={{
              fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium',
              color: selected ? '#fff' : colors.foreground,
            }}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── SKK Manager ──────────────────────────────────────────────────────────────

function SkkManager({
  skk, onUpdate, activityId, colors,
}: {
  skk: PkbSkkUnit[]; onUpdate: (skk: PkbSkkUnit[]) => void;
  activityId: number; colors: ReturnType<typeof useColors>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [skkCode, setSkkCode] = useState('');
  const [skkName, setSkkName] = useState('');
  const [jabkerName, setJabkerName] = useState('');

  const qc = useQueryClient();
  const updateMut = useMutation({
    mutationFn: (newSkk: PkbSkkUnit[]) => updateKegiatanSkk(activityId, newSkk),
    onSuccess: (result) => {
      onUpdate(result.skk);
      qc.invalidateQueries({ queryKey: ['kegiatan'] });
    },
  });

  function addUnit() {
    if (!skkCode.trim() || !skkName.trim()) {
      Alert.alert('Isi kode dan nama unit SKK');
      return;
    }
    const newSkk = [...skk, { skkCode: skkCode.trim(), skkName: skkName.trim(), jabkerName: jabkerName.trim() || undefined }];
    updateMut.mutate(newSkk);
    setSkkCode(''); setSkkName(''); setJabkerName('');
    setShowAdd(false);
  }

  function removeUnit(i: number) {
    const newSkk = skk.filter((_, idx) => idx !== i);
    updateMut.mutate(newSkk);
  }

  return (
    <View style={{ gap: 8 }}>
      {skk.map((u, i) => (
        <View key={i} style={[s.skkRow, { borderColor: colors.border, backgroundColor: colors.muted }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.primary }}>{u.skkCode}</Text>
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: colors.foreground, marginTop: 2 }}>{u.skkName}</Text>
            {u.jabkerName && <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{u.jabkerName}</Text>}
          </View>
          <Pressable onPress={() => removeUnit(i)} hitSlop={8}>
            <Feather name="x" size={16} color={colors.destructive} />
          </Pressable>
        </View>
      ))}

      {showAdd ? (
        <View style={[s.skkRow, { borderColor: colors.border, backgroundColor: colors.background, flexDirection: 'column' }]}>
          <TextInput
            value={skkCode}
            onChangeText={setSkkCode}
            placeholder="Kode SKK — mis. F.45.2.0.0.0.0.0.01"
            placeholderTextColor={colors.mutedForeground}
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted, marginBottom: 6 }]}
          />
          <TextInput
            value={skkName}
            onChangeText={setSkkName}
            placeholder="Nama unit kompetensi"
            placeholderTextColor={colors.mutedForeground}
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted, marginBottom: 6 }]}
          />
          <TextInput
            value={jabkerName}
            onChangeText={setJabkerName}
            placeholder="Jabatan kerja (opsional)"
            placeholderTextColor={colors.mutedForeground}
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted, marginBottom: 8 }]}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={addUnit}
              disabled={updateMut.isPending}
              style={({ pressed }) => [s.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1, flex: 1 }]}
            >
              {updateMut.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.btnText}>Tambah</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => setShowAdd(false)}
              style={({ pressed }) => [s.btn, { backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[s.btnText, { color: colors.foreground }]}>Batal</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setShowAdd(true)}
          style={({ pressed }) => [s.addBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="plus" size={14} color={colors.primary} />
          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.primary }}>
            Tambah Unit SKK
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Activity form modal ───────────────────────────────────────────────────────

type FormData = Partial<CreateKegiatanBody> & { namaKegiatan: string; tanggalMulai: string };

function ActivityFormModal({
  visible, initial, onClose, onSaved, colors,
}: {
  visible: boolean; initial?: PkbActivity | null; onClose: () => void;
  onSaved: (act: PkbActivity) => void; colors: ReturnType<typeof useColors>;
}) {
  const [form, setForm] = useState<FormData>(() =>
    initial
      ? { namaKegiatan: initial.namaKegiatan, tanggalMulai: initial.tanggalMulai,
          tanggalSelesai: initial.tanggalSelesai ?? '', tempatKegiatan: initial.tempatKegiatan ?? '',
          modePelaksanaan: initial.modePelaksanaan ?? '', namaMateri: initial.namaMateri ?? '',
          penyelenggara: initial.penyelenggara ?? '', namaInstruktur: initial.namaInstruktur ?? '',
          uraianSingkat: initial.uraianSingkat ?? '', linkRekaman: initial.linkRekaman ?? '',
          jenisPkb: initial.jenisPkb ?? '', jpPkb: initial.jpPkb ?? undefined }
      : { namaKegiatan: '', tanggalMulai: '' }
  );

  const qc = useQueryClient();
  const createMut = useMutation({
    mutationFn: (data: CreateKegiatanBody) => createKegiatanPkb(data),
    onSuccess: (act) => { qc.invalidateQueries({ queryKey: ['kegiatan'] }); onSaved(act); },
  });
  const updateMut = useMutation({
    mutationFn: (data: Partial<CreateKegiatanBody>) => updateKegiatanPkb(initial!.id, data),
    onSuccess: (act) => { qc.invalidateQueries({ queryKey: ['kegiatan'] }); onSaved(act); },
  });

  const isPending = createMut.isPending || updateMut.isPending;
  const error = (createMut.error || updateMut.error) as Error | null;

  function f(key: keyof typeof form) {
    return (v: string) => setForm((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSave() {
    if (!form.namaKegiatan.trim()) { Alert.alert('Nama kegiatan wajib diisi'); return; }
    if (!form.tanggalMulai || !/^\d{4}-\d{2}-\d{2}$/.test(form.tanggalMulai)) {
      Alert.alert('Tanggal mulai harus dalam format YYYY-MM-DD'); return;
    }
    const body: CreateKegiatanBody = {
      namaKegiatan: form.namaKegiatan.trim(),
      tanggalMulai: form.tanggalMulai,
      tanggalSelesai: form.tanggalSelesai?.trim() || undefined,
      tempatKegiatan: form.tempatKegiatan?.trim() || undefined,
      modePelaksanaan: form.modePelaksanaan?.trim() || undefined,
      namaMateri: form.namaMateri?.trim() || undefined,
      penyelenggara: form.penyelenggara?.trim() || undefined,
      namaInstruktur: form.namaInstruktur?.trim() || undefined,
      uraianSingkat: form.uraianSingkat?.trim() || undefined,
      linkRekaman: form.linkRekaman?.trim() || undefined,
      jenisPkb: form.jenisPkb?.trim() || undefined,
      jpPkb: form.jpPkb ? Number(form.jpPkb) : undefined,
    };
    if (initial) { updateMut.mutate(body); }
    else { createMut.mutate(body); }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={{ fontSize: 15, color: colors.mutedForeground, fontFamily: 'PlusJakartaSans_400Regular' }}>Batal</Text>
          </Pressable>
          <Text style={[s.modalTitle, { color: colors.foreground }]}>
            {initial ? 'Edit Kegiatan' : 'Kegiatan Baru'}
          </Text>
          <Pressable onPress={handleSave} disabled={isPending} hitSlop={8}>
            {isPending
              ? <ActivityIndicator color={colors.primary} size="small" />
              : <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary }}>Simpan</Text>}
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
          {error && (
            <View style={[s.errorBox, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
              <Text style={{ color: '#DC2626', fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular' }}>{error.message}</Text>
            </View>
          )}

          {/* Field 1 — Nama kegiatan */}
          <FieldLabel colors={colors}>Nama Kegiatan *</FieldLabel>
          <TextInput
            value={form.namaKegiatan}
            onChangeText={f('namaKegiatan')}
            placeholder="Webinar K3 Konstruksi 2025"
            placeholderTextColor={colors.mutedForeground}
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
          />

          {/* Field 2 — Tanggal */}
          <FieldLabel colors={colors}>Tanggal Mulai * (YYYY-MM-DD)</FieldLabel>
          <DateInput value={form.tanggalMulai ?? ''} onChange={f('tanggalMulai')} placeholder="2025-06-15" colors={colors} />

          <FieldLabel colors={colors}>Tanggal Selesai (biarkan kosong jika 1 hari)</FieldLabel>
          <DateInput value={form.tanggalSelesai ?? ''} onChange={f('tanggalSelesai')} placeholder="2025-06-16" colors={colors} />

          {/* Field 3 — Tempat */}
          <FieldLabel colors={colors}>Tempat Kegiatan</FieldLabel>
          <TextInput
            value={form.tempatKegiatan ?? ''}
            onChangeText={f('tempatKegiatan')}
            placeholder="Zoom / Hotel Grand Hyatt Jakarta"
            placeholderTextColor={colors.mutedForeground}
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
          />
          <FieldLabel colors={colors}>Mode Pelaksanaan</FieldLabel>
          <ChipSelector options={MODE_OPTIONS} value={form.modePelaksanaan ?? ''} onChange={f('modePelaksanaan')} colors={colors} />

          {/* Field 4 — Materi */}
          <FieldLabel colors={colors}>Jenis PKB</FieldLabel>
          <ChipSelector options={JENIS_PKB} value={form.jenisPkb ?? ''} onChange={f('jenisPkb')} colors={colors} />

          <FieldLabel colors={colors}>Nama Materi / Modul</FieldLabel>
          <TextInput
            value={form.namaMateri ?? ''}
            onChangeText={f('namaMateri')}
            placeholder="Manajemen Keselamatan Kerja Konstruksi"
            placeholderTextColor={colors.mutedForeground}
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
          />

          <FieldLabel colors={colors}>Penyelenggara</FieldLabel>
          <TextInput
            value={form.penyelenggara ?? ''}
            onChangeText={f('penyelenggara')}
            placeholder="PT Bangun Konstruksi Indonesia"
            placeholderTextColor={colors.mutedForeground}
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
          />

          <FieldLabel colors={colors}>Instruktur / Narasumber</FieldLabel>
          <TextInput
            value={form.namaInstruktur ?? ''}
            onChangeText={f('namaInstruktur')}
            placeholder="Ir. Budi Santoso, MT"
            placeholderTextColor={colors.mutedForeground}
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
          />

          <FieldLabel colors={colors}>Jam Pelajaran (JP)</FieldLabel>
          <TextInput
            value={form.jpPkb != null ? String(form.jpPkb) : ''}
            onChangeText={(v) => setForm((prev) => ({ ...prev, jpPkb: v ? Number(v) : undefined }))}
            placeholder="8"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
          />

          {/* Field 8 — Uraian singkat */}
          <FieldLabel colors={colors}>Uraian Singkat Kegiatan (Field 8)</FieldLabel>
          <TextAreaInput
            value={form.uraianSingkat ?? ''}
            onChange={f('uraianSingkat')}
            placeholder="Uraikan singkat isi dan manfaat kegiatan ini…"
            colors={colors}
            rows={4}
          />

          {/* Field 10 — Link rekaman */}
          <FieldLabel colors={colors}>Link Rekaman / Video (Field 10)</FieldLabel>
          <TextInput
            value={form.linkRekaman ?? ''}
            onChangeText={f('linkRekaman')}
            placeholder="https://youtube.com/..."
            placeholderTextColor={colors.mutedForeground}
            keyboardType="url"
            autoCapitalize="none"
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Activity card ─────────────────────────────────────────────────────────────

function ActivityCard({
  activity, onPress, colors,
}: { activity: PkbActivity; onPress: () => void; colors: ReturnType<typeof useColors> }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <Text style={[s.cardTitle, { color: colors.foreground, flex: 1 }]} numberOfLines={2}>{activity.namaKegiatan}</Text>
        <StatusBadge status={activity.status} colors={colors} />
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
        <Text style={[s.cardMeta, { color: colors.mutedForeground }]}>
          <Feather name="calendar" size={11} /> {activity.tanggalMulai}
        </Text>
        {activity.jenisPkb && (
          <Text style={[s.cardMeta, { color: colors.mutedForeground }]}>
            {activity.jenisPkb}
          </Text>
        )}
        {activity.skk && activity.skk.length > 0 && (
          <Text style={[s.cardMeta, { color: '#6366F1' }]}>
            {activity.skk.length} SKK
          </Text>
        )}
      </View>
      {activity.status === 'ditolak' && activity.askomNote && (
        <Text style={[s.cardMeta, { color: '#DC2626', marginTop: 4 }]} numberOfLines={2}>
          ⚠ {activity.askomNote}
        </Text>
      )}
    </Pressable>
  );
}

// ─── Activity detail screen (modal) ──────────────────────────────────────────

function ActivityDetail({
  activity, onClose, onEdited, colors,
}: {
  activity: PkbActivity; onClose: () => void;
  onEdited: (act: PkbActivity) => void; colors: ReturnType<typeof useColors>;
}) {
  const [skk, setSkk] = useState<PkbSkkUnit[]>(activity.skk ?? []);
  const [showEdit, setShowEdit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();

  const deleteMut = useMutation({
    mutationFn: () => deleteKegiatanPkb(activity.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kegiatan'] }); onClose(); },
  });

  const canEdit = activity.status !== 'diverifikasi';

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </Pressable>
          <StatusBadge status={activity.status} colors={colors} />
          {canEdit && (
            <Pressable onPress={() => setShowEdit(true)} hitSlop={8}>
              <Feather name="edit-2" size={18} color={colors.primary} />
            </Pressable>
          )}
        </View>

        <ScrollView contentContainerStyle={s.modalContent}>
          <Text style={[s.modalTitle, { color: colors.foreground, textAlign: 'left', marginBottom: 4 }]}>
            {activity.namaKegiatan}
          </Text>
          <Text style={[s.cardMeta, { color: colors.mutedForeground, marginBottom: 16 }]}>
            {activity.tanggalMulai}
            {activity.tanggalSelesai && activity.tanggalSelesai !== activity.tanggalMulai
              ? ` s/d ${activity.tanggalSelesai}` : ''}
            {activity.tempatKegiatan ? ` · ${activity.tempatKegiatan}` : ''}
            {activity.modePelaksanaan ? ` (${activity.modePelaksanaan})` : ''}
          </Text>

          {activity.status === 'ditolak' && activity.askomNote && (
            <View style={[s.alertBox, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#DC2626', marginBottom: 4 }}>
                Catatan Verifikasi — Perbaiki lalu hubungi Asosiasi
              </Text>
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', color: '#B91C1C' }}>
                {activity.askomNote}
              </Text>
            </View>
          )}
          {activity.status === 'diverifikasi' && activity.askomNote && (
            <View style={[s.alertBox, { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' }]}>
              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#059669', marginBottom: 4 }}>
                Catatan Verifikasi
              </Text>
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', color: '#065F46' }}>
                {activity.askomNote}
              </Text>
            </View>
          )}

          {/* Info rows */}
          {activity.namaMateri && <InfoItem label="Materi / Modul" value={activity.namaMateri} colors={colors} />}
          {activity.jenisPkb && <InfoItem label="Jenis PKB" value={`${activity.jenisPkb}${activity.jpPkb ? ` · ${activity.jpPkb} JP` : ''}`} colors={colors} />}
          {activity.penyelenggara && <InfoItem label="Penyelenggara" value={activity.penyelenggara} colors={colors} />}
          {activity.namaInstruktur && <InfoItem label="Instruktur" value={activity.namaInstruktur} colors={colors} />}
          {activity.uraianSingkat && <InfoItem label="Uraian Singkat" value={activity.uraianSingkat} colors={colors} />}
          {activity.linkRekaman && <InfoItem label="Rekaman" value={activity.linkRekaman} colors={colors} />}

          {/* SKK mapping */}
          <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>
            Mapping SKK (Field 5) — {skk.length} unit
          </Text>
          <SkkManager skk={skk} onUpdate={setSkk} activityId={activity.id} colors={colors} />

          {/* Dokumen note */}
          <View style={[s.alertBox, { backgroundColor: colors.muted, borderColor: colors.border, marginTop: 16 }]}>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, fontFamily: 'PlusJakartaSans_400Regular' }}>
              📎 Unggah dokumen fisik (surat undangan, daftar hadir, foto) melalui versi web Gustafta PKB.
            </Text>
          </View>

          {/* Actions */}
          <View style={{ gap: 10, marginTop: 16 }}>
            {activity.status === 'lengkap' && (
              <View style={[s.alertBox, { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' }]}>
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#065F46', textAlign: 'center' }}>
                  ✅ Dokumentasi lengkap — siap diverifikasi Asosiasi
                </Text>
              </View>
            )}
            {canEdit && (
              <Pressable
                onPress={() => Alert.alert('Hapus kegiatan?', 'Tindakan ini tidak dapat dibatalkan.', [
                  { text: 'Batal', style: 'cancel' },
                  { text: 'Hapus', style: 'destructive', onPress: () => deleteMut.mutate() },
                ])}
                disabled={deleteMut.isPending}
                style={({ pressed }) => [s.btn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FCA5A5', opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[s.btnText, { color: '#DC2626' }]}>Hapus Kegiatan</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </View>

      {showEdit && (
        <ActivityFormModal
          visible={showEdit}
          initial={activity}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => { setShowEdit(false); onEdited(updated); }}
          colors={colors}
        />
      )}
    </Modal>
  );
}

function InfoItem({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: 'PlusJakartaSans_500Medium', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontSize: 14, color: colors.foreground, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 }}>{value}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function KegiatanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<PkbActivity | null>(null);

  const { data: activities = [], isLoading, refetch } = useQuery<PkbActivity[]>({
    queryKey: ['kegiatan'],
    queryFn: listMyKegiatanPkb,
    staleTime: 30 * 1000,
  });

  const counts = {
    draft:        activities.filter((a) => a.status === 'draft' || a.status === 'lengkap').length,
    diajukan:     activities.filter((a) => a.status === 'diajukan').length,
    diverifikasi: activities.filter((a) => a.status === 'diverifikasi').length,
    ditolak:      activities.filter((a) => a.status === 'ditolak').length,
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Kegiatan PKB</Text>
          <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: colors.mutedForeground }}>
            Dokumentasi portofolio sesuai Permen PUPR 12/2021
          </Text>
        </View>
        <Pressable
          onPress={() => setShowCreate(true)}
          style={({ pressed }) => [s.addIconBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="plus" size={18} color="#fff" />
        </Pressable>
      </View>

      {/* Stats row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 16 }}>
        {[
          { label: 'Draft/Lengkap', count: counts.draft, color: '#6B7280' },
          { label: 'Diajukan', count: counts.diajukan, color: '#2563EB' },
          { label: 'Terverifikasi', count: counts.diverifikasi, color: '#7C3AED' },
          { label: 'Ditolak', count: counts.ditolak, color: '#DC2626' },
        ].map((stat) => (
          <View key={stat.label} style={[s.statChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: stat.color }}>{stat.count}</Text>
            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular', color: colors.mutedForeground }}>{stat.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* List */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : activities.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Feather name="file-text" size={40} color={colors.mutedForeground} style={{ opacity: 0.4, marginBottom: 16 }} />
          <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.foreground, textAlign: 'center' }}>
            Belum ada kegiatan PKB
          </Text>
          <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: 'center', marginTop: 8, fontFamily: 'PlusJakartaSans_400Regular' }}>
            Catat setiap seminar, webinar, atau pelatihan yang kamu ikuti sebagai bukti PKB formal.
          </Text>
          <Pressable
            onPress={() => setShowCreate(true)}
            style={({ pressed }) => [s.btn, { backgroundColor: colors.primary, marginTop: 20, opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={s.btnText}>Tambah Kegiatan Pertama</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ActivityCard activity={item} onPress={() => setSelectedActivity(item)} colors={colors} />
          )}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 16 }}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <ActivityFormModal
          visible={showCreate}
          onClose={() => setShowCreate(false)}
          onSaved={() => setShowCreate(false)}
          colors={colors}
        />
      )}

      {/* Detail modal */}
      {selectedActivity && (
        <ActivityDetail
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
          onEdited={(updated) => setSelectedActivity(updated)}
          colors={colors}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold' },
  addIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statChip: { borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center', minWidth: 90 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },
  cardTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', lineHeight: 20 },
  cardMeta: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', textAlign: 'center' },
  modalContent: { padding: 20, gap: 8, paddingBottom: 40 },
  fieldLabel: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 4, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: 12,
  },
  btnText: { color: '#fff', fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10,
    borderStyle: 'dashed', paddingVertical: 10, paddingHorizontal: 12,
  },
  skkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 1 },
  sectionLabel: {
    fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', textTransform: 'uppercase',
    letterSpacing: 0.5, marginTop: 16, marginBottom: 8,
  },
  errorBox: { borderRadius: 10, borderWidth: 1, padding: 12 },
  alertBox: { borderRadius: 10, borderWidth: 1, padding: 12 },
});
