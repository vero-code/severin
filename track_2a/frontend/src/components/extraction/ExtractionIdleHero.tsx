import React from 'react';

export const ExtractionIdleHero: React.FC = () => {
  return (
    <div className="studio-idle-hero">
      <div className="studio-hero-icon">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 21h18M3 10h18M5 10v11M9 10v11M13 10v11M17 10v11M19 10v11M12 2l9 6H3l9-6z" />
        </svg>
      </div>
      <h3 className="studio-hero-title">Grounded Extraction</h3>
      <p className="studio-hero-desc">
        LLM analysis with verified Swiss citation provenance.
      </p>
    </div>
  );
};
