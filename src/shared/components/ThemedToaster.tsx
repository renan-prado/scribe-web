"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/shared/hooks/use-theme";

/**
 * Sonner renders in a portal outside the token tree, so it needs the resolved
 * theme handed to it explicitly instead of inheriting `.dark`.
 */
export function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster position="top-center" richColors theme={theme} />;
}
