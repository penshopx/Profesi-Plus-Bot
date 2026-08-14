/**
 * Dokumentasi Kegiatan PKB — Mobile
 *
 * Halaman untuk mencatat dan mengelola kegiatan PKB dari perangkat mobile.
 * Mendukung 11 field standar BNSP/LPJK termasuk upload dokumen dari galeri/kamera.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, TextInput, Alert,
  Modal, ActivityIndicator, FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import {
  listMyKegiatanPkb, createKegiatanPkb, updateKegiatanPkb, deleteKegiatanPkb,
  updateKegiatanSkk, ajukanKegiatanPkb, getKegiatanDetail,
  requestUploadUrl, registerKegiatanDoc, deleteKegiatanDoc, getDocDownloadUrl,
  abortUpload, ApiError,
  type PkbActivity, type CreateKegiatanBody, type PkbSkkUnit,
  type PkbActivityDoc, type PkbJourneyEntry,
} from '@/lib/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const JENIS_PKB = ['Seminar', 'Webinar', 'Diklatkerja', 'Workshop', 'Kursus Online', 'Pelatihan Mandiri', 'Lainnya'];
const MODE_OPTIONS = ['Online', 'Offline', 'Hybrid'];

const STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  draft:        { label: 'Draft',           bg: '#F3F4F6', text: '#6B7280' },
  lengkap:      { label: 'Lengkap',         bg: '#ECFDF5', text: '#059669' },
  diajukan:     { label: 'Diajukan',        bg: '#EFF6FF', text: '#2563EB' },
  diverifikasi: { label: 'Terverifikasi',   bg: '#EDE9FE', text: '#7C3AED' },
  ditolak:      { label: 'Perlu Perbaikan', bg: '#FEF2F2', text: '#DC2626' },
};

const DOC_TYPES: { key: string; label: string; icon: string }[] = [
  { key: 'surat_undangan', label: 'Surat Undangan', icon: 'file-text' },
  { key: 'daftar_hadir',   label: 'Daftar Hadir',   icon: 'users' },
  { key: 'foto',           label: 'Foto Dokumentasi', icon: 'camera' },
  { key: 'lainnya',        label: 'Dokumen Lain',    icon: 'paperclip' },
];

const JOURNEY_COLORS: Record<string, string> = {
  kegiatan_dibuat:   '#3B82F6',
  info_diperbarui:   '#6B7280',
  skk_dipetakan:     '#8B5CF6',
  diajukan:          '#D97706',
  diverifikasi:      '#059669',
  ditolak:           '#DC2626',
  siap_diajukan:     '#059669',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return d; }
}

function fmtDateTime(d: string) {
  try {
    return new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

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

function DateInput({ value, onChange, placeholder, colors }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={(t) => {
        const digits = t.replace(/\D/g, '').slice(0, 8);
        let formatted = digits;
        if (digits.length > 4) formatted = `${digits.slice(0, 4)}-${digits.slice(4)}`;
        if (digits.length > 6) formatted = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
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

function FieldLabel({ children, colors }: { children: string; colors: ReturnType<typeof useColors> }) {
  return <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{children}</Text>;
}

function TextAreaInput({ value, onChange, placeholder, colors, rows = 3 }: {
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

function ChipSelector({ options, value, onChange, colors }: {
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
            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: selected ? '#fff' : colors.foreground }}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── SKK Manager ──────────────────────────────────────────────────────────────

function SkkManager({ skk, onUpdate, activityId, colors }: {
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
    if (!skkCode.trim() || !skkName.trim()) { Alert.alert('Isi kode dan nama unit SKK'); return; }
    const newSkk = [...skk, { skkCode: skkCode.trim(), skkName: skkName.trim(), jabkerName: jabkerName.trim() || undefined }];
    updateMut.mutate(newSkk);
    setSkkCode(''); setSkkName(''); setJabkerName('');
    setShowAdd(false);
  }

  function removeUnit(i: number) {
    updateMut.mutate(skk.filter((_, idx) => idx !== i));
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
          <TextInput value={skkCode} onChangeText={setSkkCode}
            placeholder="Kode SKK — mis. F.45.2.0.0.0.0.0.01"
            placeholderTextColor={colors.mutedForeground}
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted, marginBottom: 6 }]} />
          <TextInput value={skkName} onChangeText={setSkkName}
            placeholder="Nama unit kompetensi"
            placeholderTextColor={colors.mutedForeground}
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted, marginBottom: 6 }]} />
          <TextInput value={jabkerName} onChangeText={setJabkerName}
            placeholder="Jabatan kerja (opsional)"
            placeholderTextColor={colors.mutedForeground}
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted, marginBottom: 8 }]} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={addUnit} disabled={updateMut.isPending}
              style={({ pressed }) => [s.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1, flex: 1 }]}>
              {updateMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnText}>Tambah</Text>}
            </Pressable>
            <Pressable onPress={() => setShowAdd(false)}
              style={({ pressed }) => [s.btn, { backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
              <Text style={[s.btnText, { color: colors.foreground }]}>Batal</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setShowAdd(true)}
          style={({ pressed }) => [s.addBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
          <Feather name="plus" size={14} color={colors.primary} />
          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.primary }}>Tambah Unit SKK</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Document upload section ──────────────────────────────────────────────────

function DocUploadSection({ activityId, activityStatus, docs, onRefresh, colors }: {
  activityId: number;
  activityStatus: string;
  docs: PkbActivityDoc[];
  onRefresh: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [uploading, setUploading] = useState<string | null>(null); // docType being uploaded
  const [deleting, setDeleting] = useState<number | null>(null);
  const [opening, setOpening] = useState<number | null>(null); // docId being opened

  /**
   * Retry an async operation up to `maxAttempts` times with exponential backoff.
   * Stops immediately on ApiError with a 4xx status — those are definitive
   * rejections (bad token, auth, not-found) that re-trying won't fix.
   * Network errors and 5xx responses are retried.
   */
  async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    baseDelayMs = 1000,
  ): Promise<T> {
    let lastErr: Error = new Error('Unknown error');
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err as Error;
        // ApiError with 4xx = permanent rejection; bail out immediately.
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
          throw err;
        }
        if (attempt < maxAttempts) {
          await new Promise<void>((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)));
        }
      }
    }
    throw lastErr;
  }

  /**
   * Core upload helper: fetches the local URI as a blob first so we always
   * have a real byte-length before requesting the presigned URL (the server
   * rejects size=0). If the blob cannot be read or is empty, throws early.
   *
   * If the GCS upload succeeds but registration fails, we retry registration
   * up to 3 times with backoff before giving up. The server re-issues the
   * upload token on DB failure so retries are always possible.
   */
  async function uploadLocalFile(
    docType: string,
    uri: string,
    filename: string,
    mimeType: string,
  ) {
    setUploading(docType);
    try {
      // Step 1: read the file into a blob to get the real size
      const fileResponse = await fetch(uri);
      if (!fileResponse.ok) throw new Error('Gagal membaca file dari perangkat');
      const blob = await fileResponse.blob();

      if (!blob.size || blob.size === 0) {
        throw new Error('Ukuran file tidak dapat ditentukan — coba pilih file lain');
      }

      // Step 2: request presigned URL with real size
      const { uploadURL, objectPath } = await requestUploadUrl(filename, blob.size, mimeType);

      // Step 3: PUT blob to GCS via presigned URL
      const putRes = await fetch(uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: blob,
      });
      if (!putRes.ok) throw new Error('Upload ke server gagal — coba lagi');

      // Step 4: register document in database — retry with backoff so a
      // transient network drop or momentary server hiccup doesn't permanently
      // orphan the file that already landed in GCS.
      try {
        await retryWithBackoff(
          () => registerKegiatanDoc(activityId, docType, filename, objectPath, mimeType, blob.size),
          3,
          1000,
        );
      } catch {
        // Registration failed terminally after all retries.  Ask the server to
        // delete the GCS object so it doesn't remain orphaned in storage.
        let cleaned = false;
        try {
          await abortUpload(objectPath);
          cleaned = true;
        } catch {
          // Abort also failed — the file may still be in GCS.
          // A scheduled cleanup job will handle any true orphans (task #190).
        }
        throw new Error(
          cleaned
            ? 'Upload gagal didaftarkan — file sudah dibersihkan. Silakan coba unggah kembali.'
            : 'Upload gagal didaftarkan. Silakan coba unggah kembali.',
        );
      }

      onRefresh();
    } catch (err) {
      Alert.alert('Upload tidak lengkap', (err as Error).message);
    } finally {
      setUploading(null);
    }
  }

  async function pickWithImagePicker(docType: string, useCamera: boolean) {
    const permRes = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permRes.status !== 'granted') {
      Alert.alert('Izin diperlukan', useCamera
        ? 'Izin kamera diperlukan untuk mengambil foto.'
        : 'Izin galeri diperlukan untuk memilih foto/video.');
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8, allowsMultipleSelection: false });

    if (result.canceled) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
    const ext = mimeType.split('/')[1] ?? 'jpg';
    const filename = asset.fileName ?? `${docType}-${Date.now()}.${ext}`;
    await uploadLocalFile(docType, asset.uri, filename, mimeType);
  }

  async function pickWithDocumentPicker(docType: string) {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'application/octet-stream';
    const filename = asset.name ?? `${docType}-${Date.now()}`;
    await uploadLocalFile(docType, asset.uri, filename, mimeType);
  }

  async function handleOpen(doc: PkbActivityDoc) {
    setOpening(doc.id);
    try {
      const downloadURL = await getDocDownloadUrl(doc.objectPath);
      await WebBrowser.openBrowserAsync(downloadURL, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN });
    } catch (err) {
      Alert.alert('Gagal membuka dokumen', (err as Error).message);
    } finally {
      setOpening(null);
    }
  }

  async function handleDelete(docId: number) {
    Alert.alert('Hapus dokumen?', 'Dokumen ini akan dihapus permanen.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus', style: 'destructive',
        onPress: async () => {
          setDeleting(docId);
          try {
            await deleteKegiatanDoc(activityId, docId);
            onRefresh();
          } catch (err) {
            Alert.alert('Gagal menghapus', (err as Error).message);
          } finally {
            setDeleting(null);
          }
        },
      },
    ]);
  }

  function showUploadOptions(docType: string) {
    if (docType === 'foto') {
      // Photo documentation: camera or gallery (images/video)
      Alert.alert('Unggah Foto Dokumentasi', undefined, [
        { text: 'Ambil Foto (Kamera)', onPress: () => pickWithImagePicker(docType, true) },
        { text: 'Pilih dari Galeri', onPress: () => pickWithImagePicker(docType, false) },
        { text: 'Batal', style: 'cancel' },
      ]);
    } else {
      // Other doc types: PDF/image via document picker, or camera for photos
      Alert.alert('Unggah Dokumen', 'Pilih file PDF atau gambar', [
        { text: 'Pilih File (PDF/Gambar)', onPress: () => pickWithDocumentPicker(docType) },
        { text: 'Foto dengan Kamera', onPress: () => pickWithImagePicker(docType, true) },
        { text: 'Batal', style: 'cancel' },
      ]);
    }
  }

  const isVerified = activityStatus === 'diverifikasi';

  return (
    <View style={{ gap: 12 }}>
      {isVerified && (
        <View style={[s.alertBox, { backgroundColor: '#EDE9FE', borderColor: '#C4B5FD', marginBottom: 4 }]}>
          <Text style={{ fontSize: 13, color: '#6D28D9', fontFamily: 'PlusJakartaSans_500Medium' }}>
            🔒 Kegiatan ini sudah diverifikasi — bukti tidak dapat diubah
          </Text>
        </View>
      )}
      {DOC_TYPES.map((dt) => {
        const typeDocs = docs.filter((d) => d.docType === dt.key);
        const isUploading = uploading === dt.key;
        return (
          <View key={dt.key} style={[s.docCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name={dt.icon as any} size={16} color={colors.primary} />
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.foreground }}>{dt.label}</Text>
                {typeDocs.length > 0 && (
                  <View style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 99 }}>
                    <Text style={{ fontSize: 10, color: '#059669', fontFamily: 'PlusJakartaSans_600SemiBold' }}>{typeDocs.length} file</Text>
                  </View>
                )}
              </View>
              {/* Hide upload button for verified activities */}
              {!isVerified && (
                <Pressable
                  onPress={() => showUploadOptions(dt.key)}
                  disabled={isUploading}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    opacity: pressed || isUploading ? 0.6 : 1,
                  })}
                >
                  {isUploading
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <Feather name="upload" size={14} color={colors.primary} />}
                  <Text style={{ fontSize: 12, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                    {isUploading ? 'Mengunggah…' : 'Unggah'}
                  </Text>
                </Pressable>
              )}
            </View>

            {typeDocs.length === 0 ? (
              <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: 'PlusJakartaSans_400Regular', fontStyle: 'italic' }}>
                Belum ada dokumen
              </Text>
            ) : (
              <View style={{ gap: 6 }}>
                {typeDocs.map((doc) => {
                  const isImage = doc.mimeType?.startsWith('image/') ?? false;
                  const isOpening = opening === doc.id;
                  return (
                    <View key={doc.id} style={[s.docRow, { borderColor: colors.border, backgroundColor: colors.muted, flexDirection: 'column', alignItems: 'stretch', gap: 6 }]}>
                      {/* Row: icon + filename + action buttons */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Feather name={isImage ? 'image' : 'file'} size={13} color={colors.mutedForeground} />
                        <Text style={{ flex: 1, fontSize: 12, color: colors.foreground, fontFamily: 'PlusJakartaSans_400Regular' }} numberOfLines={1}>
                          {doc.filename}
                        </Text>
                        {/* Lihat / Open button */}
                        <Pressable
                          onPress={() => handleOpen(doc)}
                          disabled={isOpening}
                          hitSlop={8}
                          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 3, opacity: pressed || isOpening ? 0.6 : 1, marginLeft: 4 })}
                        >
                          {isOpening
                            ? <ActivityIndicator size="small" color={colors.primary} />
                            : <Feather name="external-link" size={13} color={colors.primary} />}
                          <Text style={{ fontSize: 11, color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                            {isOpening ? 'Membuka…' : 'Lihat'}
                          </Text>
                        </Pressable>
                        {/* Hide delete button for verified activities */}
                        {!isVerified && (
                          <Pressable
                            onPress={() => handleDelete(doc.id)}
                            disabled={deleting === doc.id}
                            hitSlop={8}
                          >
                            {deleting === doc.id
                              ? <ActivityIndicator size="small" color={colors.destructive} />
                              : <Feather name="trash-2" size={14} color={colors.destructive} />}
                          </Pressable>
                        )}
                      </View>
                      {/* Inline image thumbnail placeholder — tap opens the viewer */}
                      {isImage && (
                        <Pressable
                          onPress={() => handleOpen(doc)}
                          disabled={isOpening}
                          style={({ pressed }) => ({
                            height: 80, borderRadius: 6, backgroundColor: colors.border,
                            alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
                            opacity: pressed ? 0.7 : 1,
                          })}
                        >
                          <Feather name="image" size={20} color={colors.mutedForeground} />
                          <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: 'PlusJakartaSans_400Regular' }}>
                            Ketuk untuk melihat foto
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Journey timeline ─────────────────────────────────────────────────────────

function JourneyTimeline({ entries, colors }: { entries: PkbJourneyEntry[]; colors: ReturnType<typeof useColors> }) {
  if (!entries.length) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 32 }}>
        <Text style={{ fontSize: 13, color: colors.mutedForeground, fontFamily: 'PlusJakartaSans_400Regular' }}>
          Belum ada catatan perjalanan
        </Text>
      </View>
    );
  }

  return (
    <View style={{ paddingLeft: 24, gap: 0 }}>
      {entries.map((entry, i) => {
        const dotColor = JOURNEY_COLORS[entry.event] ?? colors.mutedForeground;
        const isLast = i === entries.length - 1;
        return (
          <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            {/* Timeline column */}
            <View style={{ alignItems: 'center', width: 20 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dotColor, marginTop: 4 }} />
              {!isLast && <View style={{ width: 2, flex: 1, minHeight: 24, backgroundColor: colors.border }} />}
            </View>
            {/* Content */}
            <View style={{ flex: 1, paddingBottom: isLast ? 0 : 16 }}>
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.foreground, lineHeight: 20 }}>
                {entry.label}
              </Text>
              <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 }}>
                {fmtDateTime(entry.createdAt)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Activity form modal ───────────────────────────────────────────────────────

type FormData = Partial<CreateKegiatanBody> & { namaKegiatan: string; tanggalMulai: string };

interface MarketplacePrefill {
  marketplaceId: string;
  courseTitle: string;
  courseProvider: string;
  courseJabkerList: string[];
  courseSkkTagsList: string[];
}

function buildInitialForm(initial?: PkbActivity | null, prefill?: MarketplacePrefill | null): FormData {
  return initial
    ? {
        namaKegiatan: initial.namaKegiatan, tanggalMulai: initial.tanggalMulai,
        tanggalSelesai: initial.tanggalSelesai ?? '', tempatKegiatan: initial.tempatKegiatan ?? '',
        modePelaksanaan: initial.modePelaksanaan ?? '', namaMateri: initial.namaMateri ?? '',
        penyelenggara: initial.penyelenggara ?? '', namaInstruktur: initial.namaInstruktur ?? '',
        uraianSingkat: initial.uraianSingkat ?? '', linkRekaman: initial.linkRekaman ?? '',
        jenisPkb: initial.jenisPkb ?? '', jpPkb: initial.jpPkb ?? undefined,
      }
    : {
        namaKegiatan: prefill?.courseTitle ?? '',
        namaMateri: prefill?.courseTitle ?? '',
        penyelenggara: prefill?.courseProvider ?? '',
        jenisPkb: prefill ? 'Kursus Online' : '',
        tanggalMulai: '',
      };
}

function ActivityFormModal({ visible, initial, prefill, onClose, onSaved, colors }: {
  visible: boolean; initial?: PkbActivity | null; prefill?: MarketplacePrefill | null;
  onClose: () => void; onSaved: (act: PkbActivity) => void; colors: ReturnType<typeof useColors>;
}) {
  const [form, setForm] = useState<FormData>(() => buildInitialForm(initial, prefill));

  // Track what the form looked like when it was first opened so we can detect
  // unsaved changes without comparing to server data.
  const initialFormRef = useRef<FormData>(form);

  // Recompute form and baseline whenever the modal (re)opens with new data.
  useEffect(() => {
    if (visible) {
      const fresh = buildInitialForm(initial, prefill);
      setForm(fresh);
      initialFormRef.current = fresh;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /** True when the user has modified at least one field compared to the baseline. */
  function hasUnsavedChanges(): boolean {
    const base = initialFormRef.current;
    const keys: (keyof FormData)[] = [
      'namaKegiatan', 'tanggalMulai', 'tanggalSelesai', 'tempatKegiatan',
      'modePelaksanaan', 'namaMateri', 'penyelenggara', 'namaInstruktur',
      'uraianSingkat', 'linkRekaman', 'jenisPkb', 'jpPkb',
    ];
    return keys.some((k) => (form[k] ?? '') !== (base[k] ?? ''));
  }

  /**
   * Attempt to close the modal. If the user has unsaved changes, show a
   * confirmation alert first so they can cancel the close.
   */
  function confirmClose() {
    if (!hasUnsavedChanges()) {
      onClose();
      return;
    }
    Alert.alert(
      'Buang perubahan?',
      'Perubahan yang belum disimpan akan hilang.',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Buang', style: 'destructive', onPress: onClose },
      ],
    );
  }

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
      ...(prefill && !initial ? {
        marketplaceId: prefill.marketplaceId,
        courseTitle: prefill.courseTitle,
        courseProvider: prefill.courseProvider,
        courseJabkerList: prefill.courseJabkerList,
        courseSkkTagsList: prefill.courseSkkTagsList,
      } : {}),
    };
    if (initial) { updateMut.mutate(body); }
    else { createMut.mutate(body); }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={confirmClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
          <Pressable onPress={confirmClose} hitSlop={8}>
            <Text style={{ fontSize: 15, color: colors.mutedForeground, fontFamily: 'PlusJakartaSans_400Regular' }}>Batal</Text>
          </Pressable>
          <Text style={[s.modalTitle, { color: colors.foreground }]}>{initial ? 'Edit Kegiatan' : 'Kegiatan Baru'}</Text>
          <Pressable onPress={handleSave} disabled={isPending} hitSlop={8}>
            {isPending
              ? <ActivityIndicator color={colors.primary} size="small" />
              : <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary }}>Simpan</Text>}
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
          {error && (
            <View style={[s.alertBox, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
              <Text style={{ color: '#DC2626', fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular' }}>{error.message}</Text>
            </View>
          )}

          <FieldLabel colors={colors}>Nama Kegiatan *</FieldLabel>
          <TextInput value={form.namaKegiatan} onChangeText={f('namaKegiatan')}
            placeholder="Webinar K3 Konstruksi 2025"
            placeholderTextColor={colors.mutedForeground}
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]} />

          <FieldLabel colors={colors}>Tanggal Mulai * (YYYY-MM-DD)</FieldLabel>
          <DateInput value={form.tanggalMulai ?? ''} onChange={f('tanggalMulai')} placeholder="2025-06-15" colors={colors} />

          <FieldLabel colors={colors}>Tanggal Selesai (biarkan kosong jika 1 hari)</FieldLabel>
          <DateInput value={form.tanggalSelesai ?? ''} onChange={f('tanggalSelesai')} placeholder="2025-06-16" colors={colors} />

          <FieldLabel colors={colors}>Tempat Kegiatan</FieldLabel>
          <TextInput value={form.tempatKegiatan ?? ''} onChangeText={f('tempatKegiatan')}
            placeholder="Zoom / Hotel Grand Hyatt Jakarta"
            placeholderTextColor={colors.mutedForeground}
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]} />

          <FieldLabel colors={colors}>Mode Pelaksanaan</FieldLabel>
          <ChipSelector options={MODE_OPTIONS} value={form.modePelaksanaan ?? ''} onChange={f('modePelaksanaan')} colors={colors} />

          <FieldLabel colors={colors}>Jenis PKB</FieldLabel>
          <ChipSelector options={JENIS_PKB} value={form.jenisPkb ?? ''} onChange={f('jenisPkb')} colors={colors} />

          <FieldLabel colors={colors}>Nama Materi / Modul</FieldLabel>
          <TextInput value={form.namaMateri ?? ''} onChangeText={f('namaMateri')}
            placeholder="Manajemen Keselamatan Kerja Konstruksi"
            placeholderTextColor={colors.mutedForeground}
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]} />

          <FieldLabel colors={colors}>Penyelenggara</FieldLabel>
          <TextInput value={form.penyelenggara ?? ''} onChangeText={f('penyelenggara')}
            placeholder="PT Bangun Konstruksi Indonesia"
            placeholderTextColor={colors.mutedForeground}
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]} />

          <FieldLabel colors={colors}>Instruktur / Narasumber</FieldLabel>
          <TextInput value={form.namaInstruktur ?? ''} onChangeText={f('namaInstruktur')}
            placeholder="Ir. Budi Santoso, MT"
            placeholderTextColor={colors.mutedForeground}
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]} />

          <FieldLabel colors={colors}>Jam Pelajaran (JP)</FieldLabel>
          <TextInput
            value={form.jpPkb != null ? String(form.jpPkb) : ''}
            onChangeText={(v) => setForm((prev) => ({ ...prev, jpPkb: v ? Number(v) : undefined }))}
            placeholder="8"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]} />

          <FieldLabel colors={colors}>Uraian Singkat Kegiatan</FieldLabel>
          <TextAreaInput value={form.uraianSingkat ?? ''} onChange={f('uraianSingkat')}
            placeholder="Uraikan singkat isi dan manfaat kegiatan ini…"
            colors={colors} rows={4} />

          <FieldLabel colors={colors}>Link Rekaman / Video</FieldLabel>
          <TextInput value={form.linkRekaman ?? ''} onChangeText={f('linkRekaman')}
            placeholder="https://youtube.com/..."
            placeholderTextColor={colors.mutedForeground}
            keyboardType="url"
            autoCapitalize="none"
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Activity card ─────────────────────────────────────────────────────────────

function ActivityCard({ activity, onPress, colors }: {
  activity: PkbActivity; onPress: () => void; colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <Text style={[s.cardTitle, { color: colors.foreground, flex: 1 }]} numberOfLines={2}>{activity.namaKegiatan}</Text>
        <StatusBadge status={activity.status} colors={colors} />
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
        <Text style={[s.cardMeta, { color: colors.mutedForeground }]}>
          <Feather name="calendar" size={11} /> {activity.tanggalMulai}
        </Text>
        {activity.jenisPkb && <Text style={[s.cardMeta, { color: colors.mutedForeground }]}>{activity.jenisPkb}</Text>}
        {activity.skk && activity.skk.length > 0 && (
          <Text style={[s.cardMeta, { color: '#6366F1' }]}>{activity.skk.length} SKK</Text>
        )}
        {(activity.docCount ?? 0) > 0 && (
          <Text style={[s.cardMeta, { color: '#059669' }]}>{activity.docCount} dok</Text>
        )}
      </View>
      {activity.status === 'ditolak' && activity.askomNote && (
        <Text style={[s.cardMeta, { color: '#DC2626', marginTop: 4 }]} numberOfLines={2}>⚠ {activity.askomNote}</Text>
      )}
    </Pressable>
  );
}

// ─── InfoItem ─────────────────────────────────────────────────────────────────

function InfoItem({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: 'PlusJakartaSans_500Medium', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontSize: 14, color: colors.foreground, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 }}>{value}</Text>
    </View>
  );
}

// ─── Activity detail screen (modal) ──────────────────────────────────────────

type DetailTab = 'info' | 'dokumen' | 'journey';

function ActivityDetail({ activity, onClose, onEdited, colors }: {
  activity: PkbActivity;
  onClose: () => void;
  onEdited: (act: PkbActivity) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>('info');
  const [skk, setSkk] = useState<PkbSkkUnit[]>(activity.skk ?? []);
  const [showEdit, setShowEdit] = useState(false);
  const qc = useQueryClient();

  // Auto-mapping runs fire-and-forget on the server after create/update, so
  // SKK results land in the DB a few seconds after the API responds. Poll the
  // detail endpoint for ~30s while the SKK list is still empty so the mapped
  // units appear without a manual refresh.
  const SKK_POLL_WINDOW_MS = 30_000;
  const SKK_POLL_INTERVAL_MS = 3_000;
  const skkPollStartRef = useRef(Date.now());
  const { data: detail, isLoading: loadingDetail, refetch: refetchDetail } = useQuery({
    queryKey: ['kegiatan-detail', activity.id],
    queryFn: () => getKegiatanDetail(activity.id),
    staleTime: 15 * 1000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return SKK_POLL_INTERVAL_MS; // still loading — keep the window alive
      if ((data.skk ?? []).length > 0) return false;
      if (['diajukan', 'diverifikasi'].includes(data.status)) return false;
      if (Date.now() - skkPollStartRef.current > SKK_POLL_WINDOW_MS) return false;
      return SKK_POLL_INTERVAL_MS;
    },
  });

  // Restart the polling window whenever the activity is edited (updatedAt
  // changes) — an edit may retrigger auto-mapping on the server.
  useEffect(() => {
    skkPollStartRef.current = Date.now();
  }, [detail?.updatedAt]);

  // When the detail query returns auto-mapped SKK and the local list is still
  // empty, adopt the server result and refresh the activity list badge.
  const detailSkk = detail?.skk;
  useEffect(() => {
    if (detailSkk && detailSkk.length > 0) {
      setSkk((prev) => (prev.length === 0 ? detailSkk : prev));
      qc.invalidateQueries({ queryKey: ['kegiatan'] });
    }
  }, [detailSkk, qc]);

  const docs = detail?.docs ?? [];
  const journey = detail?.journey ?? [];

  const deleteMut = useMutation({
    mutationFn: () => deleteKegiatanPkb(activity.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kegiatan'] }); onClose(); },
  });

  const [submitting, setSubmitting] = useState(false);
  const canEdit = activity.status !== 'diverifikasi';
  const canSubmit = activity.status === 'lengkap' || activity.status === 'ditolak';

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await ajukanKegiatanPkb(activity.id);
      qc.invalidateQueries({ queryKey: ['kegiatan'] });
      Alert.alert('Berhasil', activity.status === 'ditolak'
        ? 'Dokumentasi diajukan ulang untuk verifikasi.'
        : 'Dokumentasi berhasil diajukan untuk verifikasi.');
      onClose();
    } catch (err) {
      Alert.alert('Gagal', (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const tabs: { key: DetailTab; label: string }[] = [
    { key: 'info', label: 'Info' },
    { key: 'dokumen', label: `Dokumen${docs.length > 0 ? ` (${docs.length})` : ''}` },
    { key: 'journey', label: 'Perjalanan' },
  ];

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
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

        {/* Title */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.foreground, lineHeight: 22 }}>
            {activity.namaKegiatan}
          </Text>
          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 4, fontFamily: 'PlusJakartaSans_400Regular' }}>
            {activity.tanggalMulai}
            {activity.tanggalSelesai && activity.tanggalSelesai !== activity.tanggalMulai ? ` s/d ${activity.tanggalSelesai}` : ''}
            {activity.tempatKegiatan ? ` · ${activity.tempatKegiatan}` : ''}
            {activity.modePelaksanaan ? ` (${activity.modePelaksanaan})` : ''}
          </Text>
        </View>

        {/* Tab bar */}
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{
                flex: 1, paddingVertical: 10, alignItems: 'center',
                borderBottomWidth: 2,
                borderBottomColor: activeTab === tab.key ? colors.primary : 'transparent',
              }}
            >
              <Text style={{
                fontSize: 13, fontFamily: activeTab === tab.key ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_400Regular',
                color: activeTab === tab.key ? colors.primary : colors.mutedForeground,
              }}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Tab content */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          {/* ── Info tab ── */}
          {activeTab === 'info' && (
            <>
              {activity.status === 'ditolak' && activity.askomNote && (
                <View style={[s.alertBox, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', marginBottom: 16 }]}>
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#DC2626', marginBottom: 4 }}>
                    Catatan Verifikasi — Perbaiki lalu hubungi Asosiasi
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', color: '#B91C1C' }}>
                    {activity.askomNote}
                  </Text>
                </View>
              )}
              {activity.status === 'diverifikasi' && activity.askomNote && (
                <View style={[s.alertBox, { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7', marginBottom: 16 }]}>
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#059669', marginBottom: 4 }}>Catatan Verifikasi</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', color: '#065F46' }}>{activity.askomNote}</Text>
                </View>
              )}

              {activity.namaMateri && <InfoItem label="Materi / Modul" value={activity.namaMateri} colors={colors} />}
              {activity.jenisPkb && <InfoItem label="Jenis PKB" value={`${activity.jenisPkb}${activity.jpPkb ? ` · ${activity.jpPkb} JP` : ''}`} colors={colors} />}
              {activity.penyelenggara && <InfoItem label="Penyelenggara" value={activity.penyelenggara} colors={colors} />}
              {activity.namaInstruktur && <InfoItem label="Instruktur" value={activity.namaInstruktur} colors={colors} />}
              {activity.uraianSingkat && <InfoItem label="Uraian Singkat" value={activity.uraianSingkat} colors={colors} />}
              {activity.linkRekaman && <InfoItem label="Rekaman" value={activity.linkRekaman} colors={colors} />}

              <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>
                Mapping SKK (Field 5) — {skk.length} unit
              </Text>
              <SkkManager skk={skk} onUpdate={setSkk} activityId={activity.id} colors={colors} />

              {/* Actions */}
              <View style={{ gap: 10, marginTop: 24 }}>
                {canSubmit && (
                  <Pressable
                    onPress={handleSubmit}
                    disabled={submitting}
                    style={({ pressed }) => [s.btn, {
                      backgroundColor: activity.status === 'ditolak' ? '#D97706' : '#059669',
                      opacity: pressed || submitting ? 0.7 : 1, justifyContent: 'center',
                    }]}
                  >
                    {submitting
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={s.btnText}>
                          {activity.status === 'ditolak' ? '🔄 Ajukan Ulang untuk Verifikasi' : '✅ Ajukan untuk Verifikasi'}
                        </Text>}
                  </Pressable>
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
            </>
          )}

          {/* ── Dokumen tab ── */}
          {activeTab === 'dokumen' && (
            <>
              {loadingDetail ? (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={{ marginTop: 12, fontSize: 13, color: colors.mutedForeground }}>Memuat dokumen…</Text>
                </View>
              ) : (
                <DocUploadSection
                  activityId={activity.id}
                  activityStatus={activity.status}
                  docs={docs}
                  onRefresh={() => refetchDetail()}
                  colors={colors}
                />
              )}
            </>
          )}

          {/* ── Journey tab ── */}
          {activeTab === 'journey' && (
            <>
              {loadingDetail ? (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : (
                <JourneyTimeline entries={journey} colors={colors} />
              )}
            </>
          )}
        </ScrollView>
      </View>

      {showEdit && (
        <ActivityFormModal
          visible={showEdit}
          initial={activity}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            setShowEdit(false);
            // The edit may retrigger server-side auto-mapping — restart the
            // polling window and refetch the detail so results appear without
            // a manual refresh, even if the initial window already expired.
            skkPollStartRef.current = Date.now();
            qc.invalidateQueries({ queryKey: ['kegiatan-detail', activity.id] });
            onEdited(updated);
          }}
          colors={colors}
        />
      )}
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

interface KegiatanScreenProps {
  /** When true, renders without a back button (tab mode). */
  isTab?: boolean;
}

export default function KegiatanScreen({ isTab = false }: KegiatanScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{
    marketplaceId?: string; courseTitle?: string; courseProvider?: string;
    courseJabkerList?: string; courseSkkTagsList?: string;
    openActivityId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [showCreate, setShowCreate] = useState(false);
  const [marketplacePrefill, setMarketplacePrefill] = useState<MarketplacePrefill | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<PkbActivity | null>(null);
  // Track the last activityId handled via deep-link so repeated re-renders don't re-open,
  // but a new distinct notification tap (different id) still works while the screen is mounted.
  const lastHandledDeepLinkId = React.useRef<string | null>(null);

  useEffect(() => {
    if (params.marketplaceId && params.courseTitle) {
      setMarketplacePrefill({
        marketplaceId: params.marketplaceId,
        courseTitle: params.courseTitle,
        courseProvider: params.courseProvider ?? '',
        courseJabkerList: params.courseJabkerList ? JSON.parse(params.courseJabkerList) : [],
        courseSkkTagsList: params.courseSkkTagsList ? JSON.parse(params.courseSkkTagsList) : [],
      });
      setShowCreate(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: activities = [], isLoading, refetch } = useQuery<PkbActivity[]>({
    queryKey: ['kegiatan'],
    queryFn: listMyKegiatanPkb,
    staleTime: 30 * 1000,
  });

  // Deep-link from push notification: open a specific activity once the list loads.
  // Use lastHandledDeepLinkId so each distinct activityId tap opens its activity,
  // but the same id doesn't re-open on incidental re-renders.
  useEffect(() => {
    if (!params.openActivityId || isLoading || activities.length === 0) return;
    if (lastHandledDeepLinkId.current === params.openActivityId) return;
    const targetId = parseInt(params.openActivityId, 10);
    const match = activities.find((a) => a.id === targetId);
    if (match) {
      lastHandledDeepLinkId.current = params.openActivityId;
      setSelectedActivity(match);
    }
  }, [params.openActivityId, activities, isLoading]);

  const counts = {
    draft: activities.filter((a) => a.status === 'draft' || a.status === 'lengkap').length,
    diajukan: activities.filter((a) => a.status === 'diajukan').length,
    diverifikasi: activities.filter((a) => a.status === 'diverifikasi').length,
    ditolak: activities.filter((a) => a.status === 'ditolak').length,
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        {!isTab && (
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
        )}
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
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 80 }}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      )}

      {showCreate && (
        <ActivityFormModal
          visible={showCreate}
          prefill={marketplacePrefill}
          onClose={() => { setShowCreate(false); setMarketplacePrefill(null); }}
          onSaved={(act) => {
            setShowCreate(false);
            setMarketplacePrefill(null);
            // Open the new activity's detail right away so its SKK polling
            // picks up the server's fire-and-forget auto-mapping result.
            setSelectedActivity(act);
          }}
          colors={colors}
        />
      )}

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
  alertBox: { borderRadius: 10, borderWidth: 1, padding: 12 },
  docCard: { borderRadius: 12, borderWidth: 1, padding: 12 },
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8,
  },
});
