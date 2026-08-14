import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, TextInput,
  Modal, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  FlatList, RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  listProjectBrain,
  createProjectBrainEntry,
  updateProjectBrainEntry,
  deleteProjectBrainEntry,
  type ProjectBrainEntry,
} from '@/lib/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const KINDS = [
  { value: 'project',     label: 'Proyek',        emoji: '📁' },
  { value: 'role',        label: 'Peran/Jabatan',  emoji: '🏢' },
  { value: 'achievement', label: 'Pencapaian',     emoji: '🏆' },
  { value: 'skill',       label: 'Keahlian',       emoji: '🔧' },
  { value: 'profile',     label: 'Profil',         emoji: '👤' },
] as const;

type Kind = (typeof KINDS)[number]['value'];

interface FormState {
  kind: Kind;
  title: string;
  organization: string;
  role: string;
  period: string;
  location: string;
  description: string;
  highlights: string;
}

const EMPTY: FormState = {
  kind: 'project', title: '', organization: '', role: '',
  period: '', location: '', description: '', highlights: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function kindMeta(kind: string) {
  return KINDS.find((k) => k.value === kind) ?? KINDS[0];
}

// ─── Entry card ───────────────────────────────────────────────────────────────

function EntryCard({
  entry, colors, onEdit, onDelete,
}: {
  entry: ProjectBrainEntry;
  colors: ReturnType<typeof useColors>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = kindMeta(entry.kind);
  return (
    <View style={[card.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={card.top}>
        <Text style={card.emoji}>{meta.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[card.title, { color: colors.foreground }]} numberOfLines={2}>
            {entry.title}
          </Text>
          <Text style={[card.sub, { color: colors.mutedForeground }]}>
            {meta.label}{entry.organization ? ` · ${entry.organization}` : ''}{entry.period ? ` · ${entry.period}` : ''}
          </Text>
        </View>
        <View style={card.actions}>
          <Pressable onPress={onEdit} style={({ pressed }) => [card.btn, { opacity: pressed ? 0.5 : 1 }]}>
            <Feather name="edit-2" size={15} color={colors.primary} />
          </Pressable>
          <Pressable onPress={onDelete} style={({ pressed }) => [card.btn, { opacity: pressed ? 0.5 : 1 }]}>
            <Feather name="trash-2" size={15} color={colors.destructive} />
          </Pressable>
        </View>
      </View>
      {!!entry.description && (
        <Text style={[card.desc, { color: colors.mutedForeground }]} numberOfLines={3}>
          {entry.description}
        </Text>
      )}
    </View>
  );
}

const card = StyleSheet.create({
  wrap: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8, marginBottom: 12 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  emoji: { fontSize: 22, lineHeight: 28 },
  title: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', lineHeight: 20 },
  sub: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 6 },
  btn: { padding: 6 },
  desc: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 19 },
});

// ─── Form modal ───────────────────────────────────────────────────────────────

const DRAFT_KEY = 'GUSTAFTA_PB_DRAFT_v1';

function FormModal({
  visible, initial, colors, onClose, onSave, saving,
}: {
  visible: boolean;
  initial: FormState;
  colors: ReturnType<typeof useColors>;
  onClose: () => void;
  onSave: (form: FormState) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const isNew = !initial.title && !initial.description;
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On open: load draft for new entries, reset to initial for edits
  useEffect(() => {
    if (!visible) return;
    if (isNew) {
      AsyncStorage.getItem(DRAFT_KEY).then((raw) => {
        if (raw) {
          try { setForm(JSON.parse(raw)); } catch {}
        } else {
          setForm(EMPTY);
        }
      });
    } else {
      setForm(initial);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Auto-save draft (debounced 600ms) for new entries only
  const setWithDraft = (k: keyof FormState) => (v: string) => {
    setForm((p) => {
      const next = { ...p, [k]: v };
      if (isNew) {
        if (draftTimer.current) clearTimeout(draftTimer.current);
        draftTimer.current = setTimeout(() => {
          AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(next)).catch(() => {});
        }, 600);
      }
      return next;
    });
  };

  function handleSave() {
    AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
    onSave(form);
  }

  function isDirty() {
    const keys = Object.keys(form) as (keyof FormState)[];
    return keys.some((k) => form[k] !== initial[k]);
  }

  function discardAndClose() {
    if (isNew) {
      if (draftTimer.current) clearTimeout(draftTimer.current);
      AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
      setForm(EMPTY);
    }
    onClose();
  }

  function handleClose() {
    if (isDirty()) {
      Alert.alert(
        'Perubahan belum disimpan',
        'Keluar?',
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Keluar', style: 'destructive', onPress: discardAndClose },
        ],
      );
    } else {
      onClose();
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[fm.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={handleClose} style={{ padding: 4 }}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </Pressable>
          <Text style={[fm.headerTitle, { color: colors.foreground }]}>
            {isNew ? 'Entri Baru' : 'Edit Entri'}
          </Text>
          <Pressable
            onPress={handleSave}
            disabled={saving || !form.title.trim() || !form.description.trim()}
            style={({ pressed }) => [
              fm.saveBtn,
              { backgroundColor: colors.primary, opacity: saving || !form.title.trim() || !form.description.trim() ? 0.5 : pressed ? 0.8 : 1 },
            ]}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={fm.saveBtnText}>Simpan</Text>}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={fm.body} keyboardShouldPersistTaps="handled">
          {/* Kind selector */}
          <Text style={[fm.label, { color: colors.mutedForeground }]}>Jenis</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {KINDS.map((k) => (
                <Pressable
                  key={k.value}
                  onPress={() => setWithDraft('kind')(k.value)}
                  style={[
                    fm.kindChip,
                    {
                      backgroundColor: form.kind === k.value ? colors.primary : colors.muted,
                      borderColor: form.kind === k.value ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 14 }}>{k.emoji}</Text>
                  <Text style={[fm.kindLabel, { color: form.kind === k.value ? '#fff' : colors.foreground }]}>
                    {k.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Field label="Judul *" value={form.title} onChange={setWithDraft('title')} placeholder="Nama proyek, jabatan, atau keahlian" colors={colors} />
          <Field label="Organisasi / Perusahaan" value={form.organization} onChange={setWithDraft('organization')} placeholder="Opsional" colors={colors} />
          <Field label="Peran / Posisi" value={form.role} onChange={setWithDraft('role')} placeholder="Opsional" colors={colors} />
          <Field label="Periode" value={form.period} onChange={setWithDraft('period')} placeholder="mis. 2021–2023" colors={colors} />
          <Field label="Lokasi" value={form.location} onChange={setWithDraft('location')} placeholder="Opsional" colors={colors} />
          <Field label="Deskripsi *" value={form.description} onChange={setWithDraft('description')} placeholder="Ceritakan secara singkat..." colors={colors} multiline />
          <Field label="Poin Unggulan" value={form.highlights} onChange={setWithDraft('highlights')} placeholder="Pencapaian utama, opsional" colors={colors} multiline />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({
  label, value, onChange, placeholder, colors, multiline,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; colors: ReturnType<typeof useColors>; multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[fm.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        style={[
          fm.input,
          multiline && { minHeight: 90, textAlignVertical: 'top' },
          { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border },
        ]}
      />
    </View>
  );
}

const fm = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  saveBtnText: { color: '#fff', fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
  body: { padding: 20 },
  label: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  kindChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  kindLabel: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ProjectBrainScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const isWeb = Platform.OS === 'web';

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<ProjectBrainEntry | null>(null);

  const {
    data: entries = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['project-brain'],
    queryFn: listProjectBrain,
  });

  const formInitial: FormState = editTarget
    ? {
        kind: (editTarget.kind as Kind) ?? 'project',
        title: editTarget.title,
        organization: editTarget.organization ?? '',
        role: editTarget.role ?? '',
        period: editTarget.period ?? '',
        location: editTarget.location ?? '',
        description: editTarget.description,
        highlights: editTarget.highlights ?? '',
      }
    : EMPTY;

  const saveMut = useMutation({
    mutationFn: async (form: FormState) => {
      if (editTarget) {
        return updateProjectBrainEntry(editTarget.id, form);
      }
      return createProjectBrainEntry(form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-brain'] });
      setShowForm(false);
      setEditTarget(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => Alert.alert('Gagal', 'Tidak dapat menyimpan entri. Coba lagi.'),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => deleteProjectBrainEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-brain'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
    onError: () => Alert.alert('Gagal', 'Tidak dapat menghapus entri.'),
  });

  function confirmDelete(entry: ProjectBrainEntry) {
    Alert.alert(
      'Hapus Entri',
      `"${entry.title}" akan dihapus permanen.`,
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Hapus', style: 'destructive', onPress: () => delMut.mutate(entry.id) },
      ],
    );
  }

  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 + 84 : 84 + insets.bottom;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[sc.header, { paddingTop: topPad + 8, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <Feather name="arrow-left" size={20} color={colors.mutedForeground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[sc.title, { color: colors.foreground }]}>Project Brain</Text>
          <Text style={[sc.sub, { color: colors.mutedForeground }]}>
            Pengalaman & profil yang dibaca AI
          </Text>
        </View>
        <Pressable
          onPress={() => { setEditTarget(null); setShowForm(true); }}
          style={({ pressed }) => [sc.addBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
        >
          <Feather name="plus" size={18} color="#fff" />
        </Pressable>
      </View>

      {/* List */}
      <FlatList
        data={entries}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item: entry }) => (
          <EntryCard
            entry={entry}
            colors={colors}
            onEdit={() => { setEditTarget(entry); setShowForm(true); }}
            onDelete={() => confirmDelete(entry)}
          />
        )}
        ListHeaderComponent={
          entries.length > 0 ? (
            <View style={[sc.countBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="database" size={14} color={colors.primary} />
              <Text style={[sc.countText, { color: colors.mutedForeground }]}>
                {entries.length} entri tersimpan
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 48 }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : isError ? (
            <View style={sc.emptyState}>
              <Feather name="alert-circle" size={36} color={colors.destructive} />
              <Text style={[sc.emptyTitle, { color: colors.destructive }]}>
                Gagal memuat entri
              </Text>
              <Pressable onPress={() => refetch()} style={[sc.retryBtn, { borderColor: colors.border }]}>
                <Text style={[sc.retryText, { color: colors.foreground }]}>Coba lagi</Text>
              </Pressable>
            </View>
          ) : (
            <View style={sc.emptyState}>
              <Text style={{ fontSize: 40 }}>🧠</Text>
              <Text style={[sc.emptyTitle, { color: colors.foreground, textAlign: 'center' }]}>
                Belum ada entri
              </Text>
              <Text style={[sc.sub, { color: colors.mutedForeground, textAlign: 'center' }]}>
                Tambahkan pengalaman, proyek, atau keahlian Anda agar AI bisa memberikan saran yang lebih relevan.
              </Text>
              <Pressable
                onPress={() => { setEditTarget(null); setShowForm(true); }}
                style={({ pressed }) => [sc.addBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1, paddingHorizontal: 20 }]}
              >
                <Feather name="plus" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14 }}>Tambah Entri</Text>
              </Pressable>
            </View>
          )
        }
      />

      {/* Form modal */}
      <FormModal
        visible={showForm}
        initial={formInitial}
        colors={colors}
        onClose={() => { setShowForm(false); setEditTarget(null); }}
        onSave={(form) => saveMut.mutate(form)}
        saving={saveMut.isPending}
      />
    </View>
  );
}

const sc = StyleSheet.create({
  header: {
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  title: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold' },
  sub: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 1 },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  countBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  countText: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular' },
  emptyState: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginTop: 8,
  },
  retryBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  retryText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium' },
});
