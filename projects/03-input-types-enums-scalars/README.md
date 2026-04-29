# Project 03 — Input Types, Enums & Custom Scalars

**System: Library Management API**
**Difficulty: Intermediate**

---

## What This Project Teaches

This project covers three schema-design tools that every real GraphQL API uses. Without these, your API will be messy, unvalidated, and hard to maintain. After this project, you will know exactly when and how to use each one.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| Node.js | Runtime |
| Apollo Server 3 | GraphQL server |
| graphql | Core library (for `GraphQLScalarType`, `Kind`) |

---

## Concepts Covered

- `input` type — wrapper objects for mutation arguments
- `enum` type — fixed set of validated values
- `GraphQLScalarType` — custom scalars with `serialize`, `parseValue`, `parseLiteral`
- Why `input` types are the industry standard for mutations
- Domain-specific mutation names (`borrowBook`, `returnBook`)
- Partial update pattern with `UpdateBookInput`

---

## Setup & Run

```bash
cd projects/03-input-types-enums-scalars
npm install
npm run dev
```

Open **http://localhost:4000**

---

## Project Structure

```
03-input-types-enums-scalars/
├── index.js        ← Schema + resolvers + custom scalars + server
├── package.json
└── README.md
```

---

## Core Concepts Explained

### `type` vs `input`

This is one of the most common interview questions:

```graphql
# 'type' = OUTPUT — returned to client, can have resolvers, can reference other types
type Book {
  id:     ID!
  title:  String!
  author: Author!  # can reference output types
}

# 'input' = INPUT — received from client in mutations
# Rules:
#   - Can ONLY contain: scalars, enums, other inputs
#   - CANNOT reference output types (Author, Book, etc.)
#   - CANNOT have resolvers
input CreateBookInput {
  title:    String!
  genre:    BookGenre!   # enum — allowed
  authorId: ID!          # scalar — allowed, NOT Author! (output type — NOT allowed)
}
```

### Why Input Types Instead of Individual Args

```graphql
# BAD — individual args (common beginner mistake)
mutation {
  createBook(title: String!, isbn: String!, genre: BookGenre!, authorId: ID!, publishedAt: DateTime!)
}

# GOOD — input type
mutation {
  createBook(input: CreateBookInput!)
}
```

Benefits of input types:
1. **Extendable** — add a field to `CreateBookInput` without breaking existing clients
2. **Reusable** — same input type can be used across multiple mutations
3. **Validatable** — validate the whole object at once
4. **Cleaner** — one argument instead of five

### Enum Types

```graphql
enum BookGenre {
  FICTION
  NON_FICTION
  TECHNOLOGY
  BIOGRAPHY
}
```

In JavaScript resolvers, enum values are plain strings: `'FICTION'`, `'TECHNOLOGY'`. GraphQL validates automatically — if a client sends `genre: ROMANCE` and ROMANCE is not in the enum, GraphQL rejects it before your resolver even runs.

### Custom Scalars — The 3 Hooks

```js
const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',

  // serialize: Called when SENDING value TO the client
  // JS value (from resolver) → JSON in HTTP response
  serialize(value) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    throw new Error('DateTime serialize: must be string or Date');
  },

  // parseValue: Called when receiving FROM client as a JSON VARIABLE
  // e.g.: variables: { "date": "2024-01-15" }
  parseValue(value) {
    if (typeof value !== 'string') throw new Error('DateTime must be a string');
    const d = new Date(value);
    if (isNaN(d.getTime())) throw new Error('Invalid DateTime');
    return value;
  },

  // parseLiteral: Called when value is INLINE in the query (not a variable)
  // e.g.: createBook(input: { publishedAt: "2024-01-15" })
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) throw new Error('DateTime must be a string literal');
    const d = new Date(ast.value);
    if (isNaN(d.getTime())) throw new Error('Invalid DateTime literal');
    return ast.value;
  },
});
```

**Production note**: Don't implement custom scalars manually. Use the `graphql-scalars` npm package — it has 50+ production-tested scalars: `DateTimeResolver`, `EmailAddressResolver`, `URLResolver`, `UUIDResolver`, etc.

---

## Mutations to Try

```graphql
# 1. Create a book using input type
mutation {
  createBook(input: {
    title: "The Pragmatic Programmer"
    isbn: "978-0201616224"
    genre: TECHNOLOGY
    authorId: "1"
    publishedAt: "1999-10-30"
  }) {
    success
    message
    book { id title genre status publishedAt }
  }
}

# 2. Try an invalid enum — will be rejected automatically
query {
  booksByGenre(genre: ROMANCE)  # ERROR: ROMANCE not in BookGenre enum
  { title }
}

# 3. Partial update — only change status
mutation {
  updateBook(id: "2", input: { status: AVAILABLE }) {
    success message
    book { title status }
  }
}

# 4. Domain-specific mutation
mutation {
  borrowBook(bookId: "1") {
    success message
    book { title status }
  }
}
```

---

## Interview Questions & Answers — Coding Round

---

### Q1. What is the difference between `type` and `input` in GraphQL?

**Answer**:

```
type  → OUTPUT type
  - Returned to the client in query/mutation responses
  - Can have resolvers (computed fields)
  - Can reference other output types bidirectionally
  - Used in: Query return types, Mutation return types

input → INPUT type
  - Sent FROM the client (mutation arguments)
  - CANNOT have resolvers
  - Can ONLY contain: scalars, enums, or other input types
  - CANNOT reference output types (circular dependency prevention)
  - Used in: mutation arguments

Common interview mistake to avoid:
  type CreateUserInput {     ← WRONG: using 'type' instead of 'input'
    name: String!
  }

  input CreateUserInput {    ← CORRECT
    name: String!
  }

  mutation {
    createUser(input: CreateUserInput!): User!  ← input type as argument
  }
```

---

### Q2. Design a schema for creating an Order with multiple items

**Question**: Write an input type for creating an order. An order has a customerId, delivery address, and multiple items (each with productId and quantity).

**Answer**:

```graphql
input OrderItemInput {
  productId: ID!
  quantity:  Int!
}

input AddressInput {
  street:  String!
  city:    String!
  state:   String!
  country: String!
  zipCode: String!
}

input CreateOrderInput {
  customerId:      ID!
  deliveryAddress: AddressInput!   # input type nesting other input types — allowed!
  items:           [OrderItemInput!]!
  notes:           String          # optional
}

type OrderResponse {
  success:  Boolean!
  message:  String!
  order:    Order
}

type Mutation {
  createOrder(input: CreateOrderInput!): OrderResponse!
}
```

---

### Q3. Implement a custom scalar for a positive integer

**Question**: Create a `PositiveInt` scalar that only accepts integers greater than 0.

**Answer**:

```js
import { GraphQLScalarType, Kind } from 'graphql';

const PositiveIntScalar = new GraphQLScalarType({
  name: 'PositiveInt',
  description: 'An integer greater than 0',

  // Output: JS value → JSON (just return the number, it's already valid)
  serialize(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0)
      throw new Error(`PositiveInt serialize: expected positive integer, got ${value}`);
    return n;
  },

  // Input from variable: { "count": 5 }
  parseValue(value) {
    if (!Number.isInteger(value) || value <= 0)
      throw new Error(`PositiveInt parseValue: expected positive integer, got ${value}`);
    return value;
  },

  // Input inline: field(count: 5)
  parseLiteral(ast) {
    if (ast.kind !== Kind.INT)
      throw new Error('PositiveInt parseLiteral: must be an integer literal');
    const n = parseInt(ast.value, 10);
    if (n <= 0)
      throw new Error(`PositiveInt: value must be > 0, got ${n}`);
    return n;
  },
});

// Register in resolvers:
const resolvers = {
  PositiveInt: PositiveIntScalar,
  // ... other resolvers
};
```

---

### Q4. When would you use an `enum` vs a `String`?

**Answer**:

```
Use ENUM when:
  - The field has a FIXED, KNOWN set of values that won't change often
  - You want automatic validation (invalid values rejected before resolver runs)
  - You want IDE autocomplete for clients
  - You want the values to be self-documenting

  Examples: status (ACTIVE/INACTIVE), role (USER/ADMIN), genre (FICTION/TECH),
            direction (ASC/DESC), day of week, HTTP method

Use STRING when:
  - Values are user-generated (can't predict all values)
  - Values change frequently or are configurable
  - Values come from an external system

  Examples: names, descriptions, titles, tags, messages

Common interview follow-up:
  "What happens if a client sends genre: 'ROMANCE' when ROMANCE isn't in the enum?"
  GraphQL rejects it BEFORE the resolver runs, returning a validation error.
  You get this validation for free — no resolver code needed.
```

---

### Q5. Why does an `input` type disallow output type fields?

**Answer**:

```
Reason 1 — Circular dependencies:
  If inputs could reference output types and output types could reference inputs,
  you could create impossible cycles:

  type User {
    settings: UserSettings!   ← output type
  }

  input UserSettingsInput {
    owner: User!  ← references output type — if allowed, User references
  }                 UserSettings which is the output of UserSettingsInput...

Reason 2 — Resolvers:
  Output types can have resolvers (computed fields, lazy loading).
  Input types are plain data containers — no resolver context, no async loading.
  Mixing them would create an incoherent execution model.

Reason 3 — Separation of concerns:
  Input shape (what clients send) and output shape (what server returns) are
  intentionally different. The server may expose more/different fields than
  what clients can set. Keeping them separate enforces this boundary.
```

---

### Q6. How do you register and use a custom scalar in Apollo Server?

**Answer**:

```js
// Step 1: Create the scalar
const EmailScalar = new GraphQLScalarType({
  name: 'Email',
  serialize: (v) => v,
  parseValue(v) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
      throw new Error('Invalid email format');
    return v.toLowerCase();
  },
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) throw new Error('Email must be a string');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ast.value))
      throw new Error('Invalid email format');
    return ast.value.toLowerCase();
  },
});

// Step 2: Declare in schema
const typeDefs = `
  scalar Email   # ← declare here

  type User {
    email: Email!  # ← use here
  }
`;

// Step 3: Register in resolvers (key must match scalar name exactly)
const resolvers = {
  Email: EmailScalar,  # ← register here
  Query: { ... },
};

// Step 4: Apollo Server automatically wires it together
const server = new ApolloServer({ typeDefs, resolvers });
```

---

## Key Takeaways

1. `input` types are for mutation arguments. `type` is for query/mutation return values.
2. Input types: only scalars, enums, other inputs. No output types, no resolvers.
3. Always use input types for mutations with more than 1-2 arguments — industry standard.
4. Enum values are validated automatically before your resolver runs.
5. Custom scalars need all 3 hooks: `serialize`, `parseValue`, `parseLiteral`.
6. In production, use `graphql-scalars` package instead of implementing your own.
