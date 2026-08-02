import { describe, expect, it } from 'vitest';
import { ValidationError } from '../lib/errors.js';
import { consolidateFeedbackText } from './reviews.js';

describe('feedback consolidation', () => {
  it('turns incremental feedback into one outcome review', () => {
    const result = consolidateFeedbackText([
      { sentiment: 'neutral', message: 'The first result needed a correction.' },
      { sentiment: 'positive', message: 'The corrected result answered the question.' },
      { sentiment: 'positive', message: 'The user confirmed it was useful.' },
    ], { finalSummary: 'The agent improved the result during the run.' });
    expect(result.helpful).toBe(true);
    expect(result.body).toContain('Consolidated from 3 user feedback signals');
    expect(result.body).toContain('The user confirmed it was useful.');
  });

  it('requires an explicit final outcome for mixed feedback', () => {
    const events = [
      { sentiment: 'positive', message: 'One step helped.' },
      { sentiment: 'negative', message: 'One step did not.' },
    ];
    expect(() => consolidateFeedbackText(events, {})).toThrow(ValidationError);
    expect(consolidateFeedbackText(events, { finalHelpful: false }).helpful).toBe(false);
  });
});
