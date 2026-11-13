/**
 * A deliberately tiny inline-formatting subset: **bold** and *italic*.
 * Produces plain segments that the UI renders as React text nodes, so no
 * HTML from content is ever interpreted.
 */
export interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

const TOKEN_RE = /(\*\*[^*\n]+?\*\*|\*[^*\n]+?\*)/g;

export function parseInline(input: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let last = 0;
  for (const match of input.matchAll(TOKEN_RE)) {
    const index = match.index;
    if (index > last) segments.push({ text: input.slice(last, index) });
    const token = match[0];
    if (token.startsWith('**')) segments.push({ text: token.slice(2, -2), bold: true });
    else segments.push({ text: token.slice(1, -1), italic: true });
    last = index + token.length;
  }
  if (last < input.length) segments.push({ text: input.slice(last) });
  return segments;
}
