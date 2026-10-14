import { useState, useEffect } from 'react';
import { AppHeader } from './components/AppHeader';
import { SourceSelectorPanel } from './components/SourceSelectorPanel';
import { DocumentStudioPanel } from './components/DocumentStudioPanel';
import { ExtractionStudioPanel } from './components/ExtractionStudioPanel';
import { FaqModal } from './components/FaqModal';
import { AppFooter } from './components/AppFooter';
import { getText, getAffairDocs } from './constants';
import type {
  ParliamentaryAffairItem,
  DocumentItem,
  PdfPageItem,
  ParsePdfResponse,
  TelemetryStats,
  ExtractedAffair,
  ProvenanceReport,
  SamplePdfItem,
  ActiveProvenance,
} from './types';

// Per-page-load revision appended to iframe URLs so stale cached PDF responses are never reused
const PROXY_CACHE_REV = Date.now().toString(36);

export function App() {
  const [bodyKey, setBodyKey] = useState<string>('ZH');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchMode, setSearchMode] = useState<string>('partial');
  const [affairs, setAffairs] = useState<ParliamentaryAffairItem[]>([]);
  const [selectedApiAffairId, setSelectedApiAffairId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Control mode: 'samples' (Curated Test Samples) vs 'api' (Live OpenParlData Query)
  const [controlMode, setControlMode] = useState<'samples' | 'api'>('samples');
  // Document panel tab: 'pdf' | 'text'
  const [docTab, setDocTab] = useState<'pdf' | 'text'>('pdf');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Apertus Extraction & Provenance states
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);
  const [copiedPage, setCopiedPage] = useState<number | null>(null);
  const [selectedProvenance, setSelectedProvenance] = useState<ActiveProvenance | null>(null);
  const [hoveredProvenance, setHoveredProvenance] = useState<ActiveProvenance | null>(null);
  const activeProvenance = hoveredProvenance || selectedProvenance;
  const [textTabHint, setTextTabHint] = useState<boolean>(false);

  // Platform Guide & Architecture FAQ modal
  const [showFaqModal, setShowFaqModal] = useState<boolean>(false);

  // Curated nationwide sample PDFs context
  const [samplePdfs, setSamplePdfs] = useState<SamplePdfItem[]>([]);
  const [selectedSampleFile, setSelectedSampleFile] = useState<string>('');
  const [sampleDoc, setSampleDoc] = useState<DocumentItem | null>(null);
  const [sampleAffairId, setSampleAffairId] = useState<number | null>(null);
  const [sampleCanton, setSampleCanton] = useState<string>('ZH');
  const [sampleExtractedAffair, setSampleExtractedAffair] = useState<ExtractedAffair | null>(null);
  const [sampleProvenanceReport, setSampleProvenanceReport] = useState<ProvenanceReport | null>(null);
  const [sampleParsedPages, setSampleParsedPages] = useState<PdfPageItem[]>([]);

  // Live OpenParlData API context
  const [apiDoc, setApiDoc] = useState<DocumentItem | null>(null);
  const [selectedApiAffairBody, setSelectedApiAffairBody] = useState<string>('ZH');
  const [apiExtractedAffair, setApiExtractedAffair] = useState<ExtractedAffair | null>(null);
  const [apiProvenanceReport, setApiProvenanceReport] = useState<ProvenanceReport | null>(null);
  const [apiParsedPages, setApiParsedPages] = useState<PdfPageItem[]>([]);

  // CSCS Telemetry state
  const [telemetry, setTelemetry] = useState<TelemetryStats | null>(null);

  // Derived active context based on selected mode
  const isSampleMode = controlMode === 'samples';
  const activeDoc = isSampleMode ? sampleDoc : apiDoc;
  const currentSampleFile = isSampleMode ? selectedSampleFile : '';
  const selectedAffair = affairs.find((a) => a.id === selectedApiAffairId);
  const currentBodyKey = isSampleMode ? sampleCanton : (selectedAffair?.body_key || selectedApiAffairBody);
  const currentAffairId = isSampleMode ? sampleAffairId : selectedApiAffairId;
  const extractedAffair = isSampleMode ? sampleExtractedAffair : apiExtractedAffair;
  const provenanceReport = isSampleMode ? sampleProvenanceReport : apiProvenanceReport;
  const parsedPages = isSampleMode ? sampleParsedPages : apiParsedPages;

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
      })
      .catch(() => {});
  }, []);

  const handleSelectSample = (filename: string) => {
    if (selectedSampleFile === filename) {
      setSelectedSampleFile('');
      setSampleDoc(null);
      setSampleAffairId(null);
      setSampleExtractedAffair(null);
      setSampleProvenanceReport(null);
      setSampleParsedPages([]);
      setExtractError(null);
      setSelectedProvenance(null);
      setHoveredProvenance(null);
      return;
    }

    setSelectedSampleFile(filename);
    setSelectedProvenance(null);
    setHoveredProvenance(null);
    if (filename) {
      const sample = samplePdfs.find((s) => s.file_name === filename);
      const title = sample ? (getText(sample.title) || sample.doc_name) : filename;
      const canton = sample ? sample.body_key : filename.split('_')[0] || 'CH';
      setSampleCanton(canton);
      setSampleDoc({
        id: sample?.doc_id || 0,
        title,
        url: sample?.url || '',
        type: 'pdf',
      });
      setSampleAffairId(sample?.affair_id || null);
      setSampleExtractedAffair(null);
      setSampleProvenanceReport(null);
      setSampleParsedPages([]);
      setExtractError(null);
      setDocTab('pdf');
    }
  };

  const fetchParsedText = async (docUrl?: string) => {
    const targetFile = currentSampleFile;
    const targetUrl = docUrl || activeDoc?.url || '';
    setIsParsing(true);
    setParseError(null);
    try {
      const query = targetFile
        ? `sample=${encodeURIComponent(targetFile)}`
        : `url=${encodeURIComponent(targetUrl)}`;
      const resp = await fetch(`/api/parse-pdf?${query}`);
      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.detail || `HTTP ${resp.status}: ${resp.statusText}`);
      }
      const data: ParsePdfResponse = await resp.json();
      if (isSampleMode) {
        setSampleParsedPages(data.pages || []);
      } else {
        setApiParsedPages(data.pages || []);
      }
    } catch (err: any) {
      console.error(`❌ [PDF Parse Failed]:`, err.message);
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

  const handleClearProvenance = () => {
    setSelectedProvenance(null);
    setHoveredProvenance(null);
  };

  const handleSetDocTab = (tab: 'pdf' | 'text') => {
    setDocTab(tab);
    if (tab === 'text') {
      setTextTabHint(false);
      if (parsedPages.length === 0 && (activeDoc?.url || currentSampleFile)) {
        fetchParsedText(activeDoc?.url);
      }
    }
  };

  const handleHoverProvenance = (prov: ActiveProvenance | null) => {
    setHoveredProvenance(prov);
    if (prov) {
      if (docTab !== 'text') {
        setDocTab('text');
      }
      setTextTabHint(false);
      if (parsedPages.length === 0 && (activeDoc?.url || currentSampleFile)) {
        fetchParsedText(activeDoc?.url);
      }
    }
  };

  const handleExtract = async () => {
    if (!activeDoc?.url && !currentSampleFile) return;
    setIsExtracting(true);
    setExtractError(null);
    try {
      const payload = currentSampleFile
        ? { sample_file: currentSampleFile, canton_hint: currentBodyKey, affair_id_hint: currentAffairId }
        : { url: activeDoc?.url, canton_hint: currentBodyKey, affair_id_hint: currentAffairId };

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
      if (isSampleMode) {
        setSampleExtractedAffair(data.affair);
        setSampleProvenanceReport(data.provenance_report);
        if (data.provenance_report?.pages) {
          setSampleParsedPages(data.provenance_report.pages);
        }
      } else {
        setApiExtractedAffair(data.affair);
        setApiProvenanceReport(data.provenance_report);
        if (data.provenance_report?.pages) {
          setApiParsedPages(data.provenance_report.pages);
        }
      }

      if (data.telemetry) {
        setTelemetry(data.telemetry);
      } else {
        fetchTelemetry();
      }
    } catch (err: any) {
      console.error(`❌ [Extraction Failed]:`, err.message);
      setExtractError(err.message || 'Failed to extract affair with Apertus');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSelectDoc = (doc: DocumentItem) => {
    setApiDoc(doc);
    setApiParsedPages([]);
    setParseError(null);
    setApiExtractedAffair(null);
    setApiProvenanceReport(null);
    setExtractError(null);
    setSelectedProvenance(null);
    setHoveredProvenance(null);
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
        setSelectedApiAffairId(firstWithDocs.id);
        setSelectedApiAffairBody(firstWithDocs.body_key);
        const docs = getAffairDocs(firstWithDocs);
        if (docs.length > 0) {
          handleSelectDoc(docs[0]);
          setDocTab('pdf');
        } else {
          setApiDoc(null);
          setApiParsedPages([]);
        }
      } else {
        setSelectedApiAffairId(null);
        setApiDoc(null);
        setApiParsedPages([]);
      }
    } catch (err: any) {
      console.error(`❌ [OpenParlData Search Failed]:`, err.message);
      setErrorMsg(err.message || 'Failed to fetch affairs');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAffair = (affair: ParliamentaryAffairItem) => {
    const docs = getAffairDocs(affair);
    setSelectedApiAffairId(affair.id);
    setSelectedApiAffairBody(affair.body_key);
    if (docs.length > 0) {
      handleSelectDoc(docs[0]);
      setDocTab('pdf');
    } else {
      setApiDoc(null);
      setApiParsedPages([]);
    }
  };

  // Computed safe PDF filename and proxy URL for current document
  const rawTitle = activeDoc ? getText(activeDoc.title) || `doc_${activeDoc.id}` : 'document';
  const cleanTitle = rawTitle.replace(/[^a-zA-Z0-9_\u00C0-\u017F\u0400-\u04FF\s.-]/g, '_').trim().replace(/\s+/g, '_');
  const safePdfFilename = `${currentBodyKey ? `${currentBodyKey}_` : ''}${cleanTitle.toLowerCase().endsWith('.pdf') ? cleanTitle : `${cleanTitle}.pdf`}`;
  const pdfProxyUrl = `/api/pdf-proxy/${encodeURIComponent(safePdfFilename)}?url=${encodeURIComponent(activeDoc?.url || '')}${currentSampleFile ? `&sample=${encodeURIComponent(currentSampleFile)}` : ''}&rev=${PROXY_CACHE_REV}`;

  return (
    <div className="app-container">
      {/* Header Component */}
      <AppHeader telemetry={telemetry} onOpenGuide={() => setShowFaqModal(true)} />

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

        {/* 3-Column Studio Layout */}
        <div className="content-grid">
          {/* Column 1: Source Selector Panel */}
          <SourceSelectorPanel
            controlMode={controlMode}
            onSetControlMode={setControlMode}
            samplePdfs={samplePdfs}
            selectedSampleFile={selectedSampleFile}
            onSelectSample={handleSelectSample}
            bodyKey={bodyKey}
            onSetBodyKey={setBodyKey}
            searchQuery={searchQuery}
            onSetSearchQuery={setSearchQuery}
            searchMode={searchMode}
            onSetSearchMode={setSearchMode}
            affairs={affairs}
            loading={loading}
            selectedApiAffairId={selectedApiAffairId}
            selectedApiDocId={apiDoc?.id}
            onFetchAffairs={fetchAffairs}
            onSelectAffair={handleSelectAffair}
            onSelectDoc={handleSelectDoc}
            onSetSelectedApiAffairId={setSelectedApiAffairId}
          />

          {/* Column 2: Source Document Studio */}
          <DocumentStudioPanel
            docTab={docTab}
            onSetDocTab={handleSetDocTab}
            activeDoc={activeDoc}
            currentSampleFile={currentSampleFile}
            currentBodyKey={currentBodyKey}
            safePdfFilename={safePdfFilename}
            pdfProxyUrl={pdfProxyUrl}
            controlMode={controlMode}
            parsedPages={parsedPages}
            isParsing={isParsing}
            parseError={parseError}
            onFetchParsedText={fetchParsedText}
            copiedPage={copiedPage}
            onCopyPageText={handleCopyPageText}
            activeProvenance={activeProvenance}
            textTabHint={textTabHint}
            onClearProvenance={handleClearProvenance}
          />

          {/* Column 3: Apertus 1.5-8B Studio */}
          <ExtractionStudioPanel
            isExtracting={isExtracting}
            extractError={extractError}
            onExtract={handleExtract}
            canExtract={Boolean(activeDoc?.url || currentSampleFile)}
            extractedAffair={extractedAffair}
            provenanceReport={provenanceReport}
            showRawJson={showRawJson}
            onToggleRawJson={() => setShowRawJson(!showRawJson)}
            onSetRawJson={setShowRawJson}
            activeProvenance={activeProvenance}
            onHoverProvenance={handleHoverProvenance}
          />
        </div>
      </main>

      {/* Footer Attribution & Links */}
      <AppFooter />

      {/* Platform Guide & Architecture FAQ Modal */}
      <FaqModal isOpen={showFaqModal} onClose={() => setShowFaqModal(false)} />
    </div>
  );
}

export default App;
