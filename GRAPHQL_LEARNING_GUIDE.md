# GraphQL Mastery: From Scratch to Industry-Level
## Complete Learning Path — 10 Mini Projects

---

## Your Complete Roadmap

```
FOUNDATION
├── Project 01: Fundamentals        → Schema, Types, Queries, Resolvers
└── Project 02: Mutations Blog API  → CRUD, Mutations, Response Types

INTERMEDIATE
├── Project 03: Input Types & Enums → Input types, Enums, Custom Scalars
├── Project 04: Filtering & Pagination → Filter inputs, Offset + Cursor pagination
└── Project 05: Interfaces & Unions → Polymorphism, __resolveType, Inline fragments

ADVANCED
├── Project 06: Authentication     → JWT, Context, Role-based access
├── Project 07: DataLoader (N+1)   → Batching, Per-request cache, N+1 fix
└── Project 08: Error Handling     → ApolloError, Error Unions, Partial success

PRODUCTION
├── Project 09: Subscriptions      → WebSocket, PubSub, Real-time events
└── Project 10: Directives         → @skip/@include, @deprecated, Custom directives
```

---

## Quick Setup for Each Project

```bash
cd projects/0X-project-name
npm install
npm run dev
# Open http://localhost:4000
```

---

## Project Details

### Project 01 — GraphQL Fundamentals
**System**: User & Posts API  
**Concepts**: Schema definition, type system, queries, resolvers, nested resolvers  
**Key Questions**:
- What is GraphQL? How does it differ from REST?
- What are the 4 resolver arguments: `(parent, args, context, info)`?
- What does a field resolver do?

---

### Project 02 — Mutations & Blog API
**System**: Blog with full CRUD  
**Concepts**: Mutations, response wrapper types, updatePost, deletePost  
**Key Questions**:
- What is a mutation vs a query?
- Why use a response wrapper type `{ success, message, post }` instead of returning the object directly?
- How do you handle partial updates?

---

### Project 03 — Input Types, Enums & Custom Scalars
**System**: Library Management  
**Concepts**: `input` types, `enum` types, `GraphQLScalarType`, serialize/parseValue/parseLiteral  
**Key Questions**:
- What is the difference between `type` and `input` in GraphQL?
- Why use an input type instead of individual scalar arguments in mutations?
- How do you implement a custom scalar? What are the 3 hooks?
- When do you use an enum vs a String?

**Interview Trap**: "Why can't input types reference output types?"  
**Answer**: Circular dependency prevention + inputs have no resolvers (only scalars/enums/inputs allowed)

---

### Project 04 — Filtering, Sorting & Pagination
**System**: E-commerce Product Catalog  
**Concepts**: FilterInput, SortInput, offset pagination, cursor/Relay Connection pagination  
**Key Questions**:
- What is the difference between offset and cursor-based pagination?
- What is the Relay Connection Pattern? Explain `edges`, `node`, `cursor`, `pageInfo`
- When would you choose offset over cursor pagination?
- How do you implement filtering in GraphQL?

**Interview Trap**: "What's wrong with offset pagination on a live feed?"  
**Answer**: Items inserted/deleted mid-page cause duplicates or skipped items — cursor pagination is stable

---

### Project 05 — Interfaces & Union Types
**System**: Multi-type Media Search  
**Concepts**: `interface`, `union`, `__resolveType`, inline fragments `... on Type`, `__typename`  
**Key Questions**:
- What is the difference between interface and union?
- What is `__resolveType` and why is it required?
- What are inline fragments and when do you use them?
- What is `__typename` and what is it used for?

**Interface vs Union rule**:  
- Shared fields → use `interface`  
- No shared fields, just grouping → use `union`

---

### Project 06 — Authentication & Authorization
**System**: Protected API with JWT  
**Concepts**: login mutation, JWT, context function, `AuthenticationError`, `ForbiddenError`, role-based access  
**Key Questions**:
- How do you implement authentication in GraphQL?
- What is the context function and what goes in it?
- Where does auth logic live — middleware, context, or resolvers?
- What is the difference between authentication and authorization?

**Flow**:
```
login mutation → JWT token
→ Authorization: Bearer <token> header
→ context() decodes token → context.user
→ resolvers check context.user.role
```

---

### Project 07 — DataLoader & N+1 Problem
**System**: Social Network Feed  
**Concepts**: N+1 problem, DataLoader batch function, per-request caching, context-scoped loaders  
**Key Questions**:
- What is the N+1 problem? Give an example.
- How does DataLoader solve N+1? What is batching?
- Why must DataLoaders be created inside the context function (not at module level)?
- What does DataLoader's batch function receive and what must it return?

**N+1 in numbers**:
```
10 posts × 1 author each = 11 DB queries (without DataLoader)
10 posts + 1 batch call = 2 DB queries  (with DataLoader)
1000 posts = 1001 → 2 queries (100x improvement)
```

**Batch function contract**: `ids → results in the SAME ORDER as ids`

---

### Project 08 — Error Handling Patterns
**System**: Banking / Payment API  
**Concepts**: ApolloError, UserInputError, ForbiddenError, Error Union pattern, partial success  
**Key Questions**:
- What HTTP status code does GraphQL use for errors? Why?
- What is the difference between the throw pattern and the error union pattern?
- When would you use error unions vs throwing errors?
- What are the built-in Apollo error types and their use cases?

**Pattern comparison**:
```
Pattern 1 (throw):   response.errors[0].message  — stringly typed
Pattern 2 (union):   response.data.transfer.__typename  — fully typed, schematized
Pattern 3 (partial): some succeed, some fail in same operation
```

**Rule of thumb**:
- Throw: unexpected errors, auth failures, system/infra errors
- Return union: expected business logic failures clients explicitly handle

---

### Project 09 — Real-time Subscriptions
**System**: Live Chat Room  
**Library**: `graphql-yoga` (built-in WebSocket support)  
**Concepts**: `type Subscription`, PubSub, `pubsub.publish()`, async generators, event filtering  
**Key Questions**:
- What are GraphQL subscriptions?
- What transport protocol do subscriptions use and why?
- What is PubSub? What's the difference between in-memory and Redis PubSub?
- How do you filter subscription events (e.g., only messages in a specific room)?
- What are production considerations for subscriptions?

**How subscriptions work**:
```
Client subscribes → WebSocket connection opens
Mutation fires   → pubsub.publish('EVENT', data)
Server pushes    → subscriber async generator yields data
Client receives  → { data: { messageAdded: {...} } }
```

---

### Project 10 — Directives & Fragments
**System**: Analytics Dashboard  
**Concepts**: @skip, @include, @deprecated, custom @uppercase directive, custom @auth directive, named fragments  
**Key Questions**:
- What is a GraphQL directive?
- What is the difference between @skip and @include?
- How do you implement a custom schema directive?
- What are named fragments and why use them?
- What is the difference between a directive on a field vs on a schema definition?

**Directives cheatsheet**:
```graphql
field @skip(if: $condition)     # exclude if true
field @include(if: $condition)  # include if true (inverse of @skip)
field @deprecated(reason: "...") # schema annotation
```

---

## Interview Cheat Sheet: Top 20 GraphQL Questions

| # | Question | Key Answer |
|---|----------|------------|
| 1 | REST vs GraphQL | Over/under-fetching, single endpoint, type system, client-driven queries |
| 2 | Three operation types | Query (read), Mutation (write), Subscription (real-time) |
| 3 | What is a resolver? | Function that returns data for a field. Args: `(parent, args, context, info)` |
| 4 | What is context? | Shared request-scoped object — DB, auth user, DataLoaders. Created per request. |
| 5 | type vs input | `type` = output (queries). `input` = input (mutations). Inputs have no resolvers. |
| 6 | N+1 problem | N child queries for N parents. Fix: DataLoader batches IDs into 1 query. |
| 7 | Interface vs Union | Interface: shared fields + contract. Union: grouping only, no shared fields. |
| 8 | Cursor vs offset pagination | Cursor: stable position pointer, good for live feeds. Offset: simple, SQL-friendly. |
| 9 | Auth implementation | login → JWT → Authorization header → context decodes → resolvers check role |
| 10 | Error handling | HTTP 200 always. Errors in `errors[]`. Use ApolloError or Error Union pattern. |
| 11 | Custom scalar | GraphQLScalarType with serialize/parseValue/parseLiteral |
| 12 | @skip vs @include | @skip(if: true) removes field. @include(if: true) adds field. Inverses. |
| 13 | Subscriptions | WebSocket. PubSub publish/subscribe. Async generators for filtering. |
| 14 | DataLoader batch fn | Receives array of IDs, returns array of results in SAME ORDER |
| 15 | Named fragments | Reusable query pieces: `fragment X on Type { fields }`. Client-side only. |
| 16 | __resolveType | Required for interface/union. Returns type name string from object. |
| 17 | __typename | Built-in field. Returns type name. Used for union/interface discrimination. |
| 18 | Relay Connection | edges[{node, cursor}] + pageInfo{hasNextPage, endCursor}. Standard pagination. |
| 19 | Error Union pattern | Return typed error objects in union instead of throwing. GitHub/Shopify use this. |
| 20 | Where to put DataLoaders | Inside context() per request. Never module-level (stale cache). |

---

## GraphQL vs REST — Quick Reference

| Aspect | REST | GraphQL |
|--------|------|---------|
| Data fetching | Fixed response shape | Client specifies exact fields |
| Over-fetching | Yes (get unused data) | No |
| Under-fetching | Yes (need multiple calls) | No (one query for related data) |
| API versioning | /v1, /v2 | Deprecate fields, evolve schema |
| Type system | Optional (OpenAPI) | Built-in, enforced |
| Real-time | SSE / WebSocket (manual) | Built-in Subscriptions |
| Caching | HTTP cache (GET) | Complex (Apollo Client handles it) |
| Error handling | HTTP status codes | Always 200, errors in body |
| Learning curve | Easy | Medium |

---

## Common Mistakes to Avoid

1. **N+1 without DataLoader** — Always use DataLoader for list → child resolver patterns
2. **Module-level DataLoader** — Creates shared cache across requests. Always create in context()
3. **Individual args in mutations** — Use input types: `createUser(input: CreateUserInput!)`
4. **No __resolveType** — Required for interfaces and unions or GraphQL can't resolve types
5. **Circular input types** — Input types cannot reference output types
6. **In-memory PubSub in production** — Use Redis PubSub for multi-server deployments
7. **HTTP errors in GraphQL** — Don't return 400/500 for business errors. Use ApolloError or Error Unions
8. **Shared context object** — Context is per-request. Never mutate a shared object.
9. **Not handling null** — Many resolvers can return null. Design your schema accordingly.
10. **Over-exposing in schema** — Only expose what clients need. Schema is a contract, not a mirror of your DB.

---

## Production Checklist

- [ ] DataLoader for all list → child resolver patterns
- [ ] JWT authentication in context function
- [ ] Input validation with UserInputError
- [ ] Error Union types for business logic errors
- [ ] Cursor-based pagination for large/live datasets
- [ ] Redis PubSub for multi-server subscription scaling
- [ ] Depth limiting (prevent deeply nested queries)
- [ ] Query complexity analysis (prevent expensive queries)
- [ ] Persisted queries (security + performance)
- [ ] Rate limiting on mutations
- [ ] Schema introspection disabled in production
- [ ] Logging of slow resolvers

---

*Build all 10 projects. Read the inline comments. Answer the interview Q&A sections.*  
*After completing all projects, you will have covered every topic asked in GraphQL interviews.*
