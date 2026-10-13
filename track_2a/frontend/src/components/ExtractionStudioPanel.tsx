import React from 'react';
import type { ExtractedAffair, ProvenanceReport } from '../types';

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
}

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
}) => {
  const [copiedJson, setCopiedJson] = React.useState(false);

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

  const handleSelectView = (view: 'cards' | 'json') => {
    if (view === 'cards' && showRawJson) {
      if (onSetRawJson) onSetRawJson(false);
      else onToggleRawJson();
    } else if (view === 'json' && !showRawJson) {
      if (onSetRawJson) onSetRawJson(true);
      else onToggleRawJson();
    }
  };

  return (
    <div className="studio-extraction-panel">
      <div className="studio-panel-header">
        <div className="panel-header-title">
          <span>Apertus Studio</span>
          {provenanceReport && (
            <span className="provenance-pill">
              {Math.round(provenanceReport.provenance_score * 100)}%
            </span>
          )}
        </div>

        <div className="panel-header-actions">
          {extractedAffair && (
            <>
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

              <button
                type="button"
                className={`btn-extract ${isExtracting ? 'btn-extract-loading' : ''}`}
                onClick={onExtract}
                disabled={isExtracting || !canExtract}
                title="Re-run conservative extraction with Swiss-AI Apertus 1.5-8B on CSCS Alps Supercomputer"
              >
                {isExtracting ? 'Extracting...' : 'Re-run'}
              </button>
            </>
          )}
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
            <button
              className="btn-extract"
              onClick={onExtract}
              disabled={!canExtract}
            >
              {canExtract ? 'Extract with Apertus 1.5-8B' : 'Select a document to run'}
            </button>
          </div>
        )}

        {!isExtracting && extractedAffair && (
          showRawJson ? (
            <div className="json-inspector-container">
              <div className="json-inspector-toolbar">
                <div className="json-toolbar-title">
                  <span className="json-schema-badge">UnifiedAffairSchema</span>
                  <span className="json-meta-hint">Valid Pydantic v2 • Deterministic T=0.0</span>
                </div>
                <button
                  type="button"
                  className={`btn-copy-json ${copiedJson ? 'copied' : ''}`}
                  onClick={handleCopyJson}
                  title="Copy full JSON schema to clipboard"
                >
                  {copiedJson ? '✓ Copied' : 'Copy JSON'}
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
              <div className="extracted-card-header">
                <h3>Affair Identity & Metadata</h3>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <span className="badge-body">{extractedAffair.canton_or_body}</span>
                  <span className="citation-chip">{extractedAffair.level}</span>
                  <span className="citation-chip">{extractedAffair.affair_type}</span>
                </div>
              </div>
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: '#ffffff', marginBottom: '0.4rem' }}>
                {extractedAffair.title}
              </div>
              {extractedAffair.title_provenance && (
                <div className="citation-quote">
                  <strong>Page {extractedAffair.title_provenance.page_number}:</strong> "{extractedAffair.title_provenance.source_text_snippet}"
                </div>
              )}
              <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.75rem', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                {extractedAffair.submission_date && (
                  <span>Submitted: <strong>{extractedAffair.submission_date}</strong></span>
                )}
                {extractedAffair.addressed_to && (
                  <span>Addressed to: <strong>{extractedAffair.addressed_to}</strong></span>
                )}
                <span>Language: <strong>{extractedAffair.language.toUpperCase()}</strong></span>
              </div>
            </div>

            {/* Authors / Actors */}
            <div className="extracted-card">
              <div className="extracted-card-header">
                <h3>Authors & Submitters ({extractedAffair.authors.length})</h3>
              </div>
              {extractedAffair.authors.length > 0 ? (
                <div>
                  {extractedAffair.authors.map((author, idx) => (
                    <div key={idx} className="author-chip">
                      <strong>{author.name}</strong>
                      <span className="author-role">{author.role}</span>
                      {author.party_or_fraction && (
                        <span style={{ color: '#94a3b8', fontSize: 'var(--font-size-sm)' }}>({author.party_or_fraction})</span>
                      )}
                      {author.provenance && (
                        <span className="citation-chip">
                          p. {author.provenance.page_number}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                  No individual authors specified (e.g. collective governmental submission).
                </p>
              )}
            </div>

            {/* Background & Rationale */}
            {extractedAffair.background_and_rationale && (
              <div className="extracted-card">
                <div className="extracted-card-header">
                  <h3>Context, Rationale & Provenance</h3>
                  {extractedAffair.rationale_provenance && (
                    <span className="citation-chip">
                      Page {extractedAffair.rationale_provenance.page_number} Verified
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 'var(--font-size-base)', color: '#cbd5e1', lineHeight: '1.6' }}>
                  {extractedAffair.background_and_rationale}
                </p>
                {extractedAffair.rationale_provenance && (
                  <div className="citation-quote">
                    "{extractedAffair.rationale_provenance.source_text_snippet}"
                  </div>
                )}
              </div>
            )}

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
                        <span className="citation-chip" style={{ marginLeft: '0.5rem' }}>
                          p. {qa.question.provenance.page_number}
                        </span>
                      )}
                    </div>
                    {qa.answer ? (
                      <div className="qa-answer">
                        <strong>Executive Answer:</strong> {qa.answer.text}
                        {qa.answer.provenance && (
                          <span className="citation-chip" style={{ marginLeft: '0.5rem' }}>
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
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                  No formal question items present in document (conservative extraction).
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
                        <div className="citation-chip" style={{ marginTop: '0.4rem' }}>
                          p. {fin.provenance.page_number}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
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
                <table className="telemetry-table" style={{ marginTop: '0.5rem' }}>
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Page</th>
                      <th>Status</th>
                      <th>Quote Snippet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provenanceReport.details.map((d, i) => (
                      <tr key={i}>
                        <td className="mono" style={{ color: '#38bdf8' }}>{d.field}</td>
                        <td className="mono">{d.page ? `Page ${d.page}` : '—'}</td>
                        <td>
                          <span className={d.verified ? 'status-pill-ok' : 'badge-tag'}>
                            {d.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                          {d.snippet_preview}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            </>
          )
        )}
      </div>
    </div>
  );
};
