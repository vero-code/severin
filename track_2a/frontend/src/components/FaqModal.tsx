import React, { useEffect } from 'react';

interface FaqModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FaqItem {
  id: string;
  badge: string;
  badgeColor: 'red' | 'mint' | 'cyan' | 'amber' | 'purple' | 'slate';
  title: string;
  role: string;
  value: string;
  icon: React.ReactNode;
}

export const FaqModal: React.FC<FaqModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const faqItems: FaqItem[] = [
    {
      id: 'telemetry',
      badge: 'CSCS Telemetry',
      badgeColor: 'red',
      title: 'CSCS Inference Telemetry',
      role: 'Monitors API requests to the CSCS inference endpoint (Alps cluster).',
      value: 'Tracks latency, prompt and completion token counts, cache hits, and estimated cost per run in CHF.',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
    {
      id: 'samples',
      badge: 'Sample Corpus',
      badgeColor: 'purple',
      title: '27 Cantonal Samples',
      role: 'A set of 27 parliamentary PDFs from 5 cantons (ZH, BE, TI, VS, GE) in German, French, and Italian.',
      value: 'Used to test extraction across varied parliamentary formats and verify citations against pre-annotated ground truth without needing an API key.',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      ),
    },
    {
      id: 'api',
      badge: 'Open Data API',
      badgeColor: 'cyan',
      title: 'OpenParlData.ch API',
      role: 'Queries the public Swiss Open Parliamentary Data repository (api.openparldata.ch).',
      value: 'Allows searching and loading real legislative affairs and their PDF documents directly from cantonal parliaments.',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
    },
    {
      id: 'pdf',
      badge: 'Document View',
      badgeColor: 'amber',
      title: 'PDF Document View',
      role: 'Renders the original PDF document in an embedded viewer.',
      value: 'Displays original layout, tables, seals, and formatting as published by the canton.',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      ),
    },
    {
      id: 'text',
      badge: 'Text Layer',
      badgeColor: 'mint',
      title: 'Extracted Page Text',
      role: 'Extracts and normalizes page text via PyMuPDF (resolving ligatures and diacritics).',
      value: 'Displays page text and highlights the exact source passage when clicking or hovering on citation tags in the extraction panel.',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="9" x2="20" y2="9" />
          <line x1="4" y1="15" x2="20" y2="15" />
          <line x1="10" y1="3" x2="8" y2="21" />
          <line x1="16" y1="3" x2="14" y2="21" />
        </svg>
      ),
    },
    {
      id: 'apertus',
      badge: 'Apertus 1.5-8B',
      badgeColor: 'red',
      title: 'Apertus Extraction Studio',
      role: 'Performs structured extraction via Swiss-AI Apertus 1.5-8B (temperature 0.0, strict Pydantic schemas).',
      value: 'Extracts affair titles, authors, executive bodies, Q&A pairs, context, and financial figures, linking each field to a page citation snippet.',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      ),
    },
  ];

  return (
    <div className="faq-modal-overlay" onClick={onClose}>
      <div
        className="faq-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="faq-modal-title"
      >
        <div className="faq-modal-header">
          <div className="faq-header-titles">
            <div className="faq-title-badge">System Guide</div>
            <h2 id="faq-modal-title">System Overview & Guide</h2>
            <p className="faq-header-subtitle">
              Overview of each component and its function in the extraction pipeline.
            </p>
          </div>
          <button
            type="button"
            className="faq-modal-close"
            onClick={onClose}
            aria-label="Close guide"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        <div className="faq-modal-body">
          <div className="faq-cards-grid">
            {faqItems.map((item) => (
              <div key={item.id} className="faq-card">
                <div className="faq-card-header">
                  <div className={`faq-card-icon-box icon-box-${item.badgeColor}`}>
                    {item.icon}
                  </div>
                  <div className="faq-card-heading-box">
                    <span className={`faq-card-badge badge-${item.badgeColor}`}>
                      {item.badge}
                    </span>
                    <h3 className="faq-card-title">{item.title}</h3>
                  </div>
                </div>
                <div className="faq-card-role">
                  <strong>Purpose:</strong> {item.role}
                </div>
                <div className="faq-card-value">
                  <strong>Benefit:</strong> {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="faq-modal-footer">
          <div className="faq-footer-note">
            <span className="faq-note-dot" />
            <span>
              Hack Apertus 2026 (Track 2A) • Swiss-AI Apertus 1.5-8B on CSCS Alps.
            </span>
          </div>
          <button type="button" className="btn-primary faq-close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
