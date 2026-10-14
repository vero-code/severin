import React from 'react';
import type { ExtractedAffair, ActiveProvenance } from '../../types';

interface ExtractionQuestionsCardProps {
  questionsAndAnswers: ExtractedAffair['questions_and_answers'];
  onHoverProvenance?: (prov: ActiveProvenance | null) => void;
}

export const ExtractionQuestionsCard: React.FC<ExtractionQuestionsCardProps> = ({
  questionsAndAnswers,
  onHoverProvenance,
}) => {
  return (
    <div className="extracted-card">
      <div className="extracted-card-header">
        <h3>Questions & Executive Answers ({questionsAndAnswers.length})</h3>
      </div>
      {questionsAndAnswers.length > 0 ? (
        questionsAndAnswers.map((qa, idx) => (
          <div key={idx} className="qa-card">
            <div className="qa-question">
              <strong>Question {qa.question.number || idx + 1}:</strong> {qa.question.text}
              {qa.question.provenance && (
                <span
                  className="citation-page-tag interactive-tag"
                  style={{ marginLeft: '0.5rem', cursor: 'pointer' }}
                  onMouseEnter={() =>
                    onHoverProvenance?.({
                      field: `question #${qa.question.number || idx + 1}`,
                      page_number: qa.question.provenance!.page_number,
                      snippet: qa.question.provenance!.source_text_snippet,
                    })
                  }
                  onMouseLeave={() => onHoverProvenance?.(null)}
                  title="Hover to inspect question citation"
                >
                  p. {qa.question.provenance.page_number}
                </span>
              )}
            </div>
            {qa.answer ? (
              <div className="qa-answer">
                <strong>Executive Answer:</strong> {qa.answer.text}
                {qa.answer.provenance && (
                  <span
                    className="citation-page-tag interactive-tag"
                    style={{ marginLeft: '0.5rem' }}
                    onMouseEnter={() =>
                      onHoverProvenance?.({
                        field: `answer #${qa.question.number || idx + 1}`,
                        page_number: qa.answer!.provenance!.page_number,
                        snippet: qa.answer!.provenance!.source_text_snippet,
                      })
                    }
                    onMouseLeave={() => onHoverProvenance?.(null)}
                    title="Hover to inspect answer citation"
                  >
                    p. {qa.answer.provenance.page_number}
                  </span>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                [Pending executive answer]
              </div>
            )}
          </div>
        ))
      ) : (
        <p className="extracted-empty-msg">No parliamentary questions present in this document.</p>
      )}
    </div>
  );
};
