import React, { useEffect } from 'react';
import { FaqCardsGrid } from './FaqCardsGrid';

interface FaqModalProps {
  isOpen: boolean;
  onClose: () => void;
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
            <h2 id="faq-modal-title">Platform Overview</h2>
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
          <FaqCardsGrid />
        </div>

        {/* <FaqModalFooter onClose={onClose} /> */}
      </div>
    </div>
  );
};
