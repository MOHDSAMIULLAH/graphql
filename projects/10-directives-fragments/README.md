# Project 10 — Directives & Fragments

**System: Analytics Dashboard**
**Difficulty: Advanced**

---

## What This Project Teaches

Directives modify how GraphQL executes queries or annotates schema elements. Fragments make client queries reusable and maintainable. Both are used constantly in production — every serious GraphQL client codebase uses fragments, and every serious schema uses directives. This project covers both from built-in to custom implementations.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| Node.js | Runtime |
| Apollo Server 3 | GraphQL server |
| @graphql-tools/schema | `makeExecutableSchema` |
| @graphql-tools/utils | `mapSchema`, `getDirective` — for custom directives |

---

## Concepts Covered

- **Built-in directives**: `@skip(if:)`, `@include(if:)`, `@deprecated(reason:)`
- `@skip` vs `@include` — the difference and when to use each
- Schema-level `@deprecated` — marking fields for removal
- **Named fragments** — reusable query pieces (client-side)
- Fragment composition — fragments using other fragments
- **Custom `@uppercase` directive** — transforms field return values
- **Custom `@auth(role:)` directive** — field-level access control
- `mapSchema` + `getDirective` — the modern directive implementation pattern

---

## Setup & Run

```bash
cd projects/10-directives-fragments
npm install
npm run dev
```

Open **http://localhost:4000**

**To test `@auth` directive**: In Apollo Sandbox, add a Header:
- `x-user-role: USER` (default)
- `x-user-role: ADMIN` (to see restricted fields)

---

## Project Structure

```
10-directives-fragments/
├── index.js        ← Schema + resolvers + directive transformers + server
├── package.json
└── README.md
```

---

## Core Concepts Explained

### Built-in Directives

#### @skip and @include

```graphql
# @skip(if: Boolean) — skip this field when condition is true
# @include(if: Boolean) — include this field only when condition is true

query Dashboard($isAdmin: Boolean!, $showEmail: Boolean!) {
  users {
    id
    name
    email       @include(if: $showEmail)  # only include if showEmail = true
    salary      @skip(if: true)           # always skip
    department  @skip(if: $isAdmin)       # skip for admins (they see it elsewhere)
  }
}

# They are INVERSES:
# @skip(if: $x) === @include(if: !$x)

# Use @skip when:  "normally include this, sometimes skip it"
# Use @include when: "normally skip this, sometimes include it"
```

#### @deprecated

```graphql
type Post {
  createdAt: String!
  date: String @deprecated(reason: "Use 'createdAt' instead. Will be removed in v3.")
  #            ^ adds deprecation metadata visible in introspection + IDEs
}
```

The field still works — `@deprecated` is metadata only. Tools show a strikethrough or warning. Use it to gradually evolve your schema without breaking clients.

### Named Fragments

Fragments are **client-side** — defined in the query string, not the schema. The server never sees fragment names — they are expanded before execution.

```graphql
# Define a fragment — reusable piece of a query
fragment UserBasicFields on User {
  id
  name
  email
}

fragment UserDetailFields on User {
  ...UserBasicFields    # fragments can include other fragments
  role
  department
  joinedAt
}

# Use the fragment with the spread operator (...)
query GetAllUsers {
  users {
    ...UserBasicFields     # includes id, name, email
    role
  }
}

query GetUserProfile {
  user(id: "1") {
    ...UserDetailFields    # includes id, name, email, role, department, joinedAt
  }
}
```

### Custom Directives — How They Work

```js
// Step 1: Declare in schema
const typeDefs = `
  directive @uppercase on FIELD_DEFINITION

  type User {
    name: String! @uppercase   # this field's resolver gets wrapped
  }
`;

// Step 2: Build schema and apply transformer
import { makeExecutableSchema } from '@graphql-tools/schema';
import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { defaultFieldResolver } from 'graphql';

function uppercaseDirectiveTransformer(schema) {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD](fieldConfig) {
      // Check if this field has the @uppercase directive
      const directive = getDirective(schema, fieldConfig, 'uppercase')?.[0];
      if (!directive) return fieldConfig; // no directive — don't change

      const { resolve = defaultFieldResolver } = fieldConfig;

      // Wrap the resolver
      return {
        ...fieldConfig,
        resolve: async (source, args, context, info) => {
          const value = await resolve(source, args, context, info);
          return typeof value === 'string' ? value.toUpperCase() : value;
        },
      };
    },
  });
}

// Step 3: Apply transformer to schema
let schema = makeExecutableSchema({ typeDefs, resolvers });
schema = uppercaseDirectiveTransformer(schema); // apply @uppercase

const server = new ApolloServer({ schema });
```

---

## Queries to Try

```graphql
# 1. @include — conditional fields
query {
  users {
    id name
    email    @include(if: true)   # include
    salary   @include(if: false)  # skip
  }
}

# 2. @skip with variables (realistic use case)
query DashboardQuery($isAdmin: Boolean!) {
  dashboard(department: "engineering") {
    activeUsers
    newSignups
    totalRevenue @include(if: $isAdmin)
    errorRate    @include(if: $isAdmin)
  }
}
# Variables: { "isAdmin": true }

# 3. @uppercase custom directive
query {
  dashboard(department: "engineering") {
    departmentName   # returns "ENGINEERING" — uppercased by @uppercase
    activeUsers
  }
}

# 4. @deprecated field (works but tools show a warning)
query {
  posts {
    id title createdAt
    date     # @deprecated — still works, but IDE/Playground shows strikethrough
  }
}

# 5. Named fragments
fragment PostFields on Post {
  id title views author
}

query GetPosts {
  posts {
    ...PostFields
    tags createdAt
  }
}
```

---

## Interview Questions & Answers — Coding Round

---

### Q1. What is a GraphQL directive?

**Answer**:

```
A directive is a modifier that affects how GraphQL executes or interprets
schema elements.

Syntax: @directiveName(argument: value)

Two categories:

EXECUTION DIRECTIVES (query-level):
  Applied in queries/mutations/subscriptions by the client.
  Built-in:
    @skip(if: Boolean)    → skip this field when condition is true
    @include(if: Boolean) → include this field only when condition is true

SCHEMA DIRECTIVES (schema-level):
  Applied in the schema definition.
  Built-in:
    @deprecated(reason: String) → marks a field or enum value as deprecated

  Custom:
    @auth(role: String)   → access control
    @uppercase            → transform return value
    @cache(ttl: Int)      → caching hint
    @rateLimit(max: Int)  → rate limiting

Location matters:
  directive @uppercase on FIELD_DEFINITION  ← applies to fields
  directive @auth      on FIELD_DEFINITION
  directive @deprecated on FIELD_DEFINITION | ENUM_VALUE
  directive @skip      on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT
```

---

### Q2. What is the difference between `@skip` and `@include`?

**Answer**:

```graphql
# @skip(if: Boolean) — skip the field when the condition is TRUE
# @include(if: Boolean) — include the field when the condition is TRUE
# They are INVERSES: @skip(if: x) === @include(if: !x)

# Example — both achieve the same result:
query($showEmail: Boolean!) {
  users {
    name
    email @include(if: $showEmail)   # include email IF showEmail is true
    email @skip(if: $showEmail)      # NOT the same! skip IF showEmail is true
  }
}

# Choose based on your "default" thinking:
# Default to including, want to sometimes skip?  → use @skip
# Default to skipping, want to sometimes include? → use @include

# Practical use case: mobile vs desktop
query UserList($isMobile: Boolean!) {
  users {
    id name
    avatar         @skip(if: $isMobile)   # skip heavy image on mobile
    fullBio        @skip(if: $isMobile)   # skip long text on mobile
    compactInfo    @include(if: $isMobile) # show compact version on mobile
  }
}

# Another: show admin fields only when user is admin
query Dashboard($isAdmin: Boolean!) {
  dashboard {
    activeUsers
    revenue @include(if: $isAdmin)
    salaries @include(if: $isAdmin)
  }
}
```

---

### Q3. What is `@deprecated` and how do you use it?

**Answer**:

```graphql
# @deprecated marks a field or enum value as deprecated.
# The field still WORKS — @deprecated is metadata only.
# Tools (IDE, Apollo Sandbox, GraphQL Playground) show warnings/strikethroughs.

# On a field:
type User {
  name: String!
  fullName: String! @deprecated(reason: "Use 'name' instead. Removed in v3.")
}

# On an enum value:
enum Status {
  ACTIVE
  INACTIVE
  DELETED @deprecated(reason: "Use INACTIVE instead.")
}

# Schema evolution strategy:
#  1. Add the new field:  name: String!
#  2. Deprecate the old field: fullName @deprecated(reason: "Use 'name'")
#  3. Monitor usage — how many clients still use fullName?
#  4. When usage drops to 0 (or after a deprecation period), remove fullName

# Introspection shows deprecated fields:
query {
  __type(name: "User") {
    fields(includeDeprecated: true) {
      name
      isDeprecated
      deprecationReason
    }
  }
}
```

---

### Q4. What are named fragments and why use them?

**Answer**:

```graphql
# Named fragment: reusable piece of a query
# Syntax: fragment <Name> on <TypeName> { fields... }

fragment UserCard on User {
  id
  name
  avatar
  role
}

# Reuse with spread operator (...)
query GetUsers {
  users {
    ...UserCard          # expands to: id, name, avatar, role
    createdAt
  }
}

query SearchResults {
  search(query: "alice") {
    ... on User {
      ...UserCard        # same fragment, reused here
    }
  }
}
```

**Why use fragments:**

```
1. DRY (Don't Repeat Yourself):
   Without fragments: copy-paste the same 10 fields in 5 different queries.
   With fragments: define once, reference everywhere.

2. Consistency:
   The UserCard fragment always has the same fields.
   Changing it in one place updates all queries that use it.

3. Co-location (Relay pattern):
   Each React component defines its own fragment for the data it needs:
   PostCard defines PostCardFragment { title, preview, author }
   UserAvatar defines UserAvatarFragment { id, name, avatarUrl }
   Parent query assembles them: { post { ...PostCardFragment author { ...UserAvatarFragment } } }

4. Code generation:
   GraphQL code generators (graphql-codegen) produce TypeScript types per fragment.
   You get a typed interface for each fragment automatically.

Note: Fragments are 100% CLIENT-SIDE.
The server never sees fragment names — they're expanded inline before execution.
```

---

### Q5. Implement a custom `@log` directive that logs field access

**Question**: Create a custom directive `@log(level: String)` that logs every time a field is resolved.

**Answer**:

```js
import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { defaultFieldResolver } from 'graphql';

// Declare in schema:
// directive @log(level: String = "info") on FIELD_DEFINITION
// type User {
//   email: String! @log(level: "warn")   # log access to sensitive field
//   name:  String! @log                   # uses default level "info"
// }

function logDirectiveTransformer(schema) {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD](fieldConfig, fieldName, typeName) {
      const directive = getDirective(schema, fieldConfig, 'log')?.[0];
      if (!directive) return fieldConfig;

      const level = directive.level ?? 'info';
      const { resolve = defaultFieldResolver } = fieldConfig;

      return {
        ...fieldConfig,
        resolve: async (source, args, context, info) => {
          // Log field access
          const logMsg = `[${level.toUpperCase()}] Field accessed: ${typeName}.${fieldName}`;
          console[level]?.(logMsg) ?? console.log(logMsg);

          // Call the original resolver
          const result = await resolve(source, args, context, info);

          console.log(`[${level.toUpperCase()}] ${typeName}.${fieldName} = ${JSON.stringify(result)}`);
          return result;
        },
      };
    },
  });
}

// Apply:
let schema = makeExecutableSchema({ typeDefs, resolvers });
schema = logDirectiveTransformer(schema);
const server = new ApolloServer({ schema });
```

---

### Q6. What is the difference between client-side and server-side directives?

**Answer**:

```
CLIENT-SIDE (execution directives):
  Defined in: the query itself (not the schema)
  Applied by: the client or the GraphQL execution engine
  Examples: @skip, @include
  Scope: per-query execution (doesn't affect the schema)

  query {
    users {
      name
      email @include(if: $showEmail)   ← client decides whether to fetch email
    }
  }

SERVER-SIDE (schema directives):
  Defined in: the schema (typeDefs)
  Applied by: the server (via schema transformers)
  Examples: @deprecated, @uppercase, @auth(role: "ADMIN")
  Scope: affects resolver behavior for ALL queries that access the field

  type User {
    salary: Float @auth(role: "ADMIN")  ← always enforced, regardless of client
  }

Key distinction:
  Client-side: "do I want to fetch this field right now?"
  Server-side: "how should this field ALWAYS behave?"

  @skip/@include → client controls dynamically per query
  @uppercase/@auth → server enforces always (client can't override)
```

---

### Q7. How do fragments work with union types?

**Answer**:

```graphql
union SearchResult = User | Post | Comment

fragment UserFields on User {
  id name email
}

fragment PostFields on Post {
  id title content
  author { name }
}

# Fragments on union types MUST use inline fragments (... on Type)
query {
  search(query: "alice") {
    __typename

    # Spread named fragment within inline fragment
    ... on User    { ...UserFields }
    ... on Post    { ...PostFields }
    ... on Comment { id text }     # inline fragment without named fragment
  }
}

# You CANNOT spread a named fragment directly on a union:
query {
  search(query: "alice") {
    ...UserFields   # ERROR: SearchResult does not have fields 'id', 'name', 'email'
    #                         You must use "... on User { ...UserFields }"
  }
}
```

---

## Key Takeaways

1. `@skip(if: true)` removes the field. `@include(if: true)` keeps it. They are inverses.
2. `@deprecated` is schema metadata — the field still works, tools just show warnings.
3. Named fragments are client-side only — the server never sees fragment names.
4. Fragments are expanded inline before execution — they are purely a syntax convenience.
5. Custom directives: declare in schema → implement with `mapSchema` + `getDirective`.
6. Server-side directives wrap resolvers and are enforced for ALL queries.
7. Client-side directives (`@skip`/`@include`) are controlled per-query by the client.
