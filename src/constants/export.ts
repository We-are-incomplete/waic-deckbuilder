import type { ExportConfig } from "../types/export";

export const EXPORT_CONFIG: ExportConfig = {
  canvas: {
    width: 1920,
    height: 1080,
    backgroundColor: "#030712",
    padding: "0 10px 10px 10px",
  },
  deckName: {
    fontSize: "80px",
    fontWeight: "bold",
    color: "#f9fafb",
    fontFamily: "serif",
  },
  grid: {
    gap: "4px",
  },
  card: {
    borderRadius: "8px",
  },
  badge: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    color: "white",
    padding: "2px 12px",
    borderRadius: "12px",
    fontSize: "32px",
  },
} as const;
