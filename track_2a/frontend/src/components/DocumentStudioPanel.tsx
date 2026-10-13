import React, { useEffect } from 'react';
import { getText } from '../constants';
import type { DocumentItem, PdfPageItem, ActiveProvenance } from '../types';

interface DocumentStudioPanelProps {
  docTab: 'pdf' | 'text';
  onSetDocTab: (tab: 'pdf' | 'text') => void;
  activeDoc: DocumentItem | null;
  currentSampleFile: string;
  currentBodyKey: string;
  safePdfFilename: string;
  pdfProxyUrl: string;
  controlMode: 'samples' | 'api';
  parsedPages: PdfPageItem[];
  isParsing: boolean;
  parseError: string | null;
  onFetchParsedText: (url?: string) => void;
  copiedPage: number | null;
  onCopyPageText: (pageNum: number, text: string) => void;
  activeProvenance?: ActiveProvenance | null;
}

export const DocumentStudioPanel: React.FC<DocumentStudioPanelProps> = ({
  docTab,
  onSetDocTab,
  activeDoc,
  currentSampleFile,
  currentBodyKey,
  safePdfFilename,
  pdfProxyUrl,
  controlMode,
  parsedPages,
  isParsing,
  parseError,
  onFetchParsedText,
  copiedPage,
  onCopyPageText,
  activeProvenance,
}) => {
  const hasDocument = Boolean(activeDoc?.url || currentSampleFile);

  useEffect(() => {
    if (activeProvenance?.page_number && docTab === 'text') {
      const markEl = document.getElementById('active-provenance-mark');
      if (markEl) {
        markEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const pageEl = document.getElementById(`parsed-page-${activeProvenance.page_number}`);
        if (pageEl) {
          pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  }, [activeProvenance, docTab]);

  const renderPageContent = (page: PdfPageItem) => {
    if (!page.text) {
      return <em style={{ color: 'var(--text-muted)' }}>[Empty or image-only page]</em>;
    }

    const isTargetPage = activeProvenance?.page_number === page.page_number;
    const rawSnippet = activeProvenance?.snippet;
    const cleanSnippet = rawSnippet ? rawSnippet.replace(/\.{3,}$/, '').trim() : '';

    if (!isTargetPage || !cleanSnippet || cleanSnippet.length < 3) {
      return page.text;
    }

    const lowerText = page.text.toLowerCase();
    const lowerSnippet = cleanSnippet.toLowerCase();
    const matchIdx = lowerText.indexOf(lowerSnippet);

    if (matchIdx !== -1) {
      const before = page.text.slice(0, matchIdx);
      const matched = page.text.slice(matchIdx, matchIdx + cleanSnippet.length);
      const after = page.text.slice(matchIdx + cleanSnippet.length);
      return (
        <>
          {before}
          <mark className="provenance-highlight-mark" id="active-provenance-mark">
            {matched}
          </mark>
          {after}
        </>
      );
    }

    // Try matching prefix if snippet had slight line-wrap/whitespace variations
    const prefix = cleanSnippet.slice(0, Math.min(28, cleanSnippet.length)).trim().toLowerCase();
    if (prefix.length >= 8) {
      const pIdx = lowerText.indexOf(prefix);
      if (pIdx !== -1) {
        const before = page.text.slice(0, pIdx);
        const matchLen = Math.min(cleanSnippet.length, page.text.length - pIdx);
        const matched = page.text.slice(pIdx, pIdx + matchLen);
        const after = page.text.slice(pIdx + matchLen);
        return (
          <>
            {before}
            <mark className="provenance-highlight-mark" id="active-provenance-mark">
              {matched}
            </mark>
            {after}
          </>
        );
      }
    }

    return page.text;
  };

  return (
    <div className="studio-doc-panel">
      <div className="studio-panel-header">
        <div className="preview-tabs">
          <button
            className={`preview-tab-btn ${docTab === 'pdf' ? 'active' : ''}`}
            onClick={() => onSetDocTab('pdf')}
          >
            PDF
          </button>
          <button
            className={`preview-tab-btn ${docTab === 'text' ? 'active' : ''}`}
            onClick={() => {
              onSetDocTab('text');
              if (parsedPages.length === 0) {
                onFetchParsedText(activeDoc?.url);
              }
            }}
          >
            Text
          </button>
        </div>

        {activeDoc && (
          <div className="doc-center-title">
            <span
              className="doc-info-badge"
              title={getText(activeDoc.title) || `Doc #${activeDoc.id}`}
            >
              [{currentBodyKey}] {getText(activeDoc.title) || `Doc #${activeDoc.id}`}
            </span>
            {activeProvenance?.page_number && (
              <span className="provenance-active-indicator" title={activeProvenance.snippet || undefined}>
                <span className="provenance-dot" />
                Target: Page {activeProvenance.page_number}
              </span>
            )}
          </div>
        )}

        <div className="panel-header-actions">
          {activeDoc?.url && (
            <a
              href={pdfProxyUrl}
              target="_blank"
              rel="noreferrer"
              className="open-pdf-link"
              title={`Open ${safePdfFilename} in new browser tab`}
            >
              ↗ Open PDF
            </a>
          )}
        </div>
      </div>

      {/* Document Content Area */}
      {!hasDocument ? (
        <div className="preview-placeholder">
          <div className="preview-hero-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <h3 className="preview-hero-title">Source Document</h3>
          <p className="preview-hero-desc">
            {controlMode === 'api'
              ? 'Select an affair document to preview.'
              : 'Select a cantonal sample to preview.'}
          </p>
        </div>
      ) : docTab === 'pdf' ? (
        <iframe
          key={activeProvenance?.page_number ? `pdf-p${activeProvenance.page_number}` : 'pdf-default'}
          title="PDF Document Preview"
          src={`${pdfProxyUrl}#page=${activeProvenance?.page_number || 1}&view=FitH`}
          className="preview-iframe"
        />
      ) : isParsing ? (
        <div className="preview-placeholder">
          <div
            className="spinner-supercomputer"
            style={{
              width: '42px',
              height: '42px',
              borderWidth: '3px',
              borderTopColor: 'var(--accent-mint)',
              borderRightColor: 'var(--accent-green-bright)',
              boxShadow: '0 0 20px rgba(167, 243, 208, 0.2)',
            }}
          />
          <h3 className="preview-hero-title">Extracting Document Pages</h3>
          <p className="preview-hero-desc">Extracting raw text pages and character counts via pypdf</p>
        </div>
      ) : parseError ? (
        <div className="preview-placeholder">
          <div
            style={{
              padding: '1.25rem',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              color: '#fca5a5',
              maxWidth: '440px',
              textAlign: 'center',
            }}
          >
            <p style={{ fontWeight: 600, marginBottom: '0.4rem' }}>⚠️ Parsing Failed</p>
            <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: '0.75rem' }}>{parseError}</p>
            {activeDoc?.url && (
              <button
                className="btn-primary"
                onClick={() => onFetchParsedText(activeDoc.url)}
              >
                Retry Parsing
              </button>
            )}
          </div>
        </div>
      ) : parsedPages.length === 0 ? (
        <div className="preview-placeholder">
          <div className="preview-hero-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <h3 className="preview-hero-title">Parse Document Text</h3>
          <p className="preview-hero-desc">Extract raw text pages and character counts with pypdf.</p>
          <button
            className="btn-primary"
            style={{ marginTop: '0.85rem' }}
            onClick={() => onFetchParsedText(activeDoc?.url)}
          >
            Extract Page Text
          </button>
        </div>
      ) : (
        <div className="parsed-text-view">
          {parsedPages.map((page) => (
            <div
              key={page.page_number}
              id={`parsed-page-${page.page_number}`}
              className={`parsed-page-card ${activeProvenance?.page_number === page.page_number ? 'page-highlighted' : ''}`}
            >
              <div className="parsed-page-header">
                <div className="parsed-page-header-left">
                  <span className="parsed-page-badge">PAGE {page.page_number}</span>
                  {activeProvenance?.page_number === page.page_number && (
                    <span className="parsed-page-active-tag">🎯 Active Provenance Source</span>
                  )}
                  <span className="parsed-page-chars">{page.char_count.toLocaleString()} characters</span>
                </div>
                <button
                  className={`btn-copy-page ${copiedPage === page.page_number ? 'copied' : ''}`}
                  onClick={() => onCopyPageText(page.page_number, page.text)}
                  title={copiedPage === page.page_number ? 'Copied to clipboard!' : 'Copy page text'}
                  aria-label="Copy page text"
                >
                  {copiedPage === page.page_number ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="parsed-page-content">
                {renderPageContent(page)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
