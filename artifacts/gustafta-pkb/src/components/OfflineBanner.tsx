import { WifiOff } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

/**
 * Sticky top banner that appears when the browser loses its network connection.
 * Disappears automatically when connectivity is restored.
 */
export function OfflineBanner() {
  const isOnline = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-md">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>Tidak ada koneksi internet — beberapa fitur tidak tersedia</span>
    </div>
  );
}
