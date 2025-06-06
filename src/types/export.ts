export interface ExportConfig {
  readonly canvas: {
    readonly width: number;
    readonly height: number;
    readonly backgroundColor: string;
    readonly padding: string;
  };
  readonly deckName: {
    readonly fontSize: string;
    readonly fontWeight: string;
    readonly color: string;
    readonly fontFamily: string;
  };
  readonly grid: {
    readonly gap: string;
  };
  readonly card: {
    readonly borderRadius: string;
  };
  readonly badge: {
    readonly backgroundColor: string;
    readonly color: string;
    readonly padding: string;
    readonly borderRadius: string;
    readonly fontSize: string;
  };
}
