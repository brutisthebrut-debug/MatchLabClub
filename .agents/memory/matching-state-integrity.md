# Matching state integrity

**Current state: CLOSED by the pair-state transaction boundary.**

Internal proposal responses and proposal minting take sorted member locks
followed by the ordered pair lock. Pool membership changes take the member
lock; blocking and unmatching take the pair lock. Keep that lock ordering.
Do not reintroduce independent "read, then update" flows for mirrored
proposals.

Durable invariants:

1. An internal match becomes `mutual_yes` only when both proposal rows are
   `user_yes`, both members are actively in the pool, no block exists in either
   direction, and an active connection exists in the same transaction.
2. A decline is terminal: the declining member's row stays `user_no`; the
   mirrored unfinished row becomes `expired`.
3. Moving pool status to `off` or `paused` expires unfinished internal
   proposals in both directions. It does not close an already-active
   connection.
4. Blocking deletes both proposal directions and closes any connection as
   `block` in one transaction.
5. Unmatching closes the connection and moves the pair's live proposal states
   to `completed`. A closed connection is never silently reopened.
6. Reveal cards, opener generation, and date ideas require an active,
   unblocked connection. Historical messages may remain readable for context
   and safety evidence, but reveal-only identity data does not.
7. Proposal expiry touches only `proposed` and `user_yes`. It never rewrites a
   `user_no` as a timeout.

Reference implementation:

- `artifacts/api-server/src/lib/matchProposalState.ts`
- `artifacts/api-server/src/lib/userBlocks.ts`
- `artifacts/api-server/src/routes/matching.ts`
- `artifacts/api-server/src/routes/connections.ts`
