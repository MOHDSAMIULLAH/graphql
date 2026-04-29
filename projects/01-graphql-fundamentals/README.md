# Project 01 — GraphQL Fundamentals

**System: Users & Posts API**
**Difficulty: Beginner**

---

## What This Project Teaches

This is your starting point. Before you can do anything in GraphQL, you need to understand three things: the **type system**, **queries**, and **resolvers**. This project gives you all three in one clean, runnable example.

You will build a simple Users & Posts API where users have posts and posts have authors. This relationship — one-to-many, bidirectionally queryable — is the most common pattern you will see in every real-world GraphQL API.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| Node.js | Runtime |
| Apollo Server 3 | GraphQL server |
| In-memory arrays | Mock database (no DB setup needed) |

---

## Concepts Covered

- What a GraphQL schema is and how to write one
- Scalar types: `String`, `Int`, `Float`, `Boolean`, `ID`
- Object types: `User`, `Post`
- The `Query` root type — entry point for reading data
- Non-null (`!`) vs nullable fields
- Writing resolver functions
- The 4 resolver arguments: `parent`, `args`, `context`, `info`
- Nested / field resolvers: resolving `User.posts` and `Post.author`
- How GraphQL executes a query tree (lazy evaluation)

---

## Setup & Run

```bash
cd projects/01-graphql-fundamentals
npm install
npm run dev
```

Open **http://localhost:4000** — Apollo Sandbox loads automatically.

---

## Project Structure

```
01-graphql-fundamentals/
├── index.js        ← Everything: schema + resolvers + server
├── package.json
└── README.md
```

---

## Core Concepts Explained

### The Schema

The schema is a contract between client and server. Clients can only ask for what is in the schema — nothing more.

```graphql
type User {
  id:    ID!
  name:  String!
  email: String!
  age:   Int!
  posts: [Post!]!   # field resolver — computed at query time, not stored in DB
}

type Post {
  id:      ID!
  title:   String!
  content: String!
  author:  User!    # field resolver — looks up the author by authorId
}

type Query {
  users:         [User!]!
  user(id: ID!): User
  posts:         [Post!]!
  post(id: ID!): Post
}
```

### The 4 Resolver Arguments

Every resolver function receives exactly these 4 arguments in this order:

```js
fieldName(parent, args, context, info) { ... }
```

| Argument | What It Is | When You Use It |
|----------|------------|-----------------|
| `parent` | Return value of the parent resolver | Field resolvers (`User.posts`, `Post.author`) |
| `args` | Arguments passed in the query (`id: "1"`) | Filtering, looking up by ID |
| `context` | Shared object per request: DB, auth user, DataLoaders | Auth checks, DB queries |
| `info` | AST of the query, field path, schema | Advanced: query analysis, partial caching |

### Root Resolvers vs Field Resolvers

```js
const resolvers = {
  // ROOT RESOLVERS — entry points, called first
  Query: {
    users: () => users,           // parent is undefined for root resolvers
    user:  (_, args) => users.find(u => u.id === args.id),
  },

  // FIELD RESOLVERS — called only when that field is requested
  User: {
    // parent = the User object returned by the Query.users resolver
    posts: (parent) => posts.filter(p => p.authorId === parent.id),
  },

  Post: {
    // parent = the Post object
    author: (parent) => users.find(u => u.id === parent.authorId),
  },
};
```

Field resolvers only execute when the client actually requests that field. This is **lazy evaluation** — if the client doesn't ask for `author`, that resolver never runs.

### Non-null (`!`) Rules

```graphql
String      # can be null or a string
String!     # NEVER null — resolver returning null here causes an error
[Post!]!    # non-null list of non-null posts
[Post]      # nullable list of nullable posts (both list and items can be null)
[Post!]     # non-null items, but the list itself can be null
```

---

## Queries to Try

```graphql
# 1. Get all users
query {
  users { id name email }
}

# 2. Get one user with their posts (nested query — one HTTP request)
query {
  user(id: "1") {
    name
    email
    posts { title content }
  }
}

# 3. Get posts with author info (reverse direction)
query {
  posts {
    title
    author { name email }
  }
}

# 4. Ask only for what you need (no over-fetching)
query {
  users {
    name   # only name — age, email, posts are NOT fetched
  }
}
```

---

## Interview Questions & Answers — Coding Round

---

### Q1. Write a GraphQL schema for a Product with a Category

**Question**: Design a schema for a `Product` that belongs to a `Category`. Support querying all products, one product by ID, and all products in a category.

**Answer**:

```graphql
type Category {
  id:       ID!
  name:     String!
  products: [Product!]!
}

type Product {
  id:       ID!
  name:     String!
  price:    Float!
  inStock:  Boolean!
  category: Category!
}

type Query {
  products:                        [Product!]!
  product(id: ID!):                Product
  productsByCategory(categoryId: ID!): [Product!]!
  categories:                      [Category!]!
}
```

---

### Q2. Implement the `user(id: ID!): User` resolver

**Given**:
```js
const users = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob',   email: 'bob@example.com'   },
];
```

**Answer**:

```js
const resolvers = {
  Query: {
    // parent is undefined for root queries — use _ as convention
    user: (_, args) => {
      return users.find(u => u.id === args.id) ?? null;
    },

    // Cleaner with destructuring:
    user: (_, { id }) => users.find(u => u.id === id) ?? null,
  },
};
```

---

### Q3. What happens if a resolver returns `undefined` for a `String!` field?

**Answer**:

GraphQL throws a field-level error: `"Cannot return null for non-nullable field User.name"`.

The error **propagates upward** until it hits a nullable field, setting all ancestors to null.

```js
// This will cause a runtime GraphQL error:
User: {
  name: (parent) => undefined  // String! field — GraphQL rejects this
}

// Fix: ensure you always return a valid string
User: {
  name: (parent) => parent.name ?? 'Unknown',
}
```

---

### Q4. Implement a `Post.author` field resolver

**Schema**: `type Post { author: User! }`  
**Data**: Posts store `authorId`, not the full author object.

**Answer**:

```js
const resolvers = {
  Post: {
    // parent = the Post object e.g. { id: '1', title: '...', authorId: '2' }
    author: (parent) => {
      return users.find(u => u.id === parent.authorId) ?? null;
    },
  },
};

// IMPORTANT: this resolver is called ONCE PER POST that is returned.
// If 10 posts are returned, this runs 10 times → the N+1 problem (see Project 07).
```

---

### Q5. What is the difference between GraphQL and REST?

**Answer**:

```
REST Problem 1 — Over-fetching:
  GET /users/1  → { id, name, email, age, address, phone, createdAt, ... }
  You needed only 'name' — got everything

REST Problem 2 — Under-fetching (N+1 HTTP requests):
  To get user + posts + comments:
    GET /users/1
    GET /users/1/posts
    GET /posts/1/comments
    GET /posts/2/comments
    = 4+ round trips

GraphQL solution — one request, exactly what you need:
  query {
    user(id: "1") {
      name
      posts {
        title
        comments { text }
      }
    }
  }
```

---

### Q6. Write a resolver for `users(minAge: Int): [User!]!`

**Answer**:

```js
const resolvers = {
  Query: {
    users: (_, { minAge }) => {
      if (minAge == null) return users;  // no filter, return all
      return users.filter(u => u.age >= minAge);
    },
  },
};
```

---

### Q7. Explain resolver execution order for a nested query

```graphql
query { users { name posts { title } } }
```

**Answer**:

```
1. Query.users()         → returns [user1, user2, user3]
2. User.name(user1)      → default resolver: user1.name
3. User.posts(user1)     → filter posts where authorId === user1.id → [post1, post2]
4. Post.title(post1)     → default resolver: post1.title
5. Post.title(post2)     → default resolver: post2.title
...repeats for user2, user3

Key insight: User.posts runs ONCE PER USER.
With 100 users → User.posts called 100 times → 100 separate DB queries.
This is the N+1 problem. Solution: DataLoader (Project 07).
```

---

## Key Takeaways

1. Schema = contract. Clients can only ask for what is in the schema.
2. Every field has a resolver. If you don't write one, GraphQL uses the default: `(parent) => parent[fieldName]`.
3. Field resolvers only run when the client asks for that field — lazy evaluation.
4. The 4 resolver args: `parent`, `args`, `context`, `info`. Learn these cold.
5. Non-null `!` is a promise. If you break it, GraphQL propagates the error upward.
6. `User.posts` runs once per user — this is where N+1 comes from.
