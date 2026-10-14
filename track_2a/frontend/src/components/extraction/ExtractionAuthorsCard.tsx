import React from 'react';
import type { ExtractedAffair, ActiveProvenance } from '../../types';
import { normalizeSwissText } from '../../utils/textNormalization';

interface ExtractionAuthorsCardProps {
  authors: ExtractedAffair['authors'];
  onHoverProvenance?: (prov: ActiveProvenance | null) => void;
}

const DEPT_REGEX =
  /Depart[e]?ment|D[eé]partement|Regierungsr[aä]t(?:in)?|Conseil d'?[EÉ]tat|Consiglio di Stato|Direktion|Direction|Dipartimento|Amt|Kanzlei|Staatsschreiberei|Chancellerie|Cancelleria/i;

export const ExtractionAuthorsCard: React.FC<ExtractionAuthorsCardProps> = ({
  authors,
  onHoverProvenance,
}) => {
  return (
    <div className="extracted-card">
      <div className="extracted-card-header">
        <h3>Authors & Submitters ({authors.length})</h3>
      </div>
      {authors.length > 0 ? (
        <div className="authors-directory">
          {authors.map((author, idx) => {
            const isDept = DEPT_REGEX.test(author.name);
            const displayRole = isDept ? 'Issuing Body' : author.role || 'Author';

            return (
              <div
                key={idx}
                className={`author-dir-row ${author.provenance ? 'interactive-author-row' : ''}`}
                onMouseEnter={
                  author.provenance
                    ? () =>
                        onHoverProvenance?.({
                          field: `author: ${normalizeSwissText(author.name)}`,
                          page_number: author.provenance!.page_number,
                          snippet: author.provenance!.source_text_snippet,
                          char_start: author.provenance!.char_start,
                          char_end: author.provenance!.char_end,
                        })
                    : undefined
                }
                onMouseLeave={author.provenance ? () => onHoverProvenance?.(null) : undefined}
                title={author.provenance ? `Hover to inspect citation on page ${author.provenance.page_number}` : undefined}
              >
                <div className="author-dir-left">
                  <span className="author-dir-idx">{idx + 1}.</span>
                  <span className="author-name">{normalizeSwissText(author.name)}</span>
                  {author.party_or_fraction && (
                    <span className="author-party">({normalizeSwissText(author.party_or_fraction)})</span>
                  )}
                </div>
                <div className="author-dir-right">
                  <span
                    className={`author-role ${author.provenance ? 'interactive-tag' : ''}`}
                    title={
                      author.provenance
                        ? `Page ${author.provenance.page_number} • Click to jump to source in document`
                        : undefined
                    }
                  >
                    {displayRole}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', margin: 0 }}>
          No individual authors specified (e.g. collective governmental submission).
        </p>
      )}
    </div>
  );
};
