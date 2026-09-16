export type DescriptionBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

function nextNonBlankLine(lines: string[], from: number): string {
  for (let j = from; j < lines.length; j++) {
    if (lines[j].trim()) return lines[j].trim();
  }
  return '';
}

/**
 * Turns the scraper's structured plain text (blank-line-separated
 * paragraphs, "• " prefixed bullets — see jobScraper.ts's
 * htmlToStructuredText) into typed blocks the UI can render as real
 * <h3>/<ul><li>/<p> instead of one flat paragraph.
 *
 * A standalone short line (no trailing period) immediately followed by a
 * bullet list is treated as a section heading (e.g. "Responsibilities").
 * Older descriptions saved before this existed are just plain prose with
 * no "• " markers — those fall through as ordinary paragraphs, unchanged.
 */
export function parseJobDescription(text: string): DescriptionBlock[] {
  const lines = text.split('\n');
  const blocks: DescriptionBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }

    if (line.startsWith('• ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('• ')) {
        items.push(lines[i].trim().slice(2).trim());
        i++;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    const next = nextNonBlankLine(lines, i + 1);
    if (line.length <= 60 && !line.endsWith('.') && next.startsWith('• ')) {
      blocks.push({ type: 'heading', text: line.replace(/:$/, '') });
      i++;
      continue;
    }

    const paraLines: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith('• ')) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: 'paragraph', text: paraLines.join(' ') });
  }

  return blocks;
}
