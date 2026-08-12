/**
 * Kegiatan PKB — tab entry point.
 * Renders the same KegiatanScreen but without a back button (isTab=true).
 */
import KegiatanScreen from '../kegiatan';

export default function KegiatanTab() {
  return <KegiatanScreen isTab />;
}
