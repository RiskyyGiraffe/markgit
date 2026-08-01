import { afterEach, describe, expect, it } from 'vitest';
import { ForbiddenError } from '../lib/errors.js';
import { assertModerator } from './moderation.js';

const originalAdminIds = process.env.MARKGIT_ADMIN_USER_IDS;

afterEach(() => {
  if (originalAdminIds === undefined) delete process.env.MARKGIT_ADMIN_USER_IDS;
  else process.env.MARKGIT_ADMIN_USER_IDS = originalAdminIds;
});

describe('moderation authorization', () => {
  it('accepts an exactly allowlisted user id', () => {
    process.env.MARKGIT_ADMIN_USER_IDS = 'first-user, moderator-user';
    expect(() => assertModerator('moderator-user')).not.toThrow();
  });

  it('rejects permission holders who are not in the operator allowlist', () => {
    process.env.MARKGIT_ADMIN_USER_IDS = 'moderator-user';
    expect(() => assertModerator('other-user')).toThrow(ForbiddenError);
  });
});
