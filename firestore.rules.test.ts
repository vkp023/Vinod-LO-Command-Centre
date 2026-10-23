/**
 * Firestore Security Rules Verification Suite — Dirty Dozen Payloads
 * Verifies that all 12 adversarial payloads are rejected with PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  expectedResult: 'PERMISSION_DENIED';
  payload: Record<string, unknown>;
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Unverified Email Spoof',
    collection: '/officers/off_001',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: { email_verified: false, email: 'vinod.akpandey@gmail.com' },
  },
  {
    id: 2,
    name: 'Shadow Field Injection on Create',
    collection: '/officers/off_001',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: { fullName: 'Poojan', isSuperAdmin: true },
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Update',
    collection: '/officers/off_001',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    payload: { approvalStatus: 'Approved', ghostField: 'injected' },
  },
  {
    id: 4,
    name: 'Identity Spoofing on Create',
    collection: '/delegates/del_001',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: { ownerId: 'other_user_uid', delegateName: 'Vikram Mehta' },
  },
  {
    id: 5,
    name: 'Ownership Hijack on Update',
    collection: '/officers/off_001',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    payload: { ownerId: 'attacker_uid' },
  },
  {
    id: 6,
    name: 'Client Timestamp Forgery',
    collection: '/assignmentLogs/log_001',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: { createdAt: '1999-01-01T00:00:00Z' },
  },
  {
    id: 7,
    name: 'Immortal Field Mutation (createdAt)',
    collection: '/officers/off_001',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    payload: { createdAt: '2026-10-22T00:00:00Z' },
  },
  {
    id: 8,
    name: 'ID Poisoning Attack',
    collection: '/officers/bad$id!@#',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: { fullName: 'Ronnie' },
  },
  {
    id: 9,
    name: 'Value Poisoning Oversized String',
    collection: '/officers/off_001',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    payload: { fullName: 'A'.repeat(1024) },
  },
  {
    id: 10,
    name: 'Terminal State Bypass on Completed Delegate',
    collection: '/delegates/del_completed',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    payload: { hotelName: 'Unauthorized Hotel Change' },
  },
  {
    id: 11,
    name: 'Orphaned Vault Write (Master Gate Violation)',
    collection: '/officers/missing_officer/vault/primary',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: { officerId: 'missing_officer', contactNumber: '+91 98200 00000' },
  },
  {
    id: 12,
    name: 'Blanket List Scraping Without Owner Filter',
    collection: '/delegates',
    operation: 'list',
    expectedResult: 'PERMISSION_DENIED',
    payload: { queryFilter: 'NONE' },
  },
];
