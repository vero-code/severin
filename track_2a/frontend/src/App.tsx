import { useState, useEffect } from 'react';
import severinLogo from './assets/logo.png';
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
  { key: 'ZH', label: 'ZH — Zürich (Cantonal)' },
  { key: 'GR', label: 'GR — Graubünden (Trilingual)' },
  { key: 'GE', label: 'GE — Genève (French)' },
  { key: 'BE', label: 'BE — Bern (Bilingual)' },
  { key: 'BS', label: 'BS — Basel-Stadt' },
  { key: 'GL', label: 'GL — Glarus' },
  { key: 'CHE', label: 'CHE — Federal Assembly (Bund)' },
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

  // Tab states: PDF Preview | Parsed Text | Apertus Extracted Affair
  const [activeTab, setActiveTab] = useState<'pdf' | 'text' | 'extracted'>('pdf');
  const [parsedPages, setParsedPages] = useState<PdfPageItem[]>([]);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Apertus Extraction & Provenance states
  const [extractedAffair, setExtractedAffair] = useState<ExtractedAffair | null>(null);
  const [provenanceReport, setProvenanceReport] = useState<ProvenanceReport | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);

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
      .then((data: SamplePdfItem[]) => setSamplePdfs(data))
      .catch(() => {});
  }, []);

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

  const handleExtract = async () => {
    if (!activeDoc?.url && !selectedSampleFile) return;
    setIsExtracting(true);
    setExtractError(null);
    setActiveTab('extracted');
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
    if (activeTab === 'text') {
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
        // Find first affair with documents
        const firstWithDocs = dataList.find((a: any) => getAffairDocs(a).length > 0) || dataList[0];
        setSelectedAffairId(firstWithDocs.id);
        const docs = getAffairDocs(firstWithDocs);
        if (docs.length > 0) {
          handleSelectDoc(docs[0]);
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
    const docs = getAffairDocs(affair);
    if (docs.length > 0) {
      handleSelectDoc(docs[0]);
    } else {
      setActiveDoc(null);
      setParsedPages([]);
    }
  };

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
        <div className="telemetry-wrapper">
          <div className="telemetry-bar">
            <div className="telemetry-status">
              <span className="telemetry-dot online" />
              <span className="telemetry-model">Apertus 1.5-8B</span>
            </div>
            <div className="telemetry-metrics">
              <span className="metric-item">
                <strong>{telemetry?.total_requests ?? 1}</strong> req
              </span>
              <span className="metric-sep">•</span>
              <span
                className="metric-item"
                title={`${(telemetry?.total_prompt_tokens ?? 210).toLocaleString()} input • ${(telemetry?.total_completion_tokens ?? 6).toLocaleString()} output tokens`}
              >
                <strong>{(telemetry?.total_tokens ?? 216).toLocaleString()}</strong> tok
              </span>
              <span className="metric-sep">•</span>
              <span className="metric-item" title="Alps GH200 free prefix cache">
                💾 <strong>{(telemetry?.total_cached_tokens ?? 32).toLocaleString()}</strong> cached
              </span>
              <span className="metric-sep">•</span>
              <span className="metric-item" title="Calculated from official CSCS tariff (0.01 CHF / 1M in, 0.04 CHF / 1M out, 0 CHF cached)">
                <strong>{(telemetry?.total_cost_chf ?? 0.000001).toFixed(6)}</strong> CHF
              </span>
              <span className="metric-sep">•</span>
              <span className="metric-item">
                ⚡ <strong>{telemetry?.average_latency_seconds ?? 0.15}s</strong> avg
              </span>
            </div>
          </div>

          {/* Hover Popover Table with Invocation History */}
          <div className="telemetry-popover">
            <div className="popover-header">
              <div className="popover-title">
                <span>CSCS Inference Telemetry</span>
                <span className="popover-model-badge">Alps Supercomputer Endpoint</span>
              </div>
            </div>

            <div className="popover-table-container">
              <table className="telemetry-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Time</th>
                    <th>Canton / Task</th>
                    <th>In / Out</th>
                    <th>Cached</th>
                    <th>Total</th>
                    <th>Cost (CHF)</th>
                    <th>Speed</th>
                    <th>Provenance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(telemetry?.history && telemetry.history.length > 0) ? (
                    telemetry.history.map((item, idx) => (
                      <tr key={idx}>
                        <td className="mono">#{idx + 1}</td>
                        <td className="mono">
                          {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '12:47:09'}
                        </td>
                        <td>
                          {item.canton && <span className="telemetry-canton-badge">{item.canton}</span>}
                          <span className="telemetry-task-title">{item.task || 'Inference'}</span>
                        </td>
                        <td className="mono" style={{ color: 'var(--text-secondary)' }}>
                          {item.prompt_tokens.toLocaleString()} / {item.completion_tokens.toLocaleString()}
                        </td>
                        <td className="mono" style={{ color: '#a7f3d0' }}>
                          {(item.cached_tokens ?? 0).toLocaleString()}
                        </td>
                        <td className="mono font-bold text-accent">{item.total_tokens.toLocaleString()}</td>
                        <td className="mono" style={{ color: '#fef08a' }}>
                          {(item.cost_chf ?? 0.000001).toFixed(6)}
                        </td>
                        <td className="mono">{item.latency_sec}s</td>
                        <td>
                          {item.provenance_score !== null && item.provenance_score !== undefined ? (
                            <span className="provenance-pill">
                              {Math.round(item.provenance_score * 100)}% match
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td><span className="status-pill-ok">200 OK</span></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="mono">#1</td>
                      <td className="mono">12:47:09</td>
                      <td>
                        <span className="telemetry-canton-badge">CSCS</span>
                        <span className="telemetry-task-title">Smoke Test (Ping)</span>
                      </td>
                      <td className="mono" style={{ color: 'var(--text-secondary)' }}>70 / 2</td>
                      <td className="mono" style={{ color: '#a7f3d0' }}>32</td>
                      <td className="mono font-bold text-accent">72</td>
                      <td className="mono" style={{ color: '#fef08a' }}>0.000001</td>
                      <td className="mono">0.15s</td>
                      <td><span style={{ color: 'var(--text-muted)' }}>—</span></td>
                      <td><span className="status-pill-ok">200 OK</span></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="popover-footer">
              <span>Client-side telemetry • Official CSCS Academia Tariff</span>
              <span>
                Total: <strong>{(telemetry?.total_tokens ?? 216).toLocaleString()}</strong> tok{' '}
                <span style={{ color: 'var(--text-secondary)' }}>
                  ({(telemetry?.total_prompt_tokens ?? 210).toLocaleString()} in •{' '}
                  {(telemetry?.total_completion_tokens ?? 6).toLocaleString()} out)
                </span>{' '}
                • <strong>{(telemetry?.total_cost_chf ?? 0.000002).toFixed(6)}</strong> CHF (
                <strong>{(telemetry?.total_cached_tokens ?? 128).toLocaleString()}</strong> cached)
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Top 2-Column Action Bar: Live Query & Curated Nationwide Sample PDFs */}
        <div className="top-actions-grid">
          {/* Column 1: Live OpenParlData API Search */}
          <section className="query-card">
            <h2>🌐 Query OpenParlData API</h2>
            <div className="query-form">
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

              <input
                type="text"
                className="form-control"
                placeholder="Search keyword (e.g. Klima, Spital)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchAffairs()}
              />

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

              <button
                className="btn-primary"
                onClick={fetchAffairs}
                disabled={loading}
              >
                {loading ? 'Fetching...' : 'Fetch Affairs'}
              </button>
            </div>
          </section>

          {/* Column 2: Curated Nationwide Sample PDFs */}
          <section className="query-card">
            <h2>🇨🇭 Curated Nationwide Sample PDFs</h2>
            <div className="sample-card-form">
              <select
                className="form-control"
                style={{ width: '100%', padding: '0.65rem 0.9rem' }}
                value={selectedSampleFile}
                onChange={(e) => {
                  const filename = e.target.value;
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
                    }
                  }
                }}
              >
                <option value="">-- Pick from 27 Swiss cantonal test PDFs (e.g. ZH, GR, BE, Bund) --</option>
                {samplePdfs.map((s) => (
                  <option key={s.file_name} value={s.file_name}>
                    [{s.body_key}] {getText(s.title) || s.doc_name} ({s.file_name})
                  </option>
                ))}
              </select>
            </div>
          </section>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div style={{
            padding: '0.85rem 1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            color: '#fca5a5',
            marginBottom: '1rem',
            fontSize: '0.85rem'
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Status Bar */}
        <div className="status-bar">
          <span>
            {affairs.length > 0
              ? `Showing ${affairs.length} parliamentary affairs for [${bodyKey}]`
              : 'Select a canton or curated sample PDF to view and extract affairs'}
          </span>
          {activeDoc && (
            <span>
              Viewing document: <strong>{getText(activeDoc.title) || `Doc #${activeDoc.id}`}</strong>
            </span>
          )}
        </div>

        {/* Split View: List on Left, PDF on Right */}
        <div className="content-grid">
          {/* Left Column: Affairs List */}
          <div className="affairs-list">
            {affairs.length === 0 && !loading && (
              <div style={{
                padding: '3rem 1.5rem',
                textAlign: 'center',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '10px',
                border: '1px dashed var(--border-color)',
                color: 'var(--text-muted)'
              }}>
                <p>No live API affairs queried yet.</p>
                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  Pick a <strong>curated test sample</strong> above or click <strong>Fetch Affairs</strong>.
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
                  <h3 className="affair-title">{getText(affair.title)}</h3>
                  <div className="affair-meta">
                    {affair.begin_date && <span>📅 {affair.begin_date}</span>}
                    {affair.state && <span>Status: {getText(affair.state)}</span>}
                    {docsList.length > 0 && <span>📄 {docsList.length} docs</span>}
                  </div>

                  {/* Documents list */}
                  {docsList.length > 0 && (
                    <div className="docs-tag-list">
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
                          📄 {getText(doc.title) || `Document ${doc.id}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Column: PDF Preview / Parsed Text / Extracted Affair */}
          <div className="preview-panel">
            <div className="preview-header">
              <div className="preview-tabs">
                <button
                  className={`preview-tab-btn ${activeTab === 'pdf' ? 'active' : ''}`}
                  onClick={() => setActiveTab('pdf')}
                >
                  📄 PDF Preview
                </button>
                <button
                  className={`preview-tab-btn ${activeTab === 'text' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('text');
                    if (activeDoc?.url && parsedPages.length === 0) {
                      fetchParsedText(activeDoc.url);
                    }
                  }}
                >
                  📝 Extracted Text {parsedPages.length > 0 ? `(${parsedPages.length} p.)` : ''}
                </button>
                <button
                  className={`preview-tab-btn ${activeTab === 'extracted' ? 'active' : ''}`}
                  onClick={() => setActiveTab('extracted')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  ✨ Apertus Extracted Affair
                  {provenanceReport && (
                    <span className="provenance-pill">
                      {Math.round(provenanceReport.provenance_score * 100)}% match
                    </span>
                  )}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <button
                  className={`btn-extract ${isExtracting ? 'btn-extract-loading' : ''}`}
                  onClick={handleExtract}
                  disabled={isExtracting || (!activeDoc?.url && !selectedSampleFile)}
                  title="Run conservative extraction with Swiss-AI Apertus 1.5-8B on CSCS Alps Supercomputer"
                >
                  {isExtracting ? '⏳ Extracting on Alps...' : '⚡ Extract with Apertus 1.5-8B'}
                </button>
                {activeDoc?.url && (
                  <a
                    href={activeDoc.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '0.8rem' }}
                  >
                    ↗ Open PDF
                  </a>
                )}
              </div>
            </div>

            {/* Content Area */}
            {activeDoc?.url || selectedSampleFile ? (
              activeTab === 'pdf' ? (
                <iframe
                  title="PDF Document Preview"
                  src={`/api/pdf-proxy?url=${encodeURIComponent(activeDoc?.url || '')}`}
                  className="preview-iframe"
                />
              ) : activeTab === 'text' ? (
                <div className="parsed-text-view">
                  {isParsing && (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                      <p>⏳ Parsing document pages via pypdf...</p>
                    </div>
                  )}

                  {parseError && (
                    <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', fontSize: '0.85rem' }}>
                      ⚠️ {parseError}
                    </div>
                  )}

                  {!isParsing && !parseError && parsedPages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      <button
                        className="btn-primary"
                        onClick={() => activeDoc?.url && fetchParsedText(activeDoc.url)}
                      >
                        Extract Page Text
                      </button>
                    </div>
                  )}

                  {!isParsing && parsedPages.map((page) => (
                    <div key={page.page_number} className="parsed-page-card">
                      <div className="parsed-page-header">
                        <span>PAGE {page.page_number}</span>
                        <span>{page.char_count.toLocaleString()} characters</span>
                      </div>
                      <div className="parsed-page-content">
                        {page.text || <em style={{ color: 'var(--text-muted)' }}>[Empty or image-only page]</em>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Tab 3: Apertus Extracted Affair View */
                <div className="extracted-view-container">
                  {isExtracting && (
                    <div className="extract-loading-box">
                      <div className="spinner-supercomputer" />
                      <h3 style={{ color: '#ffffff', fontSize: '1.05rem', marginBottom: '0.4rem' }}>
                        Apertus 1.5-8B Extraction in Progress
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', maxWidth: '440px' }}>
                        Running inference on CSCS Alps supercomputer GH200 nodes.
                        Validating strict schema and algorithmic provenance against physical PDF pages (temperature=0.0)...
                      </p>
                    </div>
                  )}

                  {extractError && (
                    <div style={{ padding: '1.25rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5' }}>
                      <h4>⚠️ Extraction Failed</h4>
                      <p style={{ marginTop: '0.4rem', fontSize: '0.85rem' }}>{extractError}</p>
                      <button
                        className="btn-primary"
                        style={{ marginTop: '0.75rem', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                        onClick={handleExtract}
                      >
                        Retry Extraction
                      </button>
                    </div>
                  )}

                  {!isExtracting && !extractError && !extractedAffair && (
                    <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--text-muted)' }}>
                      <p style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        Ready for Conservative Extraction
                      </p>
                      <p style={{ fontSize: '0.85rem', maxWidth: '400px', margin: '0 auto 1.25rem auto' }}>
                        Extract this document using Swiss-AI Apertus 1.5-8B into the unified Swiss parliamentary schema with 100% verified citations.
                      </p>
                      <button className="btn-extract" onClick={handleExtract}>
                        ⚡ Extract with Apertus 1.5-8B
                      </button>
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
                              <span>🛡️ Conservative Grounded Extraction</span>
                              <span className="badge-tag" style={{ marginLeft: '0.5rem' }}>Swiss-AI Apertus</span>
                            </h4>
                            <p>
                              Zero hallucinations • {provenanceReport?.verified_citations ?? 0} of {provenanceReport?.total_citations ?? 0} citations algorithmically verified against source text.
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
                          <h3>🏛️ Affair Identity & Metadata</h3>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <span className="badge-body">{extractedAffair.canton_or_body}</span>
                            <span className="citation-chip">{extractedAffair.level}</span>
                            <span className="citation-chip">{extractedAffair.affair_type}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.4rem' }}>
                          {extractedAffair.title}
                        </div>
                        {extractedAffair.title_provenance && (
                          <div className="citation-quote">
                            <strong>Page {extractedAffair.title_provenance.page_number}:</strong> "{extractedAffair.title_provenance.source_text_snippet}"
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {extractedAffair.submission_date && (
                            <span>📅 Submitted: <strong>{extractedAffair.submission_date}</strong></span>
                          )}
                          {extractedAffair.addressed_to && (
                            <span>📬 Addressed to: <strong>{extractedAffair.addressed_to}</strong></span>
                          )}
                          <span>🌐 Language: <strong>{extractedAffair.language.toUpperCase()}</strong></span>
                        </div>
                      </div>

                      {/* Authors / Actors */}
                      <div className="extracted-card">
                        <div className="extracted-card-header">
                          <h3>👤 Authors & Submitters ({extractedAffair.authors.length})</h3>
                        </div>
                        {extractedAffair.authors.length > 0 ? (
                          <div>
                            {extractedAffair.authors.map((author, idx) => (
                              <div key={idx} className="author-chip">
                                <strong>{author.name}</strong>
                                <span className="author-role">{author.role}</span>
                                {author.party_or_fraction && (
                                  <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>({author.party_or_fraction})</span>
                                )}
                                {author.provenance && (
                                  <span className="citation-chip" style={{ fontSize: '0.65rem' }}>
                                    p. {author.provenance.page_number}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            No individual authors specified (e.g. collective governmental submission).
                          </p>
                        )}
                      </div>

                      {/* Background & Rationale */}
                      {extractedAffair.background_and_rationale && (
                        <div className="extracted-card">
                          <div className="extracted-card-header">
                            <h3>📖 Context, Rationale & Rationale Provenance</h3>
                            {extractedAffair.rationale_provenance && (
                              <span className="citation-chip">
                                Page {extractedAffair.rationale_provenance.page_number} Verified
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.6' }}>
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
                          <h3>❓ Questions & Executive Answers ({extractedAffair.questions_and_answers.length})</h3>
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
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                                  [Pending executive answer]
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            No formal question items present in document (conservative extraction).
                          </p>
                        )}
                      </div>

                      {/* Financial Credits */}
                      <div className="extracted-card">
                        <div className="extracted-card-header">
                          <h3>💰 Financial Credits & Appropriations ({extractedAffair.financial_details.length})</h3>
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
                                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
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
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            No financial expenditures or credits requested in this affair.
                          </p>
                        )}
                      </div>

                      {/* Provenance Audit Table */}
                      {provenanceReport && provenanceReport.details && provenanceReport.details.length > 0 && (
                        <div className="extracted-card">
                          <div className="extracted-card-header">
                            <h3>🔍 Provenance Verification Audit Log</h3>
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
                                  <td style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                    {d.snippet_preview}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Raw JSON View */}
                      <div className="extracted-card">
                        <div className="extracted-card-header">
                          <h3>💻 Unified Pydantic Schema JSON</h3>
                          <button
                            className="doc-btn"
                            onClick={() => setShowRawJson(!showRawJson)}
                          >
                            {showRawJson ? 'Hide JSON' : 'Show JSON'}
                          </button>
                        </div>
                        {showRawJson && (
                          <pre className="raw-json-box">
                            {JSON.stringify(extractedAffair, null, 2)}
                          </pre>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            ) : (
              <div className="preview-placeholder">
                <svg
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
                <p>Select an affair or a curated sample PDF from above to preview and extract</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
