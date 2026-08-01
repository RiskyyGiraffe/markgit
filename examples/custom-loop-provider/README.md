# Secured Custom Loop reference provider

This FastAPI service demonstrates the production boundary Markgit uses for custom loops:

- all provider endpoints except `/health` require a provider-managed bearer token;
- Markgit stores that token encrypted and injects it server-to-server;
- the provider receives a short-lived, run-scoped callback token;
- the callback token can call only the tools and wallet budgets frozen for that run;
- the loop stops only when the declared `goalAchieved` field is true.

The loop itself is free. Each successful `penguin-goal-data` call is purchased through the normal Markgit wallet and provider-earnings ledger.
