# Security Specification — LO Command Centre

## 1. Data Invariants

1. **Authentication & Verification Invariant**: Every write operation requires an authenticated user with `request.auth.token.email_verified == true`.
2. **Ownership Invariant**: Every document in `/configs`, `/officers`, `/officers/{officerId}/vault`, `/assignmentLogs`, and `/delegates` must have `ownerId == request.auth.uid` on creation, and `ownerId` is strictly immutable across updates.
3. **Master Gate Invariant (Relational Sync)**: A vault credential document `/officers/{officerId}/vault/{vaultId}` cannot be read, created, updated, or deleted unless the parent `/officers/{officerId}` exists and its `ownerId` matches `request.auth.uid` (or `isAdmin()`).
4. **Strict Key & Schema Invariant**: Every entity helper (`isValidSystemConfig`, `isValidOfficer`, `isValidOfficerVault`, `isValidAssignmentLog`, `isValidDelegateRecord`) enforces `hasAll` and `hasOnly` key checks, exact types, regex guards, and `.size()` limits matching `firebase-blueprint.json`.
5. **Temporal Integrity Invariant**: `createdAt` must equal `request.time` on creation and remain immutable on updates; `updatedAt` must equal `request.time` on creation and updates.
6. **Terminal State Locking**: Once a `DelegateRecord` reaches `registrationStatus == 'Completed'` or `'Cancelled'`, standard updates are locked unless performed by an admin (`isAdmin()`).
7. **Query Enforcer & PII Isolation**: All `list` operations strictly verify `existing().ownerId == request.auth.uid` without `get()`/`exists()` inside `allow list`, preventing unauthorized query scraping and isolating PII.

## 2. The "Dirty Dozen" Payloads

1. **Unverified Email Spoof**: Authenticated user with `email: "vinod.akpandey@gmail.com"` and `email_verified: false` attempting to create an officer record.
2. **Shadow Field Injection (Create)**: Creating `/officers/off_1` with an extra undeclared field `{"isSuperAdmin": true}`.
3. **Shadow Field Injection (Update)**: Updating `/officers/off_1` with an undeclared field `{"hacked": "yes"}`.
4. **Identity Spoofing on Create**: Creating `/delegates/del_1` with `ownerId: "victim_uid"` while authenticated as `"attacker_uid"`.
5. **Ownership Hijack on Update**: Updating `/officers/off_1` by changing `ownerId` from `"user_1"` to `"attacker_uid"`.
6. **Timestamp Forgery**: Creating `/assignmentLogs/log_1` with a past or future client timestamp instead of `request.time`.
7. **Immortal Field Mutation**: Updating `/officers/off_1` and modifying `createdAt`.
8. **ID Poisoning Attack**: Creating `/officers/invalid$id!with*spaces` or a 500-character document ID.
9. **Value Poisoning / Oversized Payload**: Updating `/officers/off_1` with `fullName` set to a 10,000-character string (exceeding `maxLength: 120`).
10. **Terminal State Bypass**: Non-admin user attempting to update `hotelName` on a `/delegates/{delegateId}` document whose existing `registrationStatus` is `'Completed'`.
11. **Orphaned Vault Write (Master Gate Violation)**: Creating `/officers/non_existent_officer/vault/primary` where the parent officer document does not exist or belongs to another user.
12. **Blanket List Scraping**: Executing an unfiltered `list` query on `/delegates` or `/officers` without `where('ownerId', '==', request.auth.uid)`.
