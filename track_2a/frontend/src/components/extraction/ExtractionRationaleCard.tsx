import React from 'react';
import type { ExtractedAffair, ActiveProvenance } from '../../types';

interface ExtractionRationaleCardProps {
  rationale?: string | null;
  rationaleProvenance?: ExtractedAffair['rationale_provenance'];
  onHoverProvenance?: (prov: ActiveProvenance | null) => void;
}

export const ExtractionRationaleCard: React.FC<ExtractionRationaleCardProps> = ({
  rationale,
  rationaleProvenance,
  onHoverProvenance,
}) => {
  const [copiedRationale, setCopiedRationale] = React.useState(false);

  const handleCopyRationale = async () => {
    if (!rationale) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(rationale);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = rationale;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedRationale(true);
      setTimeout(() => setCopiedRationale(false), 2000);
    } catch (err) {
      console.error('Failed to copy rationale:', err);
    }
  };

  return (
    <div className="extracted-card">
      <div className="extracted-card-header">
        <h3>Context & Rationale</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          {rationale && rationaleProvenance && (
            <button
              type="button"
              className="btn-citation-icon"
              onMouseEnter={() =>
                onHoverProvenance?.({
                  field: 'background_and_rationale',
                  page_number: rationaleProvenance.page_number,
                  snippet: rationaleProvenance.source_text_snippet,
                  char_start: rationaleProvenance.char_start,
                  char_end: rationaleProvenance.char_end,
                })
              }
              onMouseLeave={() => onHoverProvenance?.(null)}
              title="Hover to inspect citation in document text"
              aria-label="Inspect citation"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          )}
          {rationale && (
            <button
              type="button"
              className={`btn-copy-icon ${copiedRationale ? 'copied' : ''}`}
              onClick={handleCopyRationale}
              title={copiedRationale ? 'Copied to clipboard!' : 'Copy context & rationale'}
              aria-label="Copy context & rationale"
            >
              {copiedRationale ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
      {rationale ? (
        <p className="context-body-text">{rationale}</p>
      ) : (
        <p className="extracted-empty-msg">No background or rationale text present in this document.</p>
      )}
    </div>
  );
};
