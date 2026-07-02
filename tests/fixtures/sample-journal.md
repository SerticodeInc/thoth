# Sample Journal

Today I was thinking about clean architecture.

The domain layer should have zero dependencies. This is the single most important rule. When I first started with Flutter, I put everything in widgets. Big mistake.

## Architecture Lessons

Separation of concerns isn't just about organization — it's about maintainability. When your business logic is mixed with your UI, you can't test either one effectively.

## Production Experience

In production, the things that matter are:
- Error handling
- Logging
- Graceful degradation
- Observability

These aren't optional. They're the difference between a prototype and a product.
