import React from 'react';
import { getText } from '../constants';
import type { DocumentItem, PdfPageItem } from '../types';

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
  onFetchParsedText: (url: string) => void;
  copiedPage: number | null;
  onCopyPageText: (pageNum: number, text: string) => void;
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
}) => {
  const hasDocument = Boolean(activeDoc?.url || currentSampleFile);

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
              if (activeDoc?.url && parsedPages.length === 0) {
                onFetchParsedText(activeDoc.url);
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
          <h3 className="preview-hero-title">Document Inspection Studio</h3>
          <p className="preview-hero-desc">
            {controlMode === 'api'
              ? 'Search OpenParlData and select an affair document to preview PDF and page text.'
              : 'Select a cantonal sample to preview PDF and extracted page text.'}
          </p>
          <div className="studio-hero-features">
            <span className="studio-feature-pill">Embedded PDF Viewer</span>
            <span className="studio-feature-pill">pypdf Text Extraction</span>
            <span className="studio-feature-pill">1-Click Text Copy</span>
          </div>
        </div>
      ) : docTab === 'pdf' ? (
        <iframe
          title="PDF Document Preview"
          src={`${pdfProxyUrl}#view=FitH`}
          className="preview-iframe"
        />
      ) : isParsing ? (
        <div className="preview-placeholder">
          <div className="spinner-supercomputer" style={{ width: '32px', height: '32px', borderWidth: '3px' }} />
          <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
            Parsing document pages via pypdf...
          </p>
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
          {activeDoc?.url && (
            <button
              className="btn-primary"
              style={{ marginTop: '0.85rem' }}
              onClick={() => onFetchParsedText(activeDoc.url)}
            >
              Extract Page Text
            </button>
          )}
        </div>
      ) : (
        <div className="parsed-text-view">
          {parsedPages.map((page) => (
            <div key={page.page_number} className="parsed-page-card">
              <div className="parsed-page-header">
                <div className="parsed-page-header-left">
                  <span className="parsed-page-badge">PAGE {page.page_number}</span>
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
                {page.text || <em style={{ color: 'var(--text-muted)' }}>[Empty or image-only page]</em>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
