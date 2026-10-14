import React from 'react';
import type { ExtractedAffair, ActiveProvenance } from '../../types';

interface ExtractionFinancialCardProps {
  financialDetails: ExtractedAffair['financial_details'];
  onHoverProvenance?: (prov: ActiveProvenance | null) => void;
}

export const ExtractionFinancialCard: React.FC<ExtractionFinancialCardProps> = ({
  financialDetails,
  onHoverProvenance,
}) => {
  return (
    <div className="extracted-card">
      <div className="extracted-card-header">
        <h3>Financial Credits & Appropriations ({financialDetails.length})</h3>
      </div>
      {financialDetails.length > 0 ? (
        <div className="financial-grid">
          {financialDetails.map((fin, idx) => (
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
                <div
                  className="citation-chip interactive-tag"
                  style={{ marginTop: '0.4rem', cursor: 'pointer' }}
                  onMouseEnter={() =>
                    onHoverProvenance?.({
                      field: `finance: ${fin.purpose || 'credit'}`,
                      page_number: fin.provenance!.page_number,
                      snippet: fin.provenance!.source_text_snippet,
                    })
                  }
                  onMouseLeave={() => onHoverProvenance?.(null)}
                  title="Hover to inspect financial citation"
                >
                  p. {fin.provenance.page_number}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="extracted-empty-msg">No financial expenditures or credits requested in this affair.</p>
      )}
    </div>
  );
};
