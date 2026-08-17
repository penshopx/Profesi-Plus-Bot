/**
 * Kelola Klaim Kompetensi APL 02 — mirrors the web APL02Panel (profil.tsx):
 * list / add / edit / delete competency claims via /profiles/me/claims.
 * Jabker + SKK unit pickers use the same /skk endpoints as the web.
 */

import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  getMyAplClaims, createAplClaim, updateAplClaim, deleteAplClaim,
  listJabkers, fetchSkkUnits, type AplClaim,
} from '@/lib/api';

const PENCAPAIAN_OPTIONS = [
  { value: 'kompeten', label: 'Kompeten' },
  { value: 'dalam_proses', label: 'Dalam Proses' },
  { value: 'belum_kompeten', label: 'Belum Kompeten' },
];
const BUKTI_TYPES = ['portofolio', 'sertifikat', 'laporan', 'foto', 'video', 'testimoni', 'lainnya'];

const EMPTY_FORM = {
  jabker: '', skkUnitCode: '', skkUnitName: '', jenjang: '',
  pencapaian: 'dalam_proses', buktiUtama: '', jenisBukti: 'portofolio', catatanTambahan: '',
};

type Colors = ReturnType<typeof useColors>;

function pencapaianLabel(v: string): string {
  return PENCAPAIAN_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

function badgeColors(pencapaian: string, colors: Colors): { bg: string; fg: string } {
  switch (pencapaian) {
    case 'kompeten': return { bg: colors.primary, fg: '#fff' };
    case 'belum_kompeten': return { bg: colors.destructive, fg: '#fff' };
    default: return { bg: colors.border, fg: colors.foreground };
  }
}

export default function AplClaimsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['apl-claims'],
    queryFn: getMyAplClaims,
    retry: 1,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [editClaim, setEditClaim] = useState<AplClaim | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['apl-claims'] });

  const delMut = useMutation({
    mutationFn: (id: number) => deleteAplClaim(id),
    onSuccess: invalidate,
    onError: (e: unknown) => showAlert('Gagal menghapus', e instanceof Error ? e.message : 'Coba lagi.'),
  });

  const confirmDelete = (c: AplClaim) => {
    showAlert('Hapus klaim?', `${c.skkUnitCode} — ${c.skkUnitName}`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => delMut.mutate(c.id) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[st.header, { paddingTop: topPad + 8, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 4 }]}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[st.headerTitle, { color: colors.foreground }]}>Klaim Kompetensi APL 02</Text>
        <View style={{ width: 30 }} />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 + insets.bottom, gap: 12 }}>
          <Text style={[st.subtitle, { color: colors.mutedForeground }]}>
            Daftarkan unit SKK yang Anda kuasai beserta bukti dan status pencapaian
          </Text>

          <Pressable
            testID="btn-add-claim"
            onPress={() => setAddOpen(true)}
            style={({ pressed }) => [st.addBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="plus" size={18} color="#fff" />
            <Text style={st.addBtnText}>Tambah Unit</Text>
          </Pressable>

          {claims.length === 0 ? (
            <View style={[st.empty, { borderColor: colors.border }]}>
              <Feather name="award" size={36} color={colors.mutedForeground + '66'} />
              <Text style={[st.emptyText, { color: colors.mutedForeground }]}>
                Belum ada unit kompetensi yang diklaim.
              </Text>
              <Text style={[st.emptyHint, { color: colors.mutedForeground }]}>
                Tambahkan unit SKK sesuai jabatan kerja Anda.
              </Text>
            </View>
          ) : (
            claims.map((c) => {
              const badge = badgeColors(c.pencapaian, colors);
              return (
                <View key={c.id} style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={st.cardTopRow}>
                      <Text style={[st.code, { color: colors.mutedForeground }]}>{c.skkUnitCode}</Text>
                      <View style={[st.badge, { backgroundColor: badge.bg }]}>
                        <Text style={[st.badgeText, { color: badge.fg }]}>{pencapaianLabel(c.pencapaian)}</Text>
                      </View>
                    </View>
                    <Text style={[st.unitName, { color: colors.foreground }]}>{c.skkUnitName}</Text>
                    {c.buktiUtama ? (
                      <Text numberOfLines={1} style={[st.bukti, { color: colors.mutedForeground }]}>
                        Bukti: {c.buktiUtama}
                      </Text>
                    ) : null}
                  </View>
                  <View style={st.cardActions}>
                    <Pressable testID={`btn-edit-claim-${c.id}`} onPress={() => setEditClaim(c)} hitSlop={6} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 6 }]}>
                      <Feather name="edit-2" size={17} color={colors.primary} />
                    </Pressable>
                    <Pressable testID={`btn-delete-claim-${c.id}`} onPress={() => confirmDelete(c)} hitSlop={6} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 6 }]}>
                      <Feather name="trash-2" size={17} color={colors.destructive} />
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {addOpen && <AddClaimModal colors={colors} onClose={() => setAddOpen(false)} onSaved={() => { invalidate(); setAddOpen(false); }} />}
      {editClaim && <EditClaimModal colors={colors} claim={editClaim} onClose={() => setEditClaim(null)} onSaved={() => { invalidate(); setEditClaim(null); }} />}
    </View>
  );
}

// ─── Add modal ────────────────────────────────────────────────────────────────

function AddClaimModal({ colors, onClose, onSaved }: { colors: Colors; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data: jabkerList = [] } = useQuery({ queryKey: ['jabker-list'], queryFn: listJabkers });

  const { data: skkData, isLoading: unitsLoading } = useQuery({
    queryKey: ['skk-units', form.jabker],
    queryFn: () => fetchSkkUnits(form.jabker),
    enabled: !!form.jabker,
  });
  const unitList = skkData?.units ?? [];

  const addMut = useMutation({
    mutationFn: () =>
      createAplClaim({
        jabker: form.jabker,
        skkUnitCode: form.skkUnitCode,
        skkUnitName: form.skkUnitName,
        ...(skkData?.jenjang ? { jenjang: skkData.jenjang } : {}),
        pencapaian: form.pencapaian,
        buktiUtama: form.buktiUtama.trim() || undefined,
        jenisBukti: form.jenisBukti,
        catatanTambahan: form.catatanTambahan.trim() || undefined,
      }),
    onSuccess: onSaved,
    onError: (e: unknown) => showAlert('Gagal', e instanceof Error ? e.message : 'Coba lagi.'),
  });

  return (
    <ClaimModal title="Tambah Klaim Kompetensi (APL 02)" colors={colors} onClose={onClose}>
      <PickerField
        label="Jabatan Kerja"
        value={form.jabker}
        options={jabkerList.map((j) => ({ value: j, label: j.replace(/_/g, ' ') }))}
        onChange={(v) => setForm((f) => ({ ...f, jabker: v, skkUnitCode: '', skkUnitName: '' }))}
        placeholder="Pilih jabker…"
        colors={colors}
      />
      {form.jabker ? (
        unitsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />
        ) : unitList.length > 0 ? (
          <PickerField
            label="Unit Kompetensi (SKK)"
            value={form.skkUnitCode}
            options={unitList.map((u) => ({ value: u.code, label: `${u.code} — ${u.name}` }))}
            onChange={(v) => {
              const u = unitList.find((x) => x.code === v);
              setForm((f) => ({ ...f, skkUnitCode: v, skkUnitName: u?.name ?? '' }));
            }}
            placeholder="Pilih unit…"
            colors={colors}
          />
        ) : (
          <Text style={[st.emptyHint, { color: colors.mutedForeground }]}>
            Tidak ada unit SKK terdaftar untuk jabker ini.
          </Text>
        )
      ) : null}
      <ChipRow
        label="Status Pencapaian"
        value={form.pencapaian}
        options={PENCAPAIAN_OPTIONS}
        onChange={(v) => setForm((f) => ({ ...f, pencapaian: v }))}
        colors={colors}
      />
      <ChipRow
        label="Jenis Bukti Utama"
        value={form.jenisBukti}
        options={BUKTI_TYPES.map((t) => ({ value: t, label: t }))}
        onChange={(v) => setForm((f) => ({ ...f, jenisBukti: v }))}
        colors={colors}
      />
      <ModalField
        label="Deskripsi Bukti Utama"
        value={form.buktiUtama}
        onChange={(v) => setForm((f) => ({ ...f, buktiUtama: v }))}
        placeholder="Contoh: Laporan proyek pembangunan Gedung X tahun 2023…"
        multiline
        colors={colors}
      />
      <ModalField
        label="Catatan Tambahan"
        value={form.catatanTambahan}
        onChange={(v) => setForm((f) => ({ ...f, catatanTambahan: v }))}
        placeholder="(opsional)"
        colors={colors}
      />
      <ModalActions
        colors={colors}
        onCancel={onClose}
        onSubmit={() => addMut.mutate()}
        submitLabel={addMut.isPending ? 'Menyimpan…' : 'Tambahkan'}
        disabled={!form.skkUnitCode || addMut.isPending}
      />
    </ClaimModal>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditClaimModal({ colors, claim, onClose, onSaved }: {
  colors: Colors; claim: AplClaim; onClose: () => void; onSaved: () => void;
}) {
  const [pencapaian, setPencapaian] = useState(claim.pencapaian);
  const [buktiUtama, setBuktiUtama] = useState(claim.buktiUtama ?? '');
  const [catatan, setCatatan] = useState(claim.catatanTambahan ?? '');

  const updateMut = useMutation({
    mutationFn: () =>
      updateAplClaim(claim.id, { pencapaian, buktiUtama, catatanTambahan: catatan }),
    onSuccess: onSaved,
    onError: (e: unknown) => showAlert('Gagal', e instanceof Error ? e.message : 'Coba lagi.'),
  });

  return (
    <ClaimModal title={`Edit Klaim — ${claim.skkUnitName}`} colors={colors} onClose={onClose}>
      <ChipRow label="Status Pencapaian" value={pencapaian} options={PENCAPAIAN_OPTIONS} onChange={setPencapaian} colors={colors} />
      <ModalField label="Deskripsi Bukti" value={buktiUtama} onChange={setBuktiUtama} multiline colors={colors} />
      <ModalField label="Catatan" value={catatan} onChange={setCatatan} colors={colors} />
      <ModalActions
        colors={colors}
        onCancel={onClose}
        onSubmit={() => updateMut.mutate()}
        submitLabel={updateMut.isPending ? 'Menyimpan…' : 'Simpan'}
        disabled={updateMut.isPending}
      />
    </ClaimModal>
  );
}

// ─── Modal building blocks ────────────────────────────────────────────────────

function ClaimModal({ title, colors, onClose, children }: {
  title: string; colors: Colors; onClose: () => void; children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={st.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[st.modalSheet, { backgroundColor: colors.background, paddingBottom: 20 + insets.bottom }]}>
          <Text style={[st.modalTitle, { color: colors.foreground }]}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ModalActions({ colors, onCancel, onSubmit, submitLabel, disabled }: {
  colors: Colors; onCancel: () => void; onSubmit: () => void; submitLabel: string; disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
      <Pressable onPress={onCancel} style={({ pressed }) => [st.modalBtn, { borderColor: colors.border, borderWidth: 1, opacity: pressed ? 0.6 : 1 }]}>
        <Text style={[st.modalBtnText, { color: colors.foreground }]}>Batal</Text>
      </Pressable>
      <Pressable
        testID="btn-submit-claim"
        onPress={onSubmit}
        disabled={disabled}
        style={({ pressed }) => [st.modalBtn, { backgroundColor: colors.primary, opacity: disabled || pressed ? 0.6 : 1 }]}
      >
        <Text style={[st.modalBtnText, { color: '#fff' }]}>{submitLabel}</Text>
      </Pressable>
    </View>
  );
}

function ModalField({ label, value, onChange, colors, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void; colors: Colors;
  placeholder?: string; multiline?: boolean;
}) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={[st.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground + '88'}
        multiline={multiline}
        style={[
          st.input,
          multiline && { minHeight: 72, textAlignVertical: 'top' },
          { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
        ]}
      />
    </View>
  );
}

function ChipRow({ label, value, options, onChange, colors }: {
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void; colors: Colors;
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
              onPress={() => onChange(o.value)}
              style={[st.chip, {
                backgroundColor: selected ? colors.primary : colors.card,
                borderColor: selected ? colors.primary : colors.border,
              }]}
            >
              <Text style={[st.chipText, { color: selected ? '#fff' : colors.foreground }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Scrollable option list picker (jabker / SKK unit) — options can be long, so
 * a chip row doesn't fit; renders selectable rows inside a bounded box.
 */
function PickerField({ label, value, options, onChange, placeholder, colors }: {
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void; placeholder: string; colors: Colors;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ gap: 5 }}>
      <Text style={[st.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={[st.input, st.pickerTrigger, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Text
          numberOfLines={1}
          style={{ flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: selected ? colors.foreground : colors.mutedForeground + '88' }}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </Pressable>
      {open && (
        <View style={[st.pickerList, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {options.map((o) => {
              const isSel = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => { onChange(o.value); setOpen(false); }}
                  style={({ pressed }) => [st.pickerItem, { backgroundColor: pressed || isSel ? colors.primary + '18' : 'transparent' }]}
                >
                  <Text style={{ fontSize: 13, fontFamily: isSel ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_400Regular', color: colors.foreground }}>
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
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
  subtitle: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addBtnText: { color: '#fff', fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  emptyText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium' },
  emptyHint: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  code: { fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold' },
  unitName: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 4 },
  bukti: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'flex-start' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '88%',
  },
  modalTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 14 },
  modalBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalBtnText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
  label: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  pickerTrigger: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickerList: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  pickerItem: { paddingHorizontal: 12, paddingVertical: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },
});
