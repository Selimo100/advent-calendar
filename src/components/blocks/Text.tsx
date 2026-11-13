import { Fragment } from 'react';
import { parseInline } from '../../../shared/content/inlineText.ts';

/** Renders content text as React text nodes only (no HTML is ever interpreted). */
export function Inline({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {parseInline(line).map((seg, i) =>
            seg.bold ? <strong key={i}>{seg.text}</strong> : seg.italic ? <em key={i}>{seg.text}</em> : <Fragment key={i}>{seg.text}</Fragment>,
          )}
        </Fragment>
      ))}
    </>
  );
}

export function Paragraphs({ items, className = '' }: { items: string[]; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((p, i) => (
        <p key={i}>
          <Inline text={p} />
        </p>
      ))}
    </div>
  );
}
