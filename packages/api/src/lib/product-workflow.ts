import { ValidationError } from './errors.js';

export function ensureProductCanSubmitForReview(status: string) {
  if (status !== 'draft') {
    throw new ValidationError('Only draft products can be submitted for review');
  }
}

export function ensureProductCanPublish(status: string) {
  if (status !== 'draft' && status !== 'pending_review') {
    throw new ValidationError('Only draft or pending review products can be published');
  }
}
