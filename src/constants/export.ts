import type { ExportConfig } from "../types/export";

export const EXPORT_CONFIG: ExportConfig = {
  canvas: {
    width: 1920,
    height: 1080,
    backgroundColor: "#030712",
    padding: "0 40px 10px",
  },
  deckName: {
    fontSize: "80px",
    fontWeight: "bold",
    color: "#f9fafb",
    fontFamily: "serif, sans-serif",
  },
  grid: {
    gap: "4px",
  },
} as const;
