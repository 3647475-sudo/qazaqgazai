# Firebase Security Specification and Hardening

This document outlines the security invariants, test scenarios (the "Dirty Dozen" attacks), and validation design for our Firebase Firestore rules.

## 1. Data Invariants

1. **User Isolation**: A user can only access (read, write, delete) their own documents under the `/users/{userId}/` sub-hierarchy. There is no cross-user reading or sharing of reminders, alarms, logs, or planning boards.
2. **Identity Integrity**: All UIDs inside any document or path must correspond directly to the authenticated user's UID (`request.auth.uid`).
3. **Email Verification**: Only authenticated users with verified email addresses (`request.auth.token.email_verified == true`) are permitted to register data.
4. **Data Shape Validation**: Every field must have strict type matching and length bounds to prevent "Denial of Wallet" resource exhaustion attacks.

---

## 2. The "Dirty Dozen" Attacks (Payloads)

We design 12 specific payloads or actions meant to violate security constraints, which MUST be rejected with `PERMISSION_DENIED`:

### Attack 1: Unauthenticated Creation of Reminder
- **Target**: `/users/user_abc/reminders/rem_1`
- **Payload**: `{ id: "rem_1", text: "Malicious Reminder", completed: false, createdAt: 1234567 }`
- **Context**: No authentication token provided.

### Attack 2: Identity Spoofing (Cross-User Write)
- **Target**: `/users/user_victim/reminders/rem_2`
- **Payload**: `{ id: "rem_2", text: "Hijack Task", completed: false, createdAt: 1234567 }`
- **Context**: Authenticated as `user_attacker`.

### Attack 3: Spoofed Unverified Email Access
- **Target**: `/users/user_unverified/reminders/rem_3`
- **Payload**: `{ id: "rem_3", text: "Write task", completed: false, createdAt: 1234567 }`
- **Context**: Authenticated as `user_unverified` with `email_verified: false`.

### Attack 4: String Overflow Denial of Wallet (Reminders)
- **Target**: `/users/user_legit/reminders/rem_4`
- **Payload**: `{ id: "rem_4", text: "<100,000 character string>", completed: false, createdAt: 1234567 }`
- **Context**: Authenticated as `user_legit` with `email_verified: true`.

### Attack 5: Resource Poisoning via Path ID Manipulation
- **Target**: `/users/user_legit/reminders/rem_very_long_invalid_id_character_overflow_!!!!!_$$$`
- **Payload**: `{ id: "rem_very_long_invalid_id_character_overflow_!!!!!_$$$", text: "Task", completed: false, createdAt: 1234567 }`
- **Context**: Authenticated as `user_legit`.

### Attack 6: Self-Assigned Status Bypass (Terminal Status Locking Bypass)
- **Target**: `/users/user_legit/plannerTasks/task_6`
- **Payload**: Attempt to transition a task directly from 'low' to 'critical' or bypass progress rules using malformed key payloads.

### Attack 7: Shadow Fields Injection
- **Target**: `/users/user_legit/alarms/al_7`
- **Payload**: `{ id: "al_7", time: "08:00", label: "Alarm", active: true, ringDays: ["Mon"], attackerCustomProperty: "malicious" }`
- **Context**: Authenticated as `user_legit`.

### Attack 8: Array Content Guard Violation (Alarms Ring Days Size/Types)
- **Target**: `/users/user_legit/alarms/al_8`
- **Payload**: `{ id: "al_8", time: "08:00", label: "Alarm", active: true, ringDays: [1234, false] }`
- **Context**: Authenticated as `user_legit`.

### Attack 9: Invalid Category Injection (Habit Logs)
- **Target**: `/users/user_legit/habitLogs/log_9`
- **Payload**: `{ id: "log_9", action: "Hack", timestamp: 12345, category: "super-admin-inject" }`
- **Context**: Authenticated as `user_legit`.

### Attack 10: Invalid Numeric Value Range (Planner Task Progress)
- **Target**: `/users/user_legit/plannerTasks/task_10`
- **Payload**: `{ id: "task_10", title: "Task", description: "Desc", bucketId: "b1", priority: "critical", progress: 9999, checklist: [] }`
- **Context**: Authenticated as `user_legit`.

### Attack 11: Immutable Field Modification (Alarms ID Mutation)
- **Target**: `/users/user_legit/alarms/al_11`
- **Action**: Update the document to change its internal `id` property from its initial created value.

### Attack 12: Blanket Unsecured Global Read Scraping
- **Action**: Attempt to query all reminders globally without user isolation constraint: `db.collectionGroup('reminders')`.

---

## 3. The Test Suite Runner

Below is the conceptual Test Runner code representing validations against these payloads.
