# Security Specification for Daily Success Planner

## 1. Data Invariants
- **User Integrity**: A user profile located at `/users/{userId}` can only be read or written by the authenticated user whose `request.auth.uid` matches the `userId`.
- **Verified Emails ONLY**: Writing to any profile or checking off success logs requires that the user's email is fully verified (`request.auth.token.email_verified == true`).
- **Data Ownership**: No user can read, create, update, or delete daily entry logs under another user's path. `/users/{userId}/entries/{date}` is strictly locked so only `{userId}` can access it.
- **Timestamp Integrity**: All updates to entry or user sheets must record a strict server timestamp (`request.time`) for track integrity (e.g., `updatedAt == request.time`).

---

## 2. The "Dirty Dozen" Payloads

Here are 12 specific payloads attempting to break Identity, Integrity, and State:

1. **Payload 1: Spoofing Owner profile**
   - Attempt: User `attacker_123` tries to create profile for user `victim_456`.
   - Path: `/users/victim_456`
   - Outcome: `PERMISSION_DENIED` (auth.uid mismatch).

2. **Payload 2: Bypass Email Verification**
   - Attempt: User `unverified_789` (with `email_verified == false`) tries to register user profile.
   - Path: `/users/unverified_789`
   - Outcome: `PERMISSION_DENIED` (checks `request.auth.token.email_verified == true`).

3. **Payload 3: Infiltrating other's checklist**
   - Attempt: User `attacker_1` tries to write a daily entry checklist item under `victim_2` subcollection.
   - Path: `/users/victim_2/entries/2026-06-13`
   - Outcome: `PERMISSION_DENIED` (auth.uid mismatch).

4. **Payload 4: Shadow Update (Ghost fields)**
   - Attempt: User `user_abc` tries to update daily entry with a ghost field `isAdminPrivilege: true` to bypass verification systems.
   - Path: `/users/user_abc/entries/2026-06-13`
   - Outcome: `PERMISSION_DENIED` (strictly verifies known keys using precise schema guards).

5. **Payload 5: Malicious long ID characters (Resource Poisoning)**
   - Attempt: Inserting 1000 characters as the date variable (e.g., `users/user1/entries/SOME_JUNK_1000_CHARACTERS...`).
   - Path: `/users/user1/entries/SOME_JUNK_...`
   - Outcome: `PERMISSION_DENIED` (checks `.size() <= 32`).

6. **Payload 6: Client-side fake Timestamp override**
   - Attempt: Setting client date-time `2020-01-01` instead of `request.time` server timestamp.
   - Path: `/users/user1/entries/2026-06-13`
   - Outcome: `PERMISSION_DENIED`.

7. **Payload 7: Spoof Admin Claim (Unauthenticated user)**
   - Attempt: Trying to request list of other user profiles without credentials.
   - Path: `/users`
   - Outcome: `PERMISSION_DENIED`.

8. **Payload 8: Blanket read list injection**
   - Attempt: User tries to execute client list query across other user's entries.
   - Path: `/users/other_user_uid/entries`
   - Outcome: `PERMISSION_DENIED` (list allowed ONLY if target is owner).

9. **Payload 9: Negative range poisoning**
   - Attempt: Injecting negative size lists or invalid arrays.
   - Outcome: `PERMISSION_DENIED` (schema limits enforced).

10. **Payload 10: Value Poisoning (Invalid Type of checklist)**
    - Attempt: Trying to insert a `string` as a `boolean` for standard habits.
    - Outcome: `PERMISSION_DENIED` (type checks enforced).

11. **Payload 11: Tampering Immutable createdAt field**
    - Attempt: Modifying the `createdAt` field on a user profile years after initial entry.
    - Outcome: `PERMISSION_DENIED`.

12. **Payload 12: Orphaned Entries Generation**
    - Attempt: Writing entries prior to user profile registration.
    - Outcome: `PERMISSION_DENIED` (checks User profile exists before writing entries).

---

## 3. Test Rules Execution Block (`firestore.rules.test.ts`)
A test suite will simulate these standard vectors ensuring error output results in complete `PERMISSION_DENIED`.
