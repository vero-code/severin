import React from 'react';
import type { ProvenanceReport, ActiveProvenance, ExtractedAffair } from '../../types';
import { normalizeSwissText } from '../../utils/textNormalization';

interface ProvenanceTrustStripProps {
  provenanceReport: ProvenanceReport;
  extractedAffair?: ExtractedAffair | null;
  activeProvenance?: ActiveProvenance | null;
  onHoverProvenance?: (prov: ActiveProvenance | null) => void;
}

function resolveFullProvenance(
  field: string,
  affair: ExtractedAffair | null | undefined
): { snippet?: string; char_start?: number | null; char_end?: number | null; page_number?: number | null } | null {
  if (!affair) return null;

  if (field === 'title' && affair.title_provenance) {
    return {
      snippet: affair.title_provenance.source_text_snippet,
      char_start: affair.title_provenance.char_start,
      char_end: affair.title_provenance.char_end,
      page_number: affair.title_provenance.page_number,
    };
  }

  if (field === 'background_and_rationale' && affair.rationale_provenance) {
    return {
      snippet: affair.rationale_provenance.source_text_snippet,
      char_start: affair.rationale_provenance.char_start,
      char_end: affair.rationale_provenance.char_end,
      page_number: affair.rationale_provenance.page_number,
    };
  }

  const authorMatch = field.match(/^authors\[(\d+)\]/);
  if (authorMatch) {
    const idx = parseInt(authorMatch[1], 10);
    const author = affair.authors?.[idx];
    if (author?.provenance) {
      return {
        snippet: author.provenance.source_text_snippet,
        char_start: author.provenance.char_start,
        char_end: author.provenance.char_end,
        page_number: author.provenance.page_number,
      };
    }
  }

  const qaQuestionMatch = field.match(/^questions_and_answers\[(\d+)\]\.question/);
  if (qaQuestionMatch) {
    const idx = parseInt(qaQuestionMatch[1], 10);
    const prov = affair.questions_and_answers?.[idx]?.question?.provenance;
    if (prov) {
      return {
        snippet: prov.source_text_snippet,
        char_start: prov.char_start,
        char_end: prov.char_end,
        page_number: prov.page_number,
      };
    }
  }

  const qaAnswerMatch = field.match(/^questions_and_answers\[(\d+)\]\.answer/);
  if (qaAnswerMatch) {
    const idx = parseInt(qaAnswerMatch[1], 10);
    const prov = affair.questions_and_answers?.[idx]?.answer?.provenance;
    if (prov) {
      return {
        snippet: prov.source_text_snippet,
        char_start: prov.char_start,
        char_end: prov.char_end,
        page_number: prov.page_number,
      };
    }
  }

  const finMatch = field.match(/^financial_details\[(\d+)\]/);
  if (finMatch) {
    const idx = parseInt(finMatch[1], 10);
    const prov = affair.financial_details?.[idx]?.provenance;
    if (prov) {
      return {
        snippet: prov.source_text_snippet,
        char_start: prov.char_start,
        char_end: prov.char_end,
        page_number: prov.page_number,
      };
    }
  }

  const procMatch = field.match(/^procedural_events\[(\d+)\]/);
  if (procMatch) {
    const idx = parseInt(procMatch[1], 10);
    const prov = affair.procedural_events?.[idx]?.provenance;
    if (prov) {
      return {
        snippet: prov.source_text_snippet,
        char_start: prov.char_start,
        char_end: prov.char_end,
        page_number: prov.page_number,
      };
    }
  }

  return null;
}

export const ProvenanceTrustStrip: React.FC<ProvenanceTrustStripProps> = ({
  provenanceReport,
  extractedAffair,
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

                  const fullProv = resolveFullProvenance(d.field, extractedAffair);
                  const fullSnippet = fullProv?.snippet || d.source_text_snippet || d.snippet_preview || '';
                  const cleanSnippet = normalizeSwissText(fullSnippet);

                  const isHighlighted =
                    (activeProvenance?.field && activeProvenance.field === d.field) ||
                    (activeProvenance?.page_number === d.page &&
                      Boolean(activeProvenance?.snippet) &&
                      (activeProvenance?.snippet === d.snippet_preview ||
                        activeProvenance?.snippet === fullSnippet ||
                        activeProvenance?.snippet === fullProv?.snippet));

                  return (
                    <tr
                      key={i}
                      className={isHighlighted ? 'active-highlight' : ''}
                      onMouseEnter={() =>
                        onHoverProvenance?.({
                          field: d.field,
                          page_number: fullProv?.page_number ?? d.page,
                          snippet: fullProv?.snippet ?? d.source_text_snippet ?? d.snippet_preview,
                          char_start: fullProv?.char_start ?? d.char_start,
                          char_end: fullProv?.char_end ?? d.char_end,
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
