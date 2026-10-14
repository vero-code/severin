import React, { useEffect } from 'react';
import { getText } from '../constants';
import { normalizeSwissText, foldDiacritics, buildWordPattern } from '../utils/textNormalization';
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
  isWebPortal?: boolean;
  portalUrl?: string;
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
  isWebPortal = false,
  portalUrl,
}) => {
  const hasDocument = Boolean(activeDoc?.url || currentSampleFile);
  const portalDomain = portalUrl ? (portalUrl.match(/https?:\/\/(?:www\.)?([^/]+)/)?.[1] || 'lu.ch') : 'lu.ch';
  const activeDocTitle = (activeDoc?.title ? getText(activeDoc.title) : '') || 'Änderung des Gesetzes über die Ergänzungsleistungen zur AHV/IV (SRL Nr. 881)';

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
      let start = activeProvenance.char_start;
      let end = activeProvenance.char_end;

      // Defensive healing: if end was truncated prematurely due to line-break hyphenations
      const rawSnippet = activeProvenance?.snippet;
      const cleanSnippet = rawSnippet ? rawSnippet.replace(/\.{3,}$/, '').trim() : '';
      if (cleanSnippet) {
        const snippetWords = cleanSnippet.split(/\s+/).filter(w => w.length > 0);
        const lastWord = snippetWords[snippetWords.length - 1]?.replace(/^[^\w\u00C0-\u024F]+|[^\w\u00C0-\u024F]+$/g, '');
        if (lastWord) {
          const searchStart = Math.max(start, end - 25);
          const searchEnd = Math.min(page.text.length, end + 80);
          const searchWindow = page.text.slice(searchStart, searchEnd);
          const lastWordRegex = new RegExp(`\\b${lastWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[.!?]?`, 'i');
          const m = searchWindow.match(lastWordRegex);
          if (m && typeof m.index === 'number') {
            end = searchStart + m.index + m[0].length;
          }
        }
      }

      // Expand if landing mid-word or missing trailing sentence punctuation
      while (end < page.text.length && /\w/.test(page.text[end])) {
        end++;
      }
      if (end < page.text.length && /[.!?:;,]/.test(page.text[end])) {
        end++;
      }

      const before = page.text.slice(0, start);
      const matched = page.text.slice(start, end);
      const after = page.text.slice(end);
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

    // 2. Whitespace-flexible and hyphenation-resilient regex match (handles line-wraps and embedded artifacts)
    const normalizedSnippet = normalizeSwissText(cleanSnippet).trim();

    const words = normalizedSnippet.split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 2) {
      const escapedWords = words.map(buildWordPattern);
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
      const escapedLeading = leadingWords.map(buildWordPattern);
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
      const escapedFolded = foldedWords.map(buildWordPattern);
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
        const escapedEntity = entityWords.map(buildWordPattern);
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
          const escapedFoldedEntity = foldedEntityWords.map(buildWordPattern);
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

    // 6. Long text phrase prefix & suffix match (resilient to subtle typography differences in long rationale sections)
    if (words.length >= 5) {
      const prefixWords = words.slice(0, 6);
      const escapedPrefix = prefixWords.map(buildWordPattern);
      try {
        const prefixRegex = new RegExp(escapedPrefix.join('\\s+'), 'i');
        const match = page.text.match(prefixRegex);
        if (match && typeof match.index === 'number') {
          const matchStart = match.index;
          let matchEnd = Math.min(page.text.length, matchStart + cleanSnippet.length);

          // Suffix anchor match to prevent premature hyphenation cuts
          const suffixWords = words.slice(-3);
          const escapedSuffix = suffixWords.map(buildWordPattern);
          const suffixRegex = new RegExp(escapedSuffix.join('\\s+'), 'i');
          const searchAfter = Math.max(matchStart, matchStart + Math.floor(cleanSnippet.length * 0.7));
          const textAfter = page.text.slice(searchAfter, Math.min(page.text.length, matchStart + cleanSnippet.length + 300));
          const suffixMatch = textAfter.match(suffixRegex);
          if (suffixMatch && typeof suffixMatch.index === 'number') {
            matchEnd = searchAfter + suffixMatch.index + suffixMatch[0].length;
          } else {
            // Expand past partial word if cut mid-word
            while (matchEnd < page.text.length && /\w/.test(page.text[matchEnd])) {
              matchEnd++;
            }
            if (matchEnd < page.text.length && /[.!?:;,]/.test(page.text[matchEnd])) {
              matchEnd++;
            }
          }

          const before = page.text.slice(0, matchStart);
          const matched = page.text.slice(matchStart, matchEnd);
          const after = page.text.slice(matchEnd);
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
            {isWebPortal ? 'Portal' : 'PDF'}
          </button>
          <button
            className={`preview-tab-btn ${docTab === 'text' ? 'active' : ''} ${textTabHint ? 'tab-hint-glow' : ''}`}
            onClick={() => {
              if (isWebPortal) return;
              onSetDocTab('text');
              if (parsedPages.length === 0) {
                onFetchParsedText(activeDoc?.url);
              }
            }}
            disabled={isWebPortal}
            title={isWebPortal ? 'Text extraction is unavailable for web portal consultation forms' : textTabHint ? 'Citation ready in Text view (click to view)' : undefined}
            style={isWebPortal ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
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
          {activeDoc?.url && !isWebPortal && (
            <a
              href={pdfProxyUrl}
              target="_blank"
              rel="noreferrer"
              className="open-pdf-link"
              title={`Open ${safePdfFilename} in new browser tab`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>Open PDF</span>
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
      ) : isWebPortal ? (
        <div className="preview-placeholder">
          <div className="portal-notice-card">
            <div className="portal-notice-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <h3 className="portal-notice-title">Web Consultation Portal</h3>
            <div className="portal-notice-doc-title">
              {activeDocTitle}
            </div>
            <p className="portal-notice-desc">
              This parliamentary affair is published directly on the cantonal web portal rather than as a static PDF document.
            </p>
            {portalUrl && (
              <div className="portal-notice-actions">
                <a
                  href={portalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-portal-action"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Open Cantonal Portal ({portalDomain})
                </a>
                <div className="portal-notice-disclaimer">
                  Note: Cantonal government firewalls may restrict access from non-Swiss IP addresses, or the external page may be unavailable / archived.
                </div>
              </div>
            )}
          </div>
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
        (() => {
          const isPortalDoc = parseError.toLowerCase().includes('web portal') || parseError.toLowerCase().includes('html');
          if (isPortalDoc) {
            return (
              <div className="preview-placeholder">
                <div
                  style={{
                    backgroundColor: '#161a22',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '1.5rem 1.75rem',
                    maxWidth: '460px',
                    textAlign: 'center',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      margin: '0 auto 10px auto',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94a3b8',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', marginBottom: '6px', lineHeight: 1.3 }}>
                    Web Consultation Document
                  </h3>
                  <p
                    style={{
                      fontSize: '14px',
                      color: '#94a3b8',
                      lineHeight: 1.5,
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      textAlign: 'left',
                      marginBottom: '16px',
                    }}
                  >
                    This parliamentary affair is published directly on the cantonal web portal rather than as a static PDF with paginated text.
                  </p>
                  <button
                    className="btn-secondary"
                    style={{
                      fontSize: '14px',
                      padding: '7px 16px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      color: '#94a3b8',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                    onClick={() => onSetDocTab('pdf')}
                  >
                    View Web Document
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div className="preview-placeholder">
              <div
                style={{
                  padding: '1.5rem 1.75rem',
                  backgroundColor: '#161a22',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#fca5a5',
                  maxWidth: '440px',
                  textAlign: 'center',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    margin: '0 auto 8px auto',
                    background: 'rgba(239, 68, 68, 0.12)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', marginBottom: '6px' }}>
                  Parsing Failed
                </h3>
                <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '14px', lineHeight: 1.45 }}>
                  {parseError}
                </p>
                {activeDoc?.url && (
                  <button
                    className="btn-primary"
                    style={{ fontSize: '14px', padding: '6px 14px' }}
                    onClick={() => onFetchParsedText(activeDoc.url)}
                  >
                    Retry Parsing
                  </button>
                )}
              </div>
            </div>
          );
        })()
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
