# Project 06 — Authentication & Authorization

**System: Protected API with JWT + Role-based Access**
**Difficulty: Advanced**

---

## What This Project Teaches

Nearly every production GraphQL API is protected. This project shows the complete auth flow: login → JWT token → Authorization header → context → protected resolvers → role checks. After this project, you will be able to implement auth in any GraphQL API from scratch.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| Node.js | Runtime |
| Apollo Server 3 | GraphQL server |
| jsonwebtoken | JWT sign and verify |

---

## Concepts Covered

- `login` mutation returning a JWT token
- `register` mutation with validation
- Apollo Server `context` function — runs once per request
- Extracting Bearer token from Authorization header
- Protecting resolvers with `AuthenticationError`
- Role-based access with `ForbiddenError`
- `me` query pattern for authenticated user profile
- Testing with Authorization headers in Apollo Sandbox

---

## Setup & Run

```bash
cd projects/06-authentication-authorization
npm install
npm run dev
```

Open **http://localhost:4000**

**Test credentials:**
- `alice@example.com` / `password123` → role: USER
- `admin@example.com` / `admin456` → role: ADMIN

---

## Project Structure

```
06-authentication-authorization/
├── index.js        ← Schema + resolvers + context + server
├── package.json
└── README.md
```

---

## Core Concepts Explained

### The Complete Auth Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. Client calls:  mutation { login(email, password) { token } }│
│                                                                 │
│  2. Server signs JWT:                                           │
│     jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn })│
│     → returns token: "eyJhbGci..."                              │
│                                                                 │
│  3. Client stores token and sends it with every request:        │
│     Header: Authorization: Bearer eyJhbGci...                   │
│                                                                 │
│  4. Server context() runs for every request:                    │
│     const token = req.headers.authorization.split('Bearer ')[1] │
│     const user = jwt.verify(token, JWT_SECRET)                  │
│     return { user }  ← available in every resolver as context   │
│                                                                 │
│  5. Protected resolver:                                         │
│     me(_, __, context) {                                        │
│       if (!context.user) throw new AuthenticationError(...)     │
│       return users.find(u => u.id === context.user.userId)      │
│     }                                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### The Context Function

The context function is the heart of auth in GraphQL:

```js
const server = new ApolloServer({
  typeDefs,
  resolvers,

  // context() runs ONCE per request (before any resolver)
  // Returns an object that is passed as 3rd argument to EVERY resolver
  context({ req }) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    let user = null;
    if (token) {
      try {
        user = jwt.verify(token, JWT_SECRET); // { userId, email, role, iat, exp }
      } catch {
        // expired or invalid — user stays null
      }
    }

    return {
      user,    // null = unauthenticated, object = authenticated
      // db,  // in real apps: pass DB connection here
    };
  },
});
```

### Guard Functions

```js
// Reusable auth guard — call at the top of any protected resolver
function requireAuth(context) {
  if (!context.user) {
    throw new AuthenticationError(
      'You must be logged in. Add header: Authorization: Bearer <token>'
    );
  }
}

function requireRole(context, role) {
  requireAuth(context);
  if (context.user.role !== role) {
    throw new ForbiddenError(`This action requires the ${role} role`);
  }
}

// Usage in resolvers:
const resolvers = {
  Query: {
    me(_, __, context) {
      requireAuth(context);   // throws if not logged in
      return users.find(u => u.id === context.user.userId);
    },

    allUsers(_, __, context) {
      requireRole(context, 'ADMIN');  // throws if not ADMIN
      return users;
    },
  },
};
```

### Error Types

```js
import { AuthenticationError, ForbiddenError, UserInputError } from 'apollo-server';

AuthenticationError('...')  // HTTP 401 equivalent — not logged in
ForbiddenError('...')        // HTTP 403 equivalent — logged in but not allowed
UserInputError('...')        // HTTP 400 equivalent — invalid input
```

These all extend `ApolloError` and appear in `response.errors[]` with machine-readable codes.

---

## How to Test in Apollo Sandbox

**Step 1** — Login to get a token:
```graphql
mutation {
  login(email: "alice@example.com", password: "password123") {
    token
    user { id name role }
  }
}
```

**Step 2** — Copy the token from the response.

**Step 3** — In Apollo Sandbox, click **Headers** tab and add:
```
Authorization: Bearer eyJhbGci... (paste your token here)
```

**Step 4** — Now run protected queries:
```graphql
query { me { id name email role } }
```

---

## Interview Questions & Answers — Coding Round

---

### Q1. How do you implement JWT authentication in GraphQL?

**Answer**:

```js
// Step 1: Login mutation
const resolvers = {
  Mutation: {
    login(_, { email, password }) {
      const user = users.find(u => u.email === email);

      // Vague error message on purpose — don't reveal whether email exists
      if (!user || user.password !== password) {
        throw new UserInputError('Invalid email or password');
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,       // NEVER hardcode secrets
        { expiresIn: '7d' }
      );

      return { token, user };
    },
  },
};

// Step 2: Context function
const server = new ApolloServer({
  context({ req }) {
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) return { user: null };

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return { user: decoded }; // { userId, email, role }
    } catch {
      return { user: null }; // expired or tampered token
    }
  },
});

// Step 3: Protected resolver
Query: {
  me(_, __, { user }) {
    if (!user) throw new AuthenticationError('Not authenticated');
    return users.find(u => u.id === user.userId);
  },
},
```

---

### Q2. What is the context function in Apollo Server and what goes in it?

**Answer**:

```js
// context() runs ONCE per request, BEFORE any resolver executes.
// Its return value is passed as the 3rd argument to every resolver.

const server = new ApolloServer({
  context({ req, res }) {  // destructure the raw HTTP request/response
    return {
      // 1. Authenticated user (most important)
      user: extractUserFromToken(req.headers.authorization),

      // 2. Database connection
      db: DatabaseConnection.instance,

      // 3. DataLoaders — MUST be per-request (never module-level)
      loaders: {
        user: new DataLoader(batchUsers),
        post: new DataLoader(batchPosts),
      },

      // 4. Request metadata
      requestId: req.headers['x-request-id'] || uuid(),
      ip:        req.ip,
    };
  },
});

// Any resolver accesses it as the 3rd argument:
Query: {
  me: (_, __, context) => {
    if (!context.user) throw new AuthenticationError('...');
    return context.db.users.findById(context.user.id);
  },
},
```

---

### Q3. Implement role-based authorization for an admin endpoint

**Question**: Only ADMIN users can call `deleteUser(id: ID!)`. Implement the resolver.

**Answer**:

```js
const resolvers = {
  Mutation: {
    deleteUser(_, { id }, context) {
      // 1. Authentication check — are you logged in at all?
      if (!context.user) {
        throw new AuthenticationError('You must be logged in');
      }

      // 2. Authorization check — do you have the right role?
      if (context.user.role !== 'ADMIN') {
        throw new ForbiddenError('Only administrators can delete users');
      }

      // 3. Business logic
      const idx = users.findIndex(u => u.id === id);
      if (idx === -1) throw new UserInputError(`User "${id}" not found`);

      // Prevent self-deletion
      if (id === context.user.userId) {
        throw new ForbiddenError('You cannot delete your own account');
      }

      const [deleted] = users.splice(idx, 1);
      return deleted;
    },
  },
};
```

---

### Q4. Where should auth logic live — middleware, context, or resolvers?

**Answer**:

```
CONTEXT FUNCTION — for authentication (who are you?)
  - Token verification runs once per request here
  - Sets context.user for all resolvers
  - Efficient: decoded once, used everywhere

RESOLVERS — for authorization (what can you do?)
  - Each resolver has different permission requirements
  - Fine-grained: some fields admin-only, some user-only, some public
  - Use guard helper functions: requireAuth(context), requireRole(context, 'ADMIN')

MIDDLEWARE (express middleware / Apollo plugins) — for cross-cutting concerns
  - Rate limiting
  - IP blocking
  - Request logging
  - NOT for fine-grained field-level auth

Schema directives — for declarative authorization (advanced)
  - @auth(role: "ADMIN") on a field definition
  - Cleaner schema, but more complex to implement
  - See Project 10 for directive implementation

Why NOT verify token inside each resolver:
  - Duplicated code across every protected resolver
  - Inconsistent application — easy to forget one resolver
  - Slower — verifying JWT is CPU-intensive (though minor)
```

---

### Q5. What is the `me` query pattern?

**Answer**:

```graphql
# Standard pattern: 'me' query returns the currently authenticated user
type Query {
  me: User   # null if not authenticated (don't make it User!)
}
```

```js
Query: {
  me(_, __, context) {
    // Return null instead of throwing for unauthenticated
    // Lets clients check "is anyone logged in?" without needing a try/catch
    if (!context.user) return null;

    return users.find(u => u.id === context.user.userId);
  },
},
```

```graphql
# Client usage — check before redirecting to login
query {
  me {
    id name email role
    # null response = not logged in → redirect to /login
  }
}
```

---

### Q6. What should you NOT include in a JWT payload?

**Answer**:

```
NEVER include in JWT:
  - Password (even hashed)
  - Credit card numbers, SSN, any PII beyond what's needed
  - Secrets, API keys

SAFE to include:
  - userId
  - email
  - role / permissions
  - iat (issued at — auto-added by jsonwebtoken)
  - exp (expiry — added when you set expiresIn)

Why:
  JWTs are base64-encoded, NOT encrypted.
  Anyone can decode a JWT and read its contents.
  It's only the SIGNATURE that prevents tampering.
  Never put sensitive data in it.

// Decode without verification (don't use this for auth — just for inspection):
const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
```

---

### Q7. How do you handle an expired JWT?

**Answer**:

```js
context({ req }) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return { user: null };

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { user: decoded };

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      // Option A: silently set user to null (public routes still work)
      return { user: null };

      // Option B: throw immediately — all queries fail with auth error
      // throw new AuthenticationError('Your session has expired. Please log in again.');
    }

    if (err.name === 'JsonWebTokenError') {
      // Tampered or invalid token
      return { user: null };
    }

    throw err; // unexpected error — re-throw
  }
},
```

---

## Key Takeaways

1. Auth flow: `login → JWT → Authorization header → context() → resolvers`.
2. The context function runs once per request. Decode JWT here, not in each resolver.
3. Use `AuthenticationError` for "not logged in". Use `ForbiddenError` for "not allowed".
4. Always use guard helper functions (`requireAuth`, `requireRole`) — don't repeat the check.
5. JWT payloads are base64-encoded, NOT encrypted. Never put sensitive data in them.
6. The `me` query is the standard pattern for "who am I?" in GraphQL APIs.
7. In production: use environment variables for JWT_SECRET. Never hardcode it.
