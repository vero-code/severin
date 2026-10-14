import React from 'react';

export interface FaqItem {
  id: string;
  title: string;
  description: React.ReactNode;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'telemetry',
    title: 'Telemetry',
    description:
      'Client-side audit log of API requests to CSCS Alps, tracking request speed, token counts (IN/OUT), cached tokens, and estimated cost in CHF.',
  },
  {
    id: 'samples',
    title: '27 Samples',
    description:
      'Curated nationwide test corpus of 27 parliamentary affairs covering all 26 Swiss cantons and the federal level (CHE) across German, French, and Italian.',
  },
  {
    id: 'api',
    title: 'Live API',
    description: (
      <>
        Interface to the{' '}
        <a
          href="https://api.openparldata.ch"
          target="_blank"
          rel="noopener noreferrer"
          className="faq-link"
        >
          Swiss Open Parliamentary Data
        </a>, enabling retrieval of live legislative affairs and official PDFs across federal and cantonal bodies.
      </>
    ),
  },
  {
    id: 'pdf',
    title: 'PDF',
    description:
      'Embedded document viewer displaying the original source PDF for visual reference and manual verification.',
  },
  {
    id: 'text',
    title: 'Text',
    description:
      'Normalized plain-text layer extracted page-by-page via pypdf, featuring interactive citation highlighting when verifying extracted fields.',
  },
  {
    id: 'apertus',
    title: 'Apertus Studio',
    description:
      'Structured extraction powered by Swiss-AI Apertus 1.5-8B (temp 0.0), delivering validated Pydantic models with page-level citation provenance.',
  },
];

export const FaqCardsGrid: React.FC = () => {
  return (
    <div className="faq-cards-grid">
      {FAQ_ITEMS.map((item) => (
        <div key={item.id} className="faq-card">
          <h3 className="faq-card-title">{item.title}</h3>
          <p className="faq-card-desc">{item.description}</p>
        </div>
      ))}
    </div>
  );
};
