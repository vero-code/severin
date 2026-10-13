import React from 'react';
import type { ExtractedAffair, ProvenanceReport, ActiveProvenance } from '../types';

interface ExtractionStudioPanelProps {
  isExtracting: boolean;
  extractError: string | null;
  onExtract: () => void;
  canExtract: boolean;
  extractedAffair: ExtractedAffair | null;
  provenanceReport: ProvenanceReport | null;
  showRawJson: boolean;
  onToggleRawJson: () => void;
  onSetRawJson?: (show: boolean) => void;
  activeProvenance?: ActiveProvenance | null;
  onHoverProvenance?: (prov: ActiveProvenance | null) => void;
  onLocateProvenance?: (prov: ActiveProvenance) => void;
}
import { normalizeSwissText } from '../utils/textNormalization';

export const normalizeGlyphs = normalizeSwissText;

export const ExtractionStudioPanel: React.FC<ExtractionStudioPanelProps> = ({
  isExtracting,
  extractError,
  onExtract,
  canExtract,
  extractedAffair,
  provenanceReport,
  showRawJson,
  onToggleRawJson,
  onSetRawJson,
  activeProvenance,
  onHoverProvenance,
  onLocateProvenance,
}) => {
  const [copiedJson, setCopiedJson] = React.useState(false);
  const [copiedRationale, setCopiedRationale] = React.useState(false);

  const handleCopyJson = async () => {
    if (!extractedAffair) return;
    const jsonStr = JSON.stringify(extractedAffair, null, 2);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(jsonStr);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = jsonStr;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch (err) {
      console.error('Failed to copy JSON:', err);
    }
  };

  const handleCopyRationale = async () => {
    if (!extractedAffair?.background_and_rationale) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(extractedAffair.background_and_rationale);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = extractedAffair.background_and_rationale;
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

  const handleSelectView = (view: 'cards' | 'json') => {
    if (view === 'cards' && showRawJson) {
      if (onSetRawJson) onSetRawJson(false);
      else onToggleRawJson();
    } else if (view === 'json' && !showRawJson) {
      if (onSetRawJson) onSetRawJson(true);
      else onToggleRawJson();
    }
  };

  const isTitleInteractive = Boolean(extractedAffair?.title_provenance);

  return (
    <div className="studio-extraction-panel">
      <div className="studio-panel-header">
        <div className="panel-header-title">
          <span>Apertus Studio</span>
        </div>

        <div className="panel-header-actions">
          {extractedAffair && (
            <div className="preview-tabs">
              <button
                type="button"
                className={`preview-tab-btn ${!showRawJson ? 'active' : ''}`}
                onClick={() => handleSelectView('cards')}
              >
                Cards
              </button>
              <button
                type="button"
                className={`preview-tab-btn ${showRawJson ? 'active' : ''}`}
                onClick={() => handleSelectView('json')}
              >
                JSON
              </button>
            </div>
          )}

          <button
            type="button"
            className={`btn-extract ${isExtracting ? 'btn-extract-loading' : ''}`}
            onClick={onExtract}
            disabled={isExtracting || !canExtract}
            title={canExtract ? 'Run conservative extraction with Swiss-AI Apertus 1.5-8B on CSCS Alps Supercomputer' : 'Select a document first'}
          >
            {isExtracting ? (
              'Extracting...'
            ) : extractedAffair ? (
              'Re-run'
            ) : (
              'Extract with Apertus'
            )}
          </button>
        </div>
      </div>

      {/* Extraction Content Area */}
      <div className="extracted-view-container">
        {isExtracting && (
          <div className="extract-loading-box">
            <div className="spinner-supercomputer" />
            <h3 style={{ color: '#ffffff', fontSize: 'var(--font-size-md)', fontWeight: 700, marginBottom: '0.45rem' }}>
              Extracting with Apertus 1.5-8B
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', maxWidth: '440px', lineHeight: '1.6' }}>
              Parsing document structure, extracting schema fields, and verifying citation provenance.
            </p>
            <div className="studio-hero-features" style={{ marginTop: '1.25rem' }}>
              <span className="studio-feature-pill studio-pill-active">
                <span className="studio-pill-dot" /> Live Inference
              </span>
              <span className="studio-feature-pill">Deterministic (T=0.0)</span>
              <span className="studio-feature-pill">Strict Pydantic</span>
            </div>
          </div>
        )}

        {extractError && (
          <div
            style={{
              padding: '1.25rem',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              color: '#fca5a5',
            }}
          >
            <h4>Extraction Failed</h4>
            <p style={{ marginTop: '0.4rem', fontSize: 'var(--font-size-sm)' }}>{extractError}</p>
            <button
              className="btn-primary"
              style={{ marginTop: '0.75rem', fontSize: 'var(--font-size-sm)', padding: '0.4rem 0.8rem' }}
              onClick={onExtract}
            >
              Retry Extraction
            </button>
          </div>
        )}

        {!isExtracting && !extractError && !extractedAffair && (
          <div className="studio-idle-hero">
            <div className="studio-hero-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M3 10h18M5 10v11M9 10v11M13 10v11M17 10v11M19 10v11M12 2l9 6H3l9-6z" />
              </svg>
            </div>
            <h3 className="studio-hero-title">Grounded Extraction</h3>
            <p className="studio-hero-desc">
              Conservative LLM analysis with verified Swiss citation provenance.
            </p>
          </div>
        )}

        {!isExtracting && extractedAffair && (
          showRawJson ? (
            <div className="json-inspector-container">
              <div className="json-inspector-toolbar">
                <div className="json-toolbar-title">
                  <span className="json-meta-hint">Unified Representation Schema</span>
                </div>
                <button
                  type="button"
                  className={`btn-copy-icon ${copiedJson ? 'copied' : ''}`}
                  onClick={handleCopyJson}
                  title={copiedJson ? 'Copied to clipboard!' : 'Copy JSON'}
                  aria-label="Copy JSON"
                >
                  {copiedJson ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
              <pre className="json-inspector-pre">
                {JSON.stringify(extractedAffair, null, 2)}
              </pre>
            </div>
          ) : (
            <>
            {/* Provenance Trust Strip */}
            <div className={`provenance-trust-strip ${(provenanceReport?.provenance_score ?? 1.0) < 0.7 ? 'strip-warning' : ''}`}>
              <span className="trust-strip-icon">
                {(provenanceReport?.provenance_score ?? 1.0) >= 0.7 ? '✓' : '⚠️'}
              </span>
              <span className="trust-strip-score">
                {Math.round((provenanceReport?.provenance_score ?? 1.0) * 100)}% Grounded
              </span>
              <span className="trust-strip-separator">•</span>
              <span className="trust-strip-text">
                {provenanceReport?.verified_citations ?? 0} of {provenanceReport?.total_citations ?? 0} citations algorithmically verified against source PDF
              </span>
            </div>

            {/* Header / Identity Card */}
            <div className="extracted-card">
              <div
                className={`affair-title-text ${isTitleInteractive ? 'interactive-title' : ''}`}
                onMouseEnter={isTitleInteractive ? () => onHoverProvenance?.({
                  field: 'title',
                  page_number: extractedAffair.title_provenance!.page_number,
                  snippet: extractedAffair.title_provenance!.source_text_snippet,
                  char_start: extractedAffair.title_provenance!.char_start,
                  char_end: extractedAffair.title_provenance!.char_end,
                }) : undefined}
                onMouseLeave={isTitleInteractive ? () => onHoverProvenance?.(null) : undefined}
                onClick={isTitleInteractive ? () => onLocateProvenance?.({
                  field: 'title',
                  page_number: extractedAffair.title_provenance!.page_number,
                  snippet: extractedAffair.title_provenance!.source_text_snippet,
                  char_start: extractedAffair.title_provenance!.char_start,
                  char_end: extractedAffair.title_provenance!.char_end,
                }) : undefined}
                title={isTitleInteractive ? 'Click to locate title in document (or hover to highlight)' : undefined}
              >
                {extractedAffair.title}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="meta-tag meta-tag-canton">{extractedAffair.canton_or_body}</span>
                <span className="meta-tag">{extractedAffair.level}</span>
                <span className="meta-tag">{extractedAffair.affair_type}</span>
                <span className="meta-tag">{extractedAffair.language.toUpperCase()}</span>
              </div>
              {extractedAffair.questions_and_answers.length === 0 && !extractedAffair.background_and_rationale && (
                <div className="document-nature-notice">
                  <svg className="notice-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <div className="notice-content">
                    <strong>Administrative Annex / Consultation Document:</strong> Contains official addressee rosters and procedure metadata. No parliamentary questions or debate motions present in source.
                  </div>
                </div>
              )}


              
              {(extractedAffair.submission_date || extractedAffair.addressed_to) && (
                <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.75rem', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                  {extractedAffair.submission_date && (
                    <span>Submitted: <strong>{extractedAffair.submission_date}</strong></span>
                  )}
                  {extractedAffair.addressed_to && (
                    <span>Addressed to: <strong>{extractedAffair.addressed_to}</strong></span>
                  )}
                </div>
              )}
            </div>

            {/* Authors / Actors */}
            <div className="extracted-card">
              <div className="extracted-card-header">
                <h3>Authors & Submitters ({extractedAffair.authors.length})</h3>
              </div>
              {extractedAffair.authors.length > 0 ? (
                <div className="authors-directory">
                  {extractedAffair.authors.map((author, idx) => {
                    const isDept = /Depart[e]?ment|D[eé]partement|Regierungsr[aä]t(?:in)?|Conseil d'?[EÉ]tat|Consiglio di Stato|Direktion|Direction|Dipartimento|Amt|Kanzlei|Staatsschreiberei|Chancellerie|Cancelleria/i.test(author.name);
                    const displayRole = isDept ? 'Issuing Body' : (author.role || 'Author');
                    return (
                      <div
                        key={idx}
                        className={`author-dir-row ${author.provenance ? 'interactive-author-row' : ''}`}
                        onClick={author.provenance ? () => onLocateProvenance?.({
                          field: `author: ${normalizeGlyphs(author.name)}`,
                          page_number: author.provenance!.page_number,
                          snippet: author.provenance!.source_text_snippet,
                          char_start: author.provenance!.char_start,
                          char_end: author.provenance!.char_end,
                        }) : undefined}
                        onMouseEnter={author.provenance ? () => onHoverProvenance?.({
                          field: `author: ${normalizeGlyphs(author.name)}`,
                          page_number: author.provenance!.page_number,
                          snippet: author.provenance!.source_text_snippet,
                          char_start: author.provenance!.char_start,
                          char_end: author.provenance!.char_end,
                        }) : undefined}
                        onMouseLeave={author.provenance ? () => onHoverProvenance?.(null) : undefined}
                        style={{ cursor: author.provenance ? 'pointer' : 'default' }}
                      >
                        <div className="author-dir-left">
                          <span className="author-dir-idx">{idx + 1}.</span>
                          <span className="author-name">{normalizeGlyphs(author.name)}</span>
                          {author.party_or_fraction && (
                            <span className="author-party">({normalizeGlyphs(author.party_or_fraction)})</span>
                          )}
                        </div>
                        <div className="author-dir-right">
                          <span
                            className={`author-role ${author.provenance ? 'interactive-tag' : ''}`}
                            title={author.provenance ? `Page ${author.provenance.page_number} • Click to jump to source in document` : undefined}
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

            {/* Background & Rationale */}
            <div className="extracted-card">
              <div className="extracted-card-header">
                <h3>Context & Rationale</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  {extractedAffair.background_and_rationale && extractedAffair.rationale_provenance && (
                    <span
                      className="citation-page-tag interactive-tag"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => onHoverProvenance?.({
                        field: 'background_and_rationale',
                        page_number: extractedAffair.rationale_provenance!.page_number,
                        snippet: extractedAffair.rationale_provenance!.source_text_snippet,
                        char_start: extractedAffair.rationale_provenance!.char_start,
                        char_end: extractedAffair.rationale_provenance!.char_end,
                      })}
                      onMouseLeave={() => onHoverProvenance?.(null)}
                      onClick={() => onLocateProvenance?.({
                        field: 'background_and_rationale',
                        page_number: extractedAffair.rationale_provenance!.page_number,
                        snippet: extractedAffair.rationale_provenance!.source_text_snippet,
                        char_start: extractedAffair.rationale_provenance!.char_start,
                        char_end: extractedAffair.rationale_provenance!.char_end,
                      })}
                      title="Click to view citation (or hover to highlight)"
                    >
                      Page {extractedAffair.rationale_provenance.page_number}
                    </span>
                  )}
                  {extractedAffair.background_and_rationale && (
                    <button
                      type="button"
                      className={`btn-copy-icon ${copiedRationale ? 'copied' : ''}`}
                      onClick={handleCopyRationale}
                      title={copiedRationale ? 'Copied to clipboard!' : 'Copy context & rationale'}
                      aria-label="Copy context & rationale"
                    >
                      {copiedRationale ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
              {extractedAffair.background_and_rationale ? (
                <p className="context-body-text">
                  {extractedAffair.background_and_rationale}
                </p>
              ) : (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', margin: 0 }}>
                  No background or rationale text present in this document.
                </p>
              )}
            </div>

            {/* Questions and Answers */}
            <div className="extracted-card">
              <div className="extracted-card-header">
                <h3>Questions & Executive Answers ({extractedAffair.questions_and_answers.length})</h3>
              </div>
              {extractedAffair.questions_and_answers.length > 0 ? (
                extractedAffair.questions_and_answers.map((qa, idx) => (
                  <div key={idx} className="qa-card">
                    <div className="qa-question">
                      <strong>Question {qa.question.number || (idx + 1)}:</strong> {qa.question.text}
                      {qa.question.provenance && (
                        <span
                          className="citation-page-tag interactive-tag"
                          style={{ marginLeft: '0.5rem', cursor: 'pointer' }}
                          onMouseEnter={() => onHoverProvenance?.({
                            field: `question #${qa.question.number || (idx + 1)}`,
                            page_number: qa.question.provenance!.page_number,
                            snippet: qa.question.provenance!.source_text_snippet,
                          })}
                          onMouseLeave={() => onHoverProvenance?.(null)}
                          onClick={() => onLocateProvenance?.({
                            field: `question #${qa.question.number || (idx + 1)}`,
                            page_number: qa.question.provenance!.page_number,
                            snippet: qa.question.provenance!.source_text_snippet,
                          })}
                          title="Click to locate question citation"
                        >
                          p. {qa.question.provenance.page_number}
                        </span>
                      )}
                    </div>
                    {qa.answer ? (
                      <div className="qa-answer">
                        <strong>Executive Answer:</strong> {qa.answer.text}
                        {qa.answer.provenance && (
                          <span
                            className="citation-page-tag interactive-tag"
                            style={{ marginLeft: '0.5rem', cursor: 'pointer' }}
                            onMouseEnter={() => onHoverProvenance?.({
                              field: `answer #${qa.question.number || (idx + 1)}`,
                              page_number: qa.answer!.provenance!.page_number,
                              snippet: qa.answer!.provenance!.source_text_snippet,
                            })}
                            onMouseLeave={() => onHoverProvenance?.(null)}
                            onClick={() => onLocateProvenance?.({
                              field: `answer #${qa.question.number || (idx + 1)}`,
                              page_number: qa.answer!.provenance!.page_number,
                              snippet: qa.answer!.provenance!.source_text_snippet,
                            })}
                            title="Click to locate answer citation"
                          >
                            p. {qa.answer.provenance.page_number}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                        [Pending executive answer]
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', margin: 0 }}>
                  No parliamentary questions present in this document.
                </p>
              )}
            </div>

            {/* Financial Credits */}
            <div className="extracted-card">
              <div className="extracted-card-header">
                <h3>Financial Credits & Appropriations ({extractedAffair.financial_details.length})</h3>
              </div>
              {extractedAffair.financial_details.length > 0 ? (
                <div className="financial-grid">
                  {extractedAffair.financial_details.map((fin, idx) => (
                    <div key={idx} className="financial-item">
                      <div className="financial-amount">
                        {fin.amount_chf ? `${fin.amount_chf.toLocaleString()} CHF` : 'Undisclosed CHF'}
                      </div>
                      <div className="financial-purpose">{fin.purpose}</div>
                      {fin.credit_type && (
                        <div style={{ fontSize: 'var(--font-size-sm)', color: '#94a3b8', marginTop: '0.2rem' }}>
                          Type: {fin.credit_type}
                        </div>
                      )}
                      {fin.provenance && (
                        <div
                          className="citation-chip interactive-tag"
                          style={{ marginTop: '0.4rem', cursor: 'pointer' }}
                          onMouseEnter={() => onHoverProvenance?.({
                            field: `finance: ${fin.purpose || 'credit'}`,
                            page_number: fin.provenance!.page_number,
                            snippet: fin.provenance!.source_text_snippet,
                          })}
                          onMouseLeave={() => onHoverProvenance?.(null)}
                          onClick={() => onLocateProvenance?.({
                            field: `finance: ${fin.purpose || 'credit'}`,
                            page_number: fin.provenance!.page_number,
                            snippet: fin.provenance!.source_text_snippet,
                          })}
                          title="Click to locate financial citation"
                        >
                          p. {fin.provenance.page_number}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', margin: 0 }}>
                  No financial expenditures or credits requested in this affair.
                </p>
              )}
            </div>

            {/* Provenance Audit Table */}
            {provenanceReport && provenanceReport.details && provenanceReport.details.length > 0 && (
              <div className="extracted-card">
                <div className="extracted-card-header">
                  <h3>Provenance Verification Audit Log</h3>
                  <span className="provenance-pill">
                    {provenanceReport.verified_citations} / {provenanceReport.total_citations} Verified
                  </span>
                </div>
                <div className="audit-log-list">
                  {provenanceReport.details.map((d, i) => {
                    const isAuthor = d.field.startsWith('authors[');
                    const isQA = d.field.startsWith('questions_and_answers[');
                    const displayField = isAuthor
                      ? normalizeGlyphs(d.field).replace(/^authors\[\d+\]\.?/, 'author · ')
                      : isQA
                      ? d.field.replace(/^questions_and_answers\[(\d+)\]\./, 'q&a #$1 · ')
                      : d.field;

                    const isHighlighted = (activeProvenance?.field && activeProvenance.field === d.field) ||
                      (activeProvenance?.page_number === d.page && Boolean(activeProvenance?.snippet) && activeProvenance?.snippet === d.snippet_preview);

                    return (
                      <div
                        key={i}
                        className={`audit-log-item ${isHighlighted ? 'active-highlight' : ''}`}
                        onMouseEnter={() => onHoverProvenance?.({ field: d.field, page_number: d.page, snippet: d.snippet_preview })}
                        onMouseLeave={() => onHoverProvenance?.(null)}
                        onClick={() => onLocateProvenance?.({ field: d.field, page_number: d.page, snippet: d.snippet_preview })}
                        title="Click to jump to source in document (PDF / Text)"
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="audit-item-header">
                          <div className="audit-field-info">
                            <span className="audit-field-name">{displayField}</span>
                            {d.page && (
                              <span className="citation-page-tag">
                                page {d.page}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <span className={`audit-status-badge ${d.verified ? 'audit-status-ok' : 'audit-status-fail'}`}>
                              {d.verified ? '✓ VERIFIED' : d.status.toUpperCase()}
                            </span>
                            <span className="audit-locate-icon" title="Jump to source in document">
                              ↗
                            </span>
                          </div>
                        </div>
                        {d.snippet_preview && (
                          <div className="audit-item-quote">
                            "{normalizeGlyphs(d.snippet_preview)}"
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            </>
          )
        )}
      </div>
    </div>
  );
};
