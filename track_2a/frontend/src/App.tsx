import { useState } from 'react';
import severinLogo from './assets/logo.png';
import type { ParliamentaryAffairItem, DocumentItem } from './types';

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
          setActiveDoc(docs[0]);
        } else {
          setActiveDoc(null);
        }
      } else {
        setSelectedAffairId(null);
        setActiveDoc(null);
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
      setActiveDoc(docs[0]);
    } else {
      setActiveDoc(null);
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
        <span className="badge-tag">Track 2A • Hack Apertus 2026</span>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Search & Query Bar */}
        <section className="query-card">
          <h2>Query OpenParlData API</h2>
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
              placeholder="Search keyword (e.g. Klima, Spital, Energie, Schule)..."
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
              : 'Click "Fetch Affairs" to query live records via OpenParlData API client'}
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
                <p>No affairs loaded yet.</p>
                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  Select a body (e.g. ZH or GR) and click <strong>Fetch Affairs</strong>.
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
                            setActiveDoc(doc);
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

          {/* Right Column: PDF Preview */}
          <div className="preview-panel">
            <div className="preview-header">
              <span>PDF Viewer</span>
              {activeDoc?.url && (
                <a
                  href={activeDoc.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '0.8rem' }}
                >
                  ↗ Open original file
                </a>
              )}
            </div>

            {activeDoc?.url ? (
              <iframe
                title="PDF Document Preview"
                src={`/api/pdf-proxy?url=${encodeURIComponent(activeDoc.url)}`}
                className="preview-iframe"
              />
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
                <p>Select an affair with attached documents to view the PDF</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
