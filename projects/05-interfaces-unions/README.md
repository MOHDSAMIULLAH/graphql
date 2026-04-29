# Project 05 — Interfaces & Union Types

**System: Multi-type Media Library & Search**
**Difficulty: Intermediate**

---

## What This Project Teaches

Real APIs return polymorphic data — search results that can be a Book, Movie, or Podcast; notifications that can be a Like, Comment, or Follow. GraphQL handles this with two tools: **interfaces** (shared contract) and **unions** (pure grouping). This project shows you both, side-by-side, with real examples.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| Node.js | Runtime |
| Apollo Server 3 | GraphQL server |
| graphql | Core library |

---

## Concepts Covered

- `interface` — defines a shared contract across multiple types
- `implements` — a type fulfilling an interface contract
- `union` — groups types with no required shared fields
- `__resolveType` — runtime type discrimination for interfaces and unions
- Inline fragments (`... on TypeName`) — querying type-specific fields
- `__typename` — built-in field that returns the type name
- Realistic use cases: search results, notification feeds, activity streams

---

## Setup & Run

```bash
cd projects/05-interfaces-unions
npm install
npm run dev
```

Open **http://localhost:4000**

---

## Project Structure

```
05-interfaces-unions/
├── index.js        ← Schema + resolvers + server
├── package.json
└── README.md
```

---

## Core Concepts Explained

### Interface

An interface is a contract: every type that `implements` it must provide all interface fields.

```graphql
interface Media {
  id:        ID!
  title:     String!
  createdAt: String!
}

# Book must have all Media fields PLUS its own
type Book implements Media {
  id:        ID!        # required by interface
  title:     String!    # required by interface
  createdAt: String!    # required by interface
  author:    String!    # Book-specific
  pages:     Int!       # Book-specific
}

type Movie implements Media {
  id:        ID!
  title:     String!
  createdAt: String!
  director:  String!    # Movie-specific
  duration:  Int!       # Movie-specific
}

type Query {
  allMedia: [Media!]!   # returns Books, Movies, Podcasts — all are Media
}
```

### Union

A union groups types together. No shared fields required.

```graphql
union SearchResult = Book | Movie | Podcast | Song

type Query {
  search(query: String!): [SearchResult!]!
}
```

Use union when the types have nothing in common and you just want a "could be any of these" return type.

### `__resolveType` — Required for Both

GraphQL needs to know the concrete type at runtime. You implement `__resolveType`:

```js
const resolvers = {
  // For interface:
  Media: {
    __resolveType(obj) {
      // Inspect the object and return the type name string
      if (obj.__type === 'Book')    return 'Book';
      if (obj.__type === 'Movie')   return 'Movie';
      if (obj.__type === 'Podcast') return 'Podcast';
      return null; // GraphQL will error if this happens
    },
  },

  // For union:
  SearchResult: {
    __resolveType(obj) {
      return obj.__type; // same logic
    },
  },
};
```

**Two strategies for `__resolveType`**:

```js
// Strategy 1: Discriminator field (explicit, recommended)
__resolveType(obj) { return obj.__type; }

// Strategy 2: Duck typing (check for type-specific fields)
__resolveType(obj) {
  if (obj.isbn)     return 'Book';
  if (obj.director) return 'Movie';
  if (obj.host)     return 'Podcast';
}
```

### Inline Fragments — Querying Type-Specific Fields

```graphql
# Interface query — shared fields only (no inline fragments needed)
query {
  allMedia {
    id title createdAt __typename
  }
}

# Interface query — with type-specific fields using inline fragments
query {
  allMedia {
    id title createdAt __typename   # shared fields

    ... on Book {                   # only when item is a Book
      author pages isbn
    }
    ... on Movie {                  # only when item is a Movie
      director duration rating
    }
  }
}

# Union query — MUST use inline fragments (no shared fields)
query {
  search(query: "nolan") {
    __typename                      # always include __typename with unions
    ... on Book  { title author }
    ... on Movie { title director rating }
  }
}
```

### Interface vs Union — Decision Guide

```
Use INTERFACE when:
  - Types share common fields that clients always need
  - You want to enforce a contract (all implementing types must have these fields)
  - Examples: Media (id, title), Node (id), Searchable (title, score)

Use UNION when:
  - Types have nothing in common
  - You just want "this field can be one of several types"
  - Examples: SearchResult, NotificationPayload, MutationResult
```

---

## Queries to Try

```graphql
# 1. Query all media — shared fields only
query {
  allMedia {
    id title createdAt __typename
  }
}

# 2. Query all media — with type-specific fields
query {
  allMedia {
    id title createdAt __typename
    ... on Book    { author pages }
    ... on Movie   { director rating }
    ... on Podcast { host episodes }
    ... on Song    { artist album }
  }
}

# 3. Search — union type (must use inline fragments)
query {
  search(query: "christopher") {
    __typename
    ... on Movie { title director duration rating }
    ... on Book  { title author }
  }
}

# 4. Notifications — realistic union use case
query {
  notifications {
    __typename
    ... on LikeNotification    { liker post }
    ... on CommentNotification { commenter comment }
    ... on FollowNotification  { follower followedAt }
  }
}
```

---

## Interview Questions & Answers — Coding Round

---

### Q1. What is the difference between interface and union in GraphQL?

**Answer**:

```
INTERFACE:
  - Defines SHARED FIELDS that all implementing types must have
  - Used when types share common structure
  - Client can query shared fields WITHOUT inline fragments
  - Example: Media { id, title, createdAt } — Book, Movie, Podcast all share these

UNION:
  - Groups types with NO required shared fields
  - Types just "belong to the same logical group"
  - Client MUST use inline fragments for ALL fields (no shared fields to query directly)
  - Example: SearchResult = User | Post | Comment — these share nothing

Decision rule:
  Ask "do these types share fields that clients always need?"
  YES → interface
  NO  → union

Common trick question:
  "Can a type implement multiple interfaces?"
  YES: type Post implements Node & Searchable & Timestamped { ... }

  "Can a union contain types that implement interfaces?"
  YES: union Result = Book | Movie (both can implement Media interface)
```

---

### Q2. Implement a `__resolveType` for a `SearchResult` union

**Given**:
```graphql
union SearchResult = User | Post | Comment
```

**Answer**:

```js
const resolvers = {
  SearchResult: {
    __resolveType(obj) {
      // Strategy 1: explicit discriminator property (most reliable)
      if (obj.__typename) return obj.__typename;

      // Strategy 2: duck typing (check for type-specific fields)
      if (obj.email)   return 'User';    // only User has email
      if (obj.title)   return 'Post';    // only Post has title
      if (obj.comment) return 'Comment'; // only Comment has comment

      // Strategy 3: instanceof (if using class instances)
      if (obj instanceof User)    return 'User';
      if (obj instanceof Post)    return 'Post';
      if (obj instanceof Comment) return 'Comment';

      return null; // must not reach here — GraphQL will error
    },
  },
};

// Best practice: attach __typename when storing data
const users = [{ id: '1', __typename: 'User', name: 'Alice', email: 'alice@example.com' }];
const posts = [{ id: '1', __typename: 'Post', title: 'Hello', content: '...' }];
```

---

### Q3. Design a notifications system using a union type

**Question**: Design a schema for notifications where each notification can be a LikeNotification, CommentNotification, or FollowNotification. Each type has different fields.

**Answer**:

```graphql
union Notification = LikeNotification | CommentNotification | FollowNotification

type LikeNotification {
  id:        ID!
  liker:     String!
  postTitle: String!
  likedAt:   String!
}

type CommentNotification {
  id:        ID!
  commenter: String!
  preview:   String!   # first 100 chars of comment
  postTitle: String!
  commentedAt: String!
}

type FollowNotification {
  id:         ID!
  follower:   String!
  followedAt: String!
}

type Query {
  notifications(userId: ID!): [Notification!]!
}
```

```js
// Resolver
const resolvers = {
  Query: {
    notifications: (_, { userId }) => getNotificationsForUser(userId),
  },
  Notification: {
    __resolveType: (obj) => obj.__typename,
  },
};

// Client query:
// query {
//   notifications(userId: "1") {
//     __typename
//     ... on LikeNotification    { liker postTitle likedAt }
//     ... on CommentNotification { commenter preview postTitle }
//     ... on FollowNotification  { follower followedAt }
//   }
// }
```

---

### Q4. What is `__typename` and when do you use it?

**Answer**:

```
__typename is a built-in meta-field available on EVERY GraphQL type.
It returns the name of the type as a string: "User", "Post", "Book", etc.

Use cases:

1. Discriminating union types (most common):
   search { __typename ... on User { name } ... on Post { title } }
   → Response: [{ __typename: "User", name: "Alice" }, { __typename: "Post", title: "..." }]
   Client reads __typename to know how to render each item.

2. Conditional rendering on frontend:
   if (result.__typename === 'InsufficientFundsError') {
     showInsufficientFundsUI(result);
   }

3. Client-side cache keys:
   Apollo Client uses __typename + id as the cache key for normalization.
   This is why Apollo Client automatically adds __typename to every query.

4. Debugging:
   Add __typename anywhere to see what type GraphQL is resolving.

Note: __typename is NEVER null — it always returns a string.
```

---

### Q5. Can you query an interface field WITHOUT inline fragments?

**Answer**:

```graphql
interface Media {
  id:    ID!
  title: String!
}

type Book implements Media {
  id:      ID!
  title:   String!
  author:  String!   # Book-specific
}

# Query 1: interface fields — NO inline fragment needed
query {
  allMedia {
    id     # works — defined on interface
    title  # works — defined on interface
  }
}

# Query 2: type-specific fields — inline fragment REQUIRED
query {
  allMedia {
    id title
    ... on Book { author }  # REQUIRED for Book-specific fields
  }
}

# Query 3: trying to access type-specific field WITHOUT inline fragment — ERROR
query {
  allMedia {
    id title author  # ERROR: 'author' is not on the Media interface
  }
}
```

---

### Q6. Write a `search` resolver that returns multiple types

**Answer**:

```js
const resolvers = {
  Query: {
    search(_, { query }) {
      const q = query.toLowerCase();

      const matchingUsers = users
        .filter(u => u.name.toLowerCase().includes(q))
        .map(u => ({ ...u, __typename: 'User' }));

      const matchingPosts = posts
        .filter(p => p.title.toLowerCase().includes(q) ||
                     p.content.toLowerCase().includes(q))
        .map(p => ({ ...p, __typename: 'Post' }));

      // Combine and return — GraphQL uses __resolveType to distinguish them
      return [...matchingUsers, ...matchingPosts];
    },
  },

  SearchResult: {
    __resolveType: (obj) => obj.__typename,
  },
};
```

---

## Key Takeaways

1. Interface = shared contract + shared fields. Union = grouping only, no shared fields.
2. `__resolveType` is REQUIRED for interfaces and unions — without it, GraphQL can't resolve types.
3. With interfaces: shared fields are queryable without inline fragments.
4. With unions: ALL fields require inline fragments (`... on TypeName`).
5. Always include `__typename` in your queries on polymorphic types — clients need it.
6. A type can implement multiple interfaces. A union can contain interface-implementing types.
7. The discriminator property strategy (`obj.__typename`) is the most reliable for `__resolveType`.
