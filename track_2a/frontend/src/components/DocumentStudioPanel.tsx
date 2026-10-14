import React, { useEffect } from 'react';
import { getText } from '../constants';
import { normalizeSwissText, foldDiacritics } from '../utils/textNormalization';
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
  textTabHint?: boolean;
  onClearProvenance?: () => void;
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
  textTabHint = false,
  onClearProvenance,
}) => {
  const hasDocument = Boolean(activeDoc?.url || currentSampleFile);

  useEffect(() => {
    if (activeProvenance?.page_number && docTab === 'text' && parsedPages.length > 0) {
      const scrollToProvenance = () => {
        const markEl = document.getElementById('active-provenance-mark');
        if (markEl) {
          markEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return true;
        }
        const pageEl = document.getElementById(`parsed-page-${activeProvenance.page_number}`);
        if (pageEl) {
          pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return true;
        }
        return false;
      };

      scrollToProvenance();
      const t1 = setTimeout(scrollToProvenance, 60);
      const t2 = setTimeout(scrollToProvenance, 250);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [activeProvenance, docTab, parsedPages]);

  const renderPageContent = (page: PdfPageItem) => {
    if (!page.text) {
      return <em style={{ color: 'var(--text-muted)' }}>[Empty or image-only page]</em>;
    }

    const isTargetPage = activeProvenance?.page_number === page.page_number;
    if (!isTargetPage) {
      return page.text;
    }

    // 0. Exact character offset slice if provided by backend provenance grounding
    if (
      typeof activeProvenance?.char_start === 'number' &&
      typeof activeProvenance?.char_end === 'number' &&
      activeProvenance.char_end > activeProvenance.char_start &&
      activeProvenance.char_end <= page.text.length
    ) {
      const before = page.text.slice(0, activeProvenance.char_start);
      const matched = page.text.slice(activeProvenance.char_start, activeProvenance.char_end);
      const after = page.text.slice(activeProvenance.char_end);
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

    const rawSnippet = activeProvenance?.snippet;
    const cleanSnippet = rawSnippet ? rawSnippet.replace(/\.{3,}$/, '').trim() : '';

    if (!cleanSnippet || cleanSnippet.length < 3) {
      return page.text;
    }

    // 1. Direct case-insensitive match
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

    // 2. Whitespace-flexible and glyph-normalized regex match (handles line-wraps and embedded artifacts)
    const normalizedSnippet = normalizeSwissText(cleanSnippet).trim();

    const words = normalizedSnippet.split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 2) {
      const escapedWords = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      try {
        const fullRegex = new RegExp(escapedWords.join('\\s+'), 'i');
        const match = page.text.match(fullRegex);
        if (match && typeof match.index === 'number') {
          const before = page.text.slice(0, match.index);
          const matched = page.text.slice(match.index, match.index + match[0].length);
          const after = page.text.slice(match.index + match[0].length);
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
      } catch {}
    }

    // 3. Leading words phrase match (e.g. author name and initial street)
    if (words.length >= 2) {
      const leadingWords = words.slice(0, Math.min(4, words.length));
      const escapedLeading = leadingWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      try {
        const leadingRegex = new RegExp(escapedLeading.join('\\s+'), 'i');
        const match = page.text.match(leadingRegex);
        if (match && typeof match.index === 'number') {
          const before = page.text.slice(0, match.index);
          const matched = page.text.slice(match.index, match.index + match[0].length);
          const after = page.text.slice(match.index + match[0].length);
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
      } catch {}
    }

    // 4. Diacritic-folded fallback match (resilient to accents/umlauts dropped or corrupted by PDF drivers)
    const foldedPage = foldDiacritics(page.text);
    const foldedSnippet = foldDiacritics(normalizedSnippet);
    const foldedWords = foldedSnippet.split(/\s+/).filter(w => w.length > 0);
    if (foldedWords.length >= 2) {
      const escapedFolded = foldedWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      try {
        const foldedRegex = new RegExp(escapedFolded.join('\\s+'), 'i');
        const match = foldedPage.match(foldedRegex);
        if (match && typeof match.index === 'number') {
          const matchStart = match.index;
          const matchLen = match[0].length;
          const before = page.text.slice(0, matchStart);
          const matched = page.text.slice(matchStart, matchStart + matchLen);
          const after = page.text.slice(matchStart + matchLen);
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
      } catch {}
    }

    // 5. Target entity match from activeProvenance.field (e.g. "author: Weil Anjuška")
    if (activeProvenance?.field) {
      const entityName = normalizeSwissText(
        activeProvenance.field.replace(/^(?:author|title|question|answer|financial|event):\s*/i, '')
      ).trim();
      if (entityName.length >= 3) {
        const entityWords = entityName.split(/\s+/).filter(w => w.length > 0);
        const escapedEntity = entityWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        try {
          const entityRegex = new RegExp(escapedEntity.join('\\s+'), 'i');
          const match = page.text.match(entityRegex);
          if (match && typeof match.index === 'number') {
            const before = page.text.slice(0, match.index);
            const matched = page.text.slice(match.index, match.index + match[0].length);
            const after = page.text.slice(match.index + match[0].length);
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
        } catch {}

        // Entity fallback with diacritic folding
        const foldedEntity = foldDiacritics(entityName);
        const foldedEntityWords = foldedEntity.split(/\s+/).filter(w => w.length > 0);
        if (foldedEntityWords.length >= 1) {
          const escapedFoldedEntity = foldedEntityWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
          try {
            const entityFoldedRegex = new RegExp(escapedFoldedEntity.join('\\s+'), 'i');
            const match = foldedPage.match(entityFoldedRegex);
            if (match && typeof match.index === 'number') {
              const matchStart = match.index;
              const matchLen = match[0].length;
              const before = page.text.slice(0, matchStart);
              const matched = page.text.slice(matchStart, matchStart + matchLen);
              const after = page.text.slice(matchStart + matchLen);
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
          } catch {}
        }
      }
    }

    // 6. Long text phrase prefix match (resilient to subtle typography differences in long rationale sections)
    if (words.length >= 5) {
      const prefixWords = words.slice(0, 6);
      const escapedPrefix = prefixWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      try {
        const prefixRegex = new RegExp(escapedPrefix.join('\\s+'), 'i');
        const match = page.text.match(prefixRegex);
        if (match && typeof match.index === 'number') {
          const before = page.text.slice(0, match.index);
          const matched = page.text.slice(match.index, Math.min(page.text.length, match.index + cleanSnippet.length));
          const after = page.text.slice(Math.min(page.text.length, match.index + cleanSnippet.length));
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
      } catch {}
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
            className={`preview-tab-btn ${docTab === 'text' ? 'active' : ''} ${textTabHint ? 'tab-hint-glow' : ''}`}
            onClick={() => {
              onSetDocTab('text');
              if (parsedPages.length === 0) {
                onFetchParsedText(activeDoc?.url);
              }
            }}
            title={textTabHint ? 'Citation ready in Text view (click to view)' : undefined}
          >
            Text
            {textTabHint && <span className="tab-hint-dot" />}
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
          <h3 className="preview-hero-title">Source Document</h3>
          <p className="preview-hero-desc">
            {controlMode === 'api'
              ? 'Select an affair document to preview.'
              : 'Select a cantonal sample to preview.'}
          </p>
        </div>
      ) : docTab === 'pdf' ? (
        <iframe
          key={pdfProxyUrl || 'pdf-viewer'}
          title="PDF Document Preview"
          src={`${pdfProxyUrl}#view=FitH`}
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
                  <span className="parsed-page-chars">{page.char_count.toLocaleString()} characters</span>
                </div>
                <div className="parsed-page-header-right">
                  <span className="parsed-page-badge">Page {page.page_number}</span>
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
