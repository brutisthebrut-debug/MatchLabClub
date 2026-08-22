// Shared API test setup. Founder authorization is role-based; behavior-focused
// suites use the NODE_ENV=test-only x-test-founder-role bypass, while the auth
// suite exercises persisted roles and actor logging against Postgres.
