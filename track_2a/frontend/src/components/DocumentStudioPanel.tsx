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
          <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <p>
            {controlMode === 'api'
              ? 'Search OpenParlData and select an affair document to preview'
              : 'Select a cantonal sample to preview document'}
          </p>
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
          <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <p>Text has not been extracted for this document yet.</p>
          {activeDoc?.url && (
            <button
              className="btn-primary"
              style={{ marginTop: '0.4rem' }}
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
