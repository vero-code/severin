import React from 'react';
import type { ProvenanceReport, ActiveProvenance } from '../../types';
import { normalizeSwissText } from '../../utils/textNormalization';

interface ProvenanceTrustStripProps {
  provenanceReport: ProvenanceReport;
  activeProvenance?: ActiveProvenance | null;
  onHoverProvenance?: (prov: ActiveProvenance | null) => void;
}

export const ProvenanceTrustStrip: React.FC<ProvenanceTrustStripProps> = ({
  provenanceReport,
  activeProvenance,
  onHoverProvenance,
}) => {
  const [isAuditLogExpanded, setIsAuditLogExpanded] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (provenanceReport && provenanceReport.failed_citations > 0) {
      setIsAuditLogExpanded(true);
    }
  }, [provenanceReport]);

  const score = provenanceReport.provenance_score ?? 1.0;
  const isWarning = score < 0.7;

  return (
    <div className={`provenance-trust-strip ${isWarning ? 'strip-warning' : ''} ${isAuditLogExpanded ? 'expanded' : ''}`}>
      <div
        className="trust-strip-header"
        onClick={() => setIsAuditLogExpanded(!isAuditLogExpanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsAuditLogExpanded(!isAuditLogExpanded);
          }
        }}
        title={isAuditLogExpanded ? 'Click to collapse citation audit log' : 'Click to inspect full citation audit log'}
      >
        <div className="trust-strip-main">
          <span className="trust-strip-icon">
            {score >= 0.7 ? '✓' : '⚠️'}
          </span>
          <span className="trust-strip-score">
            {Math.round(score * 100)}% Grounded
          </span>
          <span className="trust-strip-separator">•</span>
          <span className="trust-strip-text">
            {provenanceReport.verified_citations} of {provenanceReport.total_citations} citations verified
          </span>
        </div>
        <div className="trust-strip-toggle">
          <span className="trust-strip-toggle-label">
            {isAuditLogExpanded ? 'Hide Citations ▴' : 'Audit Citations ▾'}
          </span>
        </div>
      </div>

      {isAuditLogExpanded && provenanceReport.details && provenanceReport.details.length > 0 && (
        <div className="trust-strip-details">
          <div className="trust-strip-details-header">
            <span className="trust-strip-hint">Hover row to inspect and highlight citation in source text</span>
          </div>
          <div className="audit-table-wrapper">
            <table className="audit-table">
              <thead>
                <tr>
                  <th style={{ width: '8%', textAlign: 'center' }}>#</th>
                  <th style={{ width: '24%' }}>Field</th>
                  <th style={{ width: '68%' }}>Source Quote Snippet</th>
                </tr>
              </thead>
              <tbody>
                {provenanceReport.details.map((d, i) => {
                  const authorMatch = d.field.match(/^authors\[(\d+)\]/);
                  const authorIndex = authorMatch ? parseInt(authorMatch[1], 10) + 1 : null;
                  const isAuthor = d.field.startsWith('authors[');
                  const isQA = d.field.startsWith('questions_and_answers[');
                  const totalAuthors = provenanceReport.details.filter((x) => x.field.startsWith('authors[')).length;

                  const displayField = isAuthor
                    ? totalAuthors > 1 && authorIndex
                      ? `Author #${authorIndex}`
                      : 'Author'
                    : isQA
                    ? d.field
                        .replace(/^questions_and_answers\[(\d+)\]\.question/, 'Question #$1')
                        .replace(/^questions_and_answers\[(\d+)\]\.answer/, 'Answer #$1')
                        .replace(/^questions_and_answers\[(\d+)\]\./, 'Q&A #$1')
                    : d.field === 'title'
                    ? 'Title'
                    : d.field === 'background_and_rationale'
                    ? 'Rationale'
                    : d.field.startsWith('financial_details[')
                    ? 'Credit'
                    : d.field;

                  const cleanSnippet = normalizeSwissText(d.snippet_preview || '');
                  const isHighlighted =
                    (activeProvenance?.field && activeProvenance.field === d.field) ||
                    (activeProvenance?.page_number === d.page &&
                      Boolean(activeProvenance?.snippet) &&
                      activeProvenance?.snippet === d.snippet_preview);

                  return (
                    <tr
                      key={i}
                      className={isHighlighted ? 'active-highlight' : ''}
                      onMouseEnter={() =>
                        onHoverProvenance?.({
                          field: d.field,
                          page_number: d.page,
                          snippet: d.snippet_preview,
                        })
                      }
                      onMouseLeave={() => onHoverProvenance?.(null)}
                      title={`#${i + 1} · Page ${d.page || '—'}: "${cleanSnippet}"`}
                    >
                      <td className="audit-cell-idx">{i + 1}</td>
                      <td className="audit-cell-field">{displayField}</td>
                      <td className="audit-cell-quote">
                        {cleanSnippet ? `"${cleanSnippet}"` : <em style={{ opacity: 0.5 }}>[empty]</em>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
