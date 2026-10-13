import { useState, useEffect } from 'react';
import severinLogo from './assets/logo.png';
import { TelemetryBar } from './components/TelemetryBar';
import type {
  ParliamentaryAffairItem,
  DocumentItem,
  PdfPageItem,
  ParsePdfResponse,
  TelemetryStats,
  ExtractedAffair,
  ProvenanceReport,
  SamplePdfItem
} from './types';

// Prevalent Swiss parliamentary bodies for fast selection
const PRESET_BODIES = [
  { key: 'ZH', label: 'ZH — Zürich' },
  { key: 'GR', label: 'GR — Graubünden' },
  { key: 'GE', label: 'GE — Genève' },
  { key: 'BE', label: 'BE — Bern' },
  { key: 'BS', label: 'BS — Basel-Stadt' },
  { key: 'GL', label: 'GL — Glarus' },
  { key: 'CHE', label: 'CHE — Federal Assembly' },
];

/**
 * Safely extract text from OpenParlData fields that can be either
 * a plain string or a multilingual dictionary { de: '...', fr: '...' }.
 */
function getText(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val.de || val.fr || val.it || val.rm || val.en || Object.values(val)[0] || '';
  }
  return String(val);
}

/**
 * Normalizes documents from an affair into a clean array
 */
function getAffairDocs(affair: any): DocumentItem[] {
  if (!affair || !affair.docs) return [];
  const rawList = Array.isArray(affair.docs)
    ? affair.docs
    : (Array.isArray(affair.docs?.data) ? affair.docs.data : []);

  return rawList
    .map((d: any) => ({
      id: d.id,
      title: d.name || d.title || `Doc #${d.id}`,
      url: d.url_oparl || d.url || '',
      type: d.type || 'pdf',
      date: d.date,
    }))
    .filter((d: any) => Boolean(d.url));
}

export function App() {
  const [bodyKey, setBodyKey] = useState<string>('ZH');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchMode, setSearchMode] = useState<string>('partial');
  const [affairs, setAffairs] = useState<ParliamentaryAffairItem[]>([]);
  const [selectedAffairId, setSelectedAffairId] = useState<number | null>(null);
  const [activeDoc, setActiveDoc] = useState<DocumentItem | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Control mode: 'samples' (Curated Test Samples) vs 'api' (Live OpenParlData Query)
  const [controlMode, setControlMode] = useState<'samples' | 'api'>('samples');
  // Document panel tab: 'pdf' | 'text'
  const [docTab, setDocTab] = useState<'pdf' | 'text'>('pdf');
  const [parsedPages, setParsedPages] = useState<PdfPageItem[]>([]);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Apertus Extraction & Provenance states
  const [extractedAffair, setExtractedAffair] = useState<ExtractedAffair | null>(null);
  const [provenanceReport, setProvenanceReport] = useState<ProvenanceReport | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);
  const [copiedPage, setCopiedPage] = useState<number | null>(null);

  // Curated nationwide sample PDFs
  const [samplePdfs, setSamplePdfs] = useState<SamplePdfItem[]>([]);
  const [selectedSampleFile, setSelectedSampleFile] = useState<string>('');

  // CSCS Telemetry state
  const [telemetry, setTelemetry] = useState<TelemetryStats | null>(null);

  const fetchTelemetry = async () => {
    try {
      const resp = await fetch('/api/telemetry');
      if (resp.ok) {
        const data = await resp.json();
        setTelemetry(data);
      }
    } catch {
      // silently ignore polling failure
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch('/api/sample-pdfs')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SamplePdfItem[]) => {
        setSamplePdfs(data);
        if (data && data.length > 0 && !selectedSampleFile) {
          const sample = data[0];
          setSelectedSampleFile(sample.file_name);
          setBodyKey(sample.body_key);
          setActiveDoc({
            id: sample.doc_id,
            title: getText(sample.title) || sample.doc_name,
            url: sample.url,
            type: 'pdf',
          });
          setSelectedAffairId(sample.affair_id);
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectSample = (filename: string) => {
    setSelectedSampleFile(filename);
    if (filename) {
      const sample = samplePdfs.find((s) => s.file_name === filename);
      if (sample) {
        setBodyKey(sample.body_key);
        setActiveDoc({
          id: sample.doc_id,
          title: getText(sample.title) || sample.doc_name,
          url: sample.url,
          type: 'pdf',
        });
        setSelectedAffairId(sample.affair_id);
        setExtractedAffair(null);
        setProvenanceReport(null);
        setParsedPages([]);
        setExtractError(null);
        setDocTab('pdf');
      }
    }
  };

  const fetchParsedText = async (docUrl: string) => {
    if (!docUrl) return;
    setIsParsing(true);
    setParseError(null);
    try {
      const resp = await fetch(`/api/parse-pdf?url=${encodeURIComponent(docUrl)}`);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      const data: ParsePdfResponse = await resp.json();
      setParsedPages(data.pages || []);
    } catch (err: any) {
      setParseError(err.message || 'Failed to extract text from PDF');
    } finally {
      setIsParsing(false);
    }
  };

  const handleCopyPageText = (pageNum: number, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedPage(pageNum);
    setTimeout(() => setCopiedPage(null), 1500);
  };

  const handleExtract = async () => {
    if (!activeDoc?.url && !selectedSampleFile) return;
    setIsExtracting(true);
    setExtractError(null);
    try {
      const payload = selectedSampleFile
        ? { sample_file: selectedSampleFile, canton_hint: bodyKey, affair_id_hint: selectedAffairId }
        : { url: activeDoc?.url, canton_hint: bodyKey, affair_id_hint: selectedAffairId };

      const resp = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data = await resp.json();
      setExtractedAffair(data.affair);
      setProvenanceReport(data.provenance_report);
      if (data.telemetry) {
        setTelemetry(data.telemetry);
      } else {
        fetchTelemetry();
      }
    } catch (err: any) {
      setExtractError(err.message || 'Failed to extract affair with Apertus');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSelectDoc = (doc: DocumentItem) => {
    setActiveDoc(doc);
    setParsedPages([]);
    setParseError(null);
    setExtractedAffair(null);
    setProvenanceReport(null);
    setExtractError(null);
    if (docTab === 'text') {
      fetchParsedText(doc.url);
    }
  };

  const fetchAffairs = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({
        body_key: bodyKey,
        search_mode: searchMode,
        limit: '10',
        expand: 'docs',
      });
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const response = await fetch(`/api/affairs?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`API returned HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      const dataList = result.data || [];
      setAffairs(dataList);
      if (dataList.length > 0) {
        const firstWithDocs = dataList.find((a: any) => getAffairDocs(a).length > 0) || dataList[0];
        setSelectedAffairId(firstWithDocs.id);
        const docs = getAffairDocs(firstWithDocs);
        if (docs.length > 0) {
          handleSelectDoc(docs[0]);
          setDocTab('pdf');
        } else {
          setActiveDoc(null);
          setParsedPages([]);
        }
      } else {
        setSelectedAffairId(null);
        setActiveDoc(null);
        setParsedPages([]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch affairs');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAffair = (affair: ParliamentaryAffairItem) => {
    setSelectedAffairId(affair.id);
    setSelectedSampleFile('');
    const docs = getAffairDocs(affair);
    if (docs.length > 0) {
      handleSelectDoc(docs[0]);
      setDocTab('pdf');
    } else {
      setActiveDoc(null);
      setParsedPages([]);
    }
  };

  // Computed safe PDF filename and proxy URL for current document
  const rawTitle = activeDoc ? getText(activeDoc.title) || `doc_${activeDoc.id}` : 'document';
  const cleanTitle = rawTitle.replace(/[^a-zA-Z0-9_\u00C0-\u017F\u0400-\u04FF\s.-]/g, '_').trim().replace(/\s+/g, '_');
  const safePdfFilename = `${bodyKey ? `${bodyKey}_` : ''}${cleanTitle.toLowerCase().endsWith('.pdf') ? cleanTitle : `${cleanTitle}.pdf`}`;
  const pdfProxyUrl = `/api/pdf-proxy/${encodeURIComponent(safePdfFilename)}?url=${encodeURIComponent(activeDoc?.url || '')}${selectedSampleFile ? `&sample=${encodeURIComponent(selectedSampleFile)}` : ''}`;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <img src={severinLogo} alt="SEVERIN Logo" className="brand-logo" />
          <div className="brand-titles">
            <h1>SEVERIN</h1>
            <p>Swiss Parliamentary Affairs Extraction Platform</p>
          </div>
        </div>

        {/* Live CSCS Apertus Telemetry Bar with Hover Table */}
        <TelemetryBar telemetry={telemetry} />
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Error Alert */}
        {errorMsg && (
          <div
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              color: '#fca5a5',
              marginBottom: '1rem',
              fontSize: 'var(--font-size-base)',
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        {/* 3-Column Studio Layout:
            Column 1: Source Selector (27 Cantonal Samples & Live OpenParlData API)
            Column 2: Source Document Studio (PDF Viewer & Raw Text)
            Column 3: Apertus 1.5-8B Studio (Grounded Extraction & Provenance) */}
        <div className="content-grid">
          {/* Column 1: Source Selector Panel */}
          <div className="studio-selector-panel">
            <div className="studio-panel-header">
              <div className="sidebar-tabs-header">
                <button
                  className={`sidebar-tab-btn ${controlMode === 'samples' ? 'active' : ''}`}
                  onClick={() => setControlMode('samples')}
                  title="Browse 27 curated nationwide test samples"
                >
                  27 Samples
                </button>
                <button
                  className={`sidebar-tab-btn ${controlMode === 'api' ? 'active' : ''}`}
                  onClick={() => setControlMode('api')}
                  title="Live search via OpenParlData API"
                >
                  Live API
                </button>
              </div>
            </div>

            {/* Mode 1: Curated Test Samples */}
            {controlMode === 'samples' && (
              <div className="sidebar-sample-section">

                <div className="sidebar-sample-list">
                  {samplePdfs.map((s) => {
                    const isSelected = s.file_name === selectedSampleFile;
                    return (
                      <div
                        key={s.file_name}
                        className={`sample-item-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSelectSample(s.file_name)}
                      >
                        <div className="sample-item-header">
                          <span className="badge-body">{s.body_key}</span>
                          <span className="sample-item-level">{s.level || 'cantonal'}</span>
                        </div>
                        <div className="sample-item-title">
                          {getText(s.title) || s.doc_name}
                        </div>
                        <div className="sample-item-meta">
                          📄 {s.file_name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mode 2: Live OpenParlData API */}
            {controlMode === 'api' && (
              <div className="sidebar-api-section">
                <div className="sidebar-api-form">
                  <div className="sidebar-field-group">
                    <label className="sidebar-field-label">Parliamentary Body</label>
                    <select
                      className="form-control"
                      value={bodyKey}
                      onChange={(e) => setBodyKey(e.target.value)}
                    >
                      {PRESET_BODIES.map((b) => (
                        <option key={b.key} value={b.key}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sidebar-field-group">
                    <label className="sidebar-field-label">Search Query</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Klima, Budget, Spital"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchAffairs()}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', alignItems: 'flex-end' }}>
                    <div className="sidebar-field-group">
                      <label className="sidebar-field-label">Match Mode</label>
                      <select
                        className="form-control"
                        value={searchMode}
                        onChange={(e) => setSearchMode(e.target.value)}
                      >
                        <option value="partial">Partial</option>
                        <option value="exact">Exact</option>
                        <option value="natural">Natural</option>
                        <option value="boolean">Boolean</option>
                      </select>
                    </div>
                    <button
                      className="btn-primary"
                      style={{ padding: '0.55rem 0.5rem', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}
                      onClick={fetchAffairs}
                      disabled={loading}
                    >
                      {loading ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                </div>

                <div className="sidebar-affairs-list">
                  {affairs.length === 0 && !loading && (
                    <div className="sidebar-empty-hint">
                      <div className="empty-hint-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                          <circle cx="11" cy="11" r="8" />
                          <path d="m21 21-4.35-4.35" />
                        </svg>
                      </div>
                      <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No live affairs queried</p>
                      <p style={{ fontSize: 'var(--font-size-sm)', marginTop: '0.35rem', color: 'var(--text-muted)' }}>
                        Select a body and click <strong>Search</strong>.
                      </p>
                    </div>
                  )}
                  {affairs.map((affair) => {
                    const isSelected = affair.id === selectedAffairId;
                    const docsList = getAffairDocs(affair);
                    return (
                      <div
                        key={affair.id}
                        className={`affair-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSelectAffair(affair)}
                      >
                        <div className="affair-header">
                          <span className="badge-body">{affair.body_key}</span>
                          <span className="affair-short-id">
                            {affair.short_id || `#${affair.id}`}
                          </span>
                        </div>
                        <h4 className="affair-title" style={{ fontSize: 'var(--font-size-sm)' }}>
                          {getText(affair.title)}
                        </h4>
                        <div className="affair-meta">
                          {affair.begin_date && <span>{affair.begin_date}</span>}
                          {docsList.length > 0 && <span>{docsList.length} docs</span>}
                        </div>
                        {docsList.length > 0 && (
                          <div className="docs-tag-list" style={{ marginTop: '0.4rem' }}>
                            {docsList.map((doc) => (
                              <button
                                key={doc.id}
                                className="doc-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAffairId(affair.id);
                                  handleSelectDoc(doc);
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px', verticalAlign: '-1px' }}>
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                </svg>
                                {getText(doc.title) || `Doc ${doc.id}`}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Column 2: Source Document Studio */}
          <div className="studio-doc-panel">
            <div className="studio-panel-header">
              <div className="preview-tabs">
                <button
                  className={`preview-tab-btn ${docTab === 'pdf' ? 'active' : ''}`}
                  onClick={() => setDocTab('pdf')}
                >
                  PDF
                </button>
                <button
                  className={`preview-tab-btn ${docTab === 'text' ? 'active' : ''}`}
                  onClick={() => {
                    setDocTab('text');
                    if (activeDoc?.url && parsedPages.length === 0) {
                      fetchParsedText(activeDoc.url);
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
                    [{bodyKey}] {getText(activeDoc.title) || `Doc #${activeDoc.id}`}
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
            {docTab === 'pdf' && (
              activeDoc?.url || selectedSampleFile ? (
                <iframe
                  title="PDF Document Preview"
                  src={`${pdfProxyUrl}#view=FitH`}
                  className="preview-iframe"
                />
              ) : (
                <div className="preview-placeholder">
                  <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                  <p>Select a canton sample or query OpenParlData to preview document</p>
                </div>
              )
            )}

            {docTab === 'text' && (
              <div className="parsed-text-view">
                {isParsing && (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                    <p>⏳ Parsing document pages via pypdf...</p>
                  </div>
                )}

                {parseError && (
                  <div
                    style={{
                      padding: '1rem',
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid #ef4444',
                      borderRadius: '8px',
                      color: '#fca5a5',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    ⚠️ {parseError}
                  </div>
                )}

                {!isParsing && !parseError && parsedPages.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    <p style={{ marginBottom: '1rem' }}>Text has not been extracted for this document yet.</p>
                    <button
                      className="btn-primary"
                      onClick={() => activeDoc?.url && fetchParsedText(activeDoc.url)}
                    >
                      Extract Page Text
                    </button>
                  </div>
                )}

                {!isParsing &&
                  parsedPages.map((page) => (
                    <div key={page.page_number} className="parsed-page-card">
                      <div className="parsed-page-header">
                        <div className="parsed-page-header-left">
                          <span className="parsed-page-badge">PAGE {page.page_number}</span>
                          <span className="parsed-page-chars">{page.char_count.toLocaleString()} characters</span>
                        </div>
                        <button
                          className={`btn-copy-page ${copiedPage === page.page_number ? 'copied' : ''}`}
                          onClick={() => handleCopyPageText(page.page_number, page.text)}
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

          {/* Right Column: Apertus Extraction Studio */}
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
                    <button
                      className={`btn-extract ${isExtracting ? 'btn-extract-loading' : ''}`}
                      onClick={handleExtract}
                      disabled={isExtracting || (!activeDoc?.url && !selectedSampleFile)}
                      title="Re-run conservative extraction with Swiss-AI Apertus 1.5-8B on CSCS Alps Supercomputer"
                    >
                      {isExtracting ? 'Extracting...' : 'Re-run Extraction'}
                    </button>
                    <button
                      className="doc-btn"
                      onClick={() => setShowRawJson(!showRawJson)}
                      style={{ whiteSpace: 'nowrap', padding: '0.3rem 0.6rem', fontSize: 'var(--font-size-sm)' }}
                    >
                      {showRawJson ? 'Hide JSON' : 'JSON'}
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
                  <h3 style={{ color: '#ffffff', fontSize: 'var(--font-size-md)', marginBottom: '0.4rem' }}>
                    Apertus 1.5-8B Extraction in Progress
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', maxWidth: '440px' }}>
                    Running inference on CSCS Alps supercomputer GH200 nodes.
                    Validating strict schema and algorithmic provenance against physical PDF pages (temperature=0.0)...
                  </p>
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
                    onClick={handleExtract}
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
                  <h3 className="studio-hero-title">Apertus Grounded Extraction</h3>
                  <p className="studio-hero-desc">
                    Extract parliamentary affairs into the unified Swiss schema with verified citation grounding.
                  </p>
                  <button
                    className="btn-extract"
                    onClick={handleExtract}
                    disabled={!activeDoc?.url && !selectedSampleFile}
                  >
                    Run Apertus 1.5-8B Extraction
                  </button>
                  <div className="studio-hero-features">
                    <span className="studio-feature-pill">Algorithmic Provenance</span>
                    <span className="studio-feature-pill">Conservative Extraction</span>
                    <span className="studio-feature-pill">CSCS Alps GH200</span>
                    <span className="studio-feature-pill">26 Cantons + Bund</span>
                  </div>
                </div>
              )}

              {!isExtracting && extractedAffair && (
                <>
                  {/* Provenance Score Banner */}
                  <div className={`provenance-score-banner ${(provenanceReport?.provenance_score ?? 1.0) < 0.7 ? 'score-low' : ''}`}>
                    <div className="provenance-left">
                      <div className={`score-circle ${(provenanceReport?.provenance_score ?? 1.0) < 0.7 ? 'low' : ''}`}>
                        {Math.round((provenanceReport?.provenance_score ?? 1.0) * 100)}%
                      </div>
                      <div className="provenance-meta">
                        <h4>
                          <span>Conservative Grounded Extraction</span>
                          <span className="badge-tag" style={{ marginLeft: '0.5rem' }}>Swiss-AI Apertus</span>
                        </h4>
                        <p>
                          Strict conservative grounding • {provenanceReport?.verified_citations ?? 0} of {provenanceReport?.total_citations ?? 0} citations algorithmically verified against source text.
                        </p>
                      </div>
                    </div>
                    <div className="provenance-stats">
                      <div className="provenance-stat-pill">
                        Model: <strong>Apertus-8B</strong>
                      </div>
                      <div className="provenance-stat-pill">
                        Hardware: <strong>Alps GH200</strong>
                      </div>
                    </div>
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

                  {/* Raw JSON View */}
                  {showRawJson && (
                    <div className="extracted-card">
                      <div className="extracted-card-header">
                        <h3>Unified Pydantic Schema JSON</h3>
                      </div>
                      <pre className="raw-json-box">
                        {JSON.stringify(extractedAffair, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
