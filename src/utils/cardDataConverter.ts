
import type { Card } from '../types/card';

export async function loadCardsFromCsv(csvPath: string): Promise<Card[]> {
  const response = await fetch(csvPath);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const csvText = await response.text();
  return parseCsv(csvText);
}

function parseCsv(csvText: string): Card[] {
  const lines = csvText.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) {
    return [];
  }

  const headers = lines[0].split(',').map(header => header.trim());
  const cards: Card[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const card: Partial<Card> = {};
    headers.forEach((header, index) => {
      const value = values[index];
      if (header === 'type' || header === 'tags') {
        (card as any)[header] = value ? value.split('/').map((s: string) => s.trim()) : [];
      } else {
        (card as any)[header] = value;
      }
    });
    cards.push(card as Card);
  }
  return cards;
}

// CSVの行をパースする関数（カンマ区切り、ダブルクォート対応）
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let inQuote = false;
  let currentField = '';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuote = !inQuote;
    } else if (char === ',' && !inQuote) {
      result.push(currentField.trim());
      currentField = '';
    } else {
      currentField += char;
    }
  }
  result.push(currentField.trim()); // 最後のフィールドを追加
  return result;
}
