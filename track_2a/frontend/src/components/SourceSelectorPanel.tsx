import React from 'react';
import { CustomSelect } from './CustomSelect';
import { PRESET_BODY_OPTIONS, MATCH_MODES, getText, getAffairDocs } from '../constants';
import type { ParliamentaryAffairItem, DocumentItem, SamplePdfItem } from '../types';

interface SourceSelectorPanelProps {
  controlMode: 'samples' | 'api';
  onSetControlMode: (mode: 'samples' | 'api') => void;
  samplePdfs: SamplePdfItem[];
  selectedSampleFile: string;
  onSelectSample: (filename: string) => void;
  bodyKey: string;
  onSetBodyKey: (bodyKey: string) => void;
  searchQuery: string;
  onSetSearchQuery: (query: string) => void;
  searchMode: string;
  onSetSearchMode: (mode: string) => void;
  affairs: ParliamentaryAffairItem[];
  loading: boolean;
  selectedApiAffairId: number | null;
  onFetchAffairs: () => void;
  onSelectAffair: (affair: ParliamentaryAffairItem) => void;
  onSelectDoc: (doc: DocumentItem) => void;
  onSetSelectedApiAffairId: (id: number | null) => void;
}

export const SourceSelectorPanel: React.FC<SourceSelectorPanelProps> = ({
  controlMode,
  onSetControlMode,
  samplePdfs,
  selectedSampleFile,
  onSelectSample,
  bodyKey,
  onSetBodyKey,
  searchQuery,
  onSetSearchQuery,
  searchMode,
  onSetSearchMode,
  affairs,
  loading,
  selectedApiAffairId,
  onFetchAffairs,
  onSelectAffair,
  onSelectDoc,
  onSetSelectedApiAffairId,
}) => {
  const [hasSearched, setHasSearched] = React.useState(false);

  const handleSearch = () => {
    setHasSearched(true);
    onFetchAffairs();
  };

  return (
    <div className="studio-selector-panel">
      <div className="studio-panel-header">
        <div className="sidebar-tabs-header">
          <button
            className={`sidebar-tab-btn ${controlMode === 'samples' ? 'active' : ''}`}
            onClick={() => onSetControlMode('samples')}
            title="Browse 27 curated nationwide test samples"
          >
            27 Samples
          </button>
          <button
            className={`sidebar-tab-btn ${controlMode === 'api' ? 'active' : ''}`}
            onClick={() => onSetControlMode('api')}
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
                  onClick={() => onSelectSample(s.file_name)}
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
              <CustomSelect
                value={bodyKey}
                onChange={onSetBodyKey}
                options={PRESET_BODY_OPTIONS}
              />
            </div>

            <div className="sidebar-field-group">
              <label className="sidebar-field-label">Search Query</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Klima, Budget, Spital"
                value={searchQuery}
                onChange={(e) => onSetSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', alignItems: 'flex-end' }}>
              <div className="sidebar-field-group">
                <label className="sidebar-field-label">Match Mode</label>
                <CustomSelect
                  value={searchMode}
                  onChange={onSetSearchMode}
                  options={MATCH_MODES}
                />
              </div>
              <button
                className="btn-primary"
                style={{ padding: '0.55rem 0.5rem', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}
                onClick={handleSearch}
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
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                </div>
                <p>{hasSearched ? 'No affairs found' : 'Click Search to query affairs'}</p>
              </div>
            )}
            {affairs.map((affair) => {
              const isSelected = affair.id === selectedApiAffairId;
              const docsList = getAffairDocs(affair);
              return (
                <div
                  key={affair.id}
                  className={`affair-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectAffair(affair)}
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
                            onSetSelectedApiAffairId(affair.id);
                            onSelectDoc(doc);
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
  );
};
