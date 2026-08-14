import AsyncStorage from '@react-native-async-storage/async-storage';

/** AsyncStorage key holding the Project Brain entry IDs used in the last chat turn. */
export const PB_LAST_USED_KEY = 'GUSTAFTA_PB_LAST_USED_v1';

export interface ProjectBrainUsage {
  ids: number[];
  /** ISO timestamp of the chat turn that used these entries. */
  at: string;
}

/** Persists which Project Brain entries the AI read in the latest chat turn. */
export async function saveProjectBrainUsage(ids: number[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      PB_LAST_USED_KEY,
      JSON.stringify({ ids, at: new Date().toISOString() }),
    );
  } catch {}
}

/** Loads the last-used Project Brain entry IDs, or null if none recorded. */
export async function loadProjectBrainUsage(): Promise<ProjectBrainUsage | null> {
  try {
    const raw = await AsyncStorage.getItem(PB_LAST_USED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.ids)) return null;
    return { ids: parsed.ids.filter((n: unknown) => typeof n === 'number'), at: String(parsed.at ?? '') };
  } catch {
    return null;
  }
}
