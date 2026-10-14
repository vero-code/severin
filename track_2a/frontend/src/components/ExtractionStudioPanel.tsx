import React from 'react';
import type { ExtractedAffair, ProvenanceReport, ActiveProvenance } from '../types';
import { normalizeSwissText } from '../utils/textNormalization';
import {
  ExtractionIdleHero,
  ExtractionJsonInspector,
  ProvenanceTrustStrip,
  ExtractionHeaderCard,
  ExtractionAuthorsCard,
  ExtractionRationaleCard,
  ExtractionQuestionsCard,
  ExtractionFinancialCard,
} from './extraction';

export const normalizeGlyphs = normalizeSwissText;

export interface ExtractionStudioPanelProps {
  isExtracting: boolean;
  extractError: string | null;
  onExtract: () => void;
  canExtract: boolean;
  extractedAffair: ExtractedAffair | null;
  provenanceReport: ProvenanceReport | null;
  showRawJson: boolean;
  onToggleRawJson: () => void;
  onSetRawJson?: (show: boolean) => void;
  activeProvenance?: ActiveProvenance | null;
  onHoverProvenance?: (prov: ActiveProvenance | null) => void;
}

export const ExtractionStudioPanel: React.FC<ExtractionStudioPanelProps> = ({
  isExtracting,
  extractError,
  onExtract,
  canExtract,
  extractedAffair,
  provenanceReport,
  showRawJson,
  onToggleRawJson,
  onSetRawJson,
  activeProvenance,
  onHoverProvenance,
}) => {
  const handleSelectView = (view: 'cards' | 'json') => {
    if (view === 'cards' && showRawJson) {
      if (onSetRawJson) onSetRawJson(false);
      else onToggleRawJson();
    } else if (view === 'json' && !showRawJson) {
      if (onSetRawJson) onSetRawJson(true);
      else onToggleRawJson();
    }
  };

  return (
    <div className="studio-extraction-panel">
      {/* Studio Header Bar */}
      <div className="studio-panel-header">
        <div className="panel-header-title" title="Apertus Dossier">
          <span>Apertus Dossier</span>
        </div>

        <div className="panel-header-actions">
          {extractedAffair && (
            <div className="preview-tabs">
              <button
                type="button"
                className={`preview-tab-btn ${!showRawJson ? 'active' : ''}`}
                onClick={() => handleSelectView('cards')}
              >
                Cards
              </button>
              <button
                type="button"
                className={`preview-tab-btn ${showRawJson ? 'active' : ''}`}
                onClick={() => handleSelectView('json')}
              >
                JSON
              </button>
            </div>
          )}

          <button
            type="button"
            className={`btn-extract ${isExtracting ? 'btn-extract-loading' : ''}`}
            onClick={onExtract}
            disabled={isExtracting || !canExtract}
            title={
              canExtract
                ? 'Run conservative extraction with Swiss-AI Apertus 1.5-8B on CSCS Alps Supercomputer'
                : 'Select a document first'
            }
          >
            {isExtracting ? 'Extracting...' : extractedAffair ? 'Re-run' : 'Extract with Apertus'}
          </button>
        </div>
      </div>

      {/* Extraction Content Area */}
      <div className="extracted-view-container">
        {/* Loading State */}
        {isExtracting && (
          <div className="extract-loading-box">
            <div className="spinner-supercomputer" />
            <h3 style={{ color: '#ffffff', fontSize: 'var(--font-size-md)', fontWeight: 700, marginBottom: '0.45rem' }}>
              Extracting with Apertus 1.5-8B
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', maxWidth: '440px', lineHeight: '1.6' }}>
              Parsing document structure, extracting schema fields, and verifying citation provenance.
            </p>
          </div>
        )}

        {/* Error State */}
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
              style={{ marginTop: '0.75rem', fontSize: 'var(--font-size-base)', padding: '0.5rem 1.1rem' }}
              onClick={onExtract}
            >
              Retry Extraction
            </button>
          </div>
        )}

        {/* Idle / Initial State */}
        {!isExtracting && !extractError && !extractedAffair && <ExtractionIdleHero />}

        {/* Extracted Dossier */}
        {!isExtracting &&
          extractedAffair &&
          (showRawJson ? (
            <ExtractionJsonInspector extractedAffair={extractedAffair} />
          ) : (
            <>
              {/* Provenance Trust Strip with Integrated Expandable Audit Accordion */}
              {provenanceReport && (
                <ProvenanceTrustStrip
                  provenanceReport={provenanceReport}
                  extractedAffair={extractedAffair}
                  activeProvenance={activeProvenance}
                  onHoverProvenance={onHoverProvenance}
                />
              )}

              {/* Dossier Identity & Metadata Card */}
              <ExtractionHeaderCard
                extractedAffair={extractedAffair}
                onHoverProvenance={onHoverProvenance}
              />

              {/* Authors & Submitters Card */}
              <ExtractionAuthorsCard
                authors={extractedAffair.authors}
                onHoverProvenance={onHoverProvenance}
              />

              {/* Background Context & Rationale Card */}
              <ExtractionRationaleCard
                rationale={extractedAffair.background_and_rationale}
                rationaleProvenance={extractedAffair.rationale_provenance}
                onHoverProvenance={onHoverProvenance}
              />

              {/* Parliamentary Questions & Executive Answers Card */}
              <ExtractionQuestionsCard
                questionsAndAnswers={extractedAffair.questions_and_answers}
                onHoverProvenance={onHoverProvenance}
              />

              {/* Financial Credits & Appropriations Card */}
              <ExtractionFinancialCard
                financialDetails={extractedAffair.financial_details}
                onHoverProvenance={onHoverProvenance}
              />
            </>
          ))}
      </div>
    </div>
  );
};
