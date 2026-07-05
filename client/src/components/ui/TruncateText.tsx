import { useState } from 'react';

interface TruncateTextProps {
  text?: string;
  maxLength?: number;
  emptyLabel?: string;
}

export function TruncateText({ text, maxLength = 30, emptyLabel = '—' }: TruncateTextProps) {
  const [expanded, setExpanded] = useState(false);

  if (!text?.trim()) {
    return <span className="text-gray-400">{emptyLabel}</span>;
  }

  if (text.length <= maxLength) {
    return <span className="text-gray-700">{text}</span>;
  }

  if (expanded) {
    return (
      <span className="text-gray-700">
        {text}{' '}
        <button
          type="button"
          className="text-primary text-sm font-medium hover:underline"
          onClick={() => setExpanded(false)}
        >
          View less
        </button>
      </span>
    );
  }

  return (
    <span className="text-gray-700">
      {text.slice(0, maxLength)}…{' '}
      <button
        type="button"
        className="text-primary text-sm font-medium hover:underline"
        onClick={() => setExpanded(true)}
      >
        View more
      </button>
    </span>
  );
}
