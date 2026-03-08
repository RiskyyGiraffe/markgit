import { describe, expect, it } from 'vitest';
import {
  ensureProductCanPublish,
  ensureProductCanSubmitForReview,
} from './product-workflow.js';
import { ValidationError } from './errors.js';

describe('product workflow guards', () => {
  it('allows draft products to be submitted for review', () => {
    expect(() => ensureProductCanSubmitForReview('draft')).not.toThrow();
  });

  it('rejects review submission for non-draft products', () => {
    expect(() => ensureProductCanSubmitForReview('active')).toThrow(ValidationError);
  });

  it('allows publishing from draft or pending review', () => {
    expect(() => ensureProductCanPublish('draft')).not.toThrow();
    expect(() => ensureProductCanPublish('pending_review')).not.toThrow();
  });

  it('rejects publishing from completed workflow states', () => {
    expect(() => ensureProductCanPublish('archived')).toThrow(ValidationError);
  });
});
