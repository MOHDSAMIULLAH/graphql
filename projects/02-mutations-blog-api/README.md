# Project 02 — Mutations & Blog API

**System: Full CRUD Blog API**
**Difficulty: Beginner → Intermediate**

---

## What This Project Teaches

Queries are read-only. As soon as you need to create, update, or delete data, you need **mutations**. This project builds a complete CRUD Blog API — the mutation equivalent of everything you learned in Project 01.

You will also learn the industry-standard **response wrapper pattern** (`{ success, message, post }`) which every serious GraphQL API uses instead of returning objects directly from mutations.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| Node.js | Runtime |
| Apollo Server 3 | GraphQL server |
| In-memory arrays | Mock database |

---

## Concepts Covered

- Defining `type Mutation` in the schema
- Create, Update, Delete resolvers
- Response wrapper types (`PostResponse`)
- Handling not-found errors gracefully
- Partial updates (only update provided fields)
- Input arguments for mutations
- `searchPosts` query with string filtering
- Mutable state management in resolvers

---

## Setup & Run

```bash
cd projects/02-mutations-blog-api
npm install
npm run dev
```

Open **http://localhost:4000**

---

## Project Structure

```
02-mutations-blog-api/
├── index.js        ← Schema + resolvers + server
├── package.json
└── README.md
```

---

## Core Concepts Explained

### Mutations vs Queries

```graphql
# Query: read-only, can run in parallel
type Query {
  posts: [Post!]!
}

# Mutation: writes data, runs SERIALLY (not in parallel)
type Mutation {
  createPost(title: String!, content: String!, authorId: ID!): PostResponse!
  updatePost(id: ID!, title: String, content: String): PostResponse!
  deletePost(id: ID!): PostResponse!
}
```

**Key rule**: Multiple mutations in one request run **sequentially** (one after another), not in parallel. Multiple queries run in parallel. This prevents race conditions in mutations.

### The Response Wrapper Pattern

Never return the raw type from a mutation. Always wrap it:

```graphql
# BAD — common beginner mistake
type Mutation {
  createPost(title: String!, content: String!): Post!
  # Problem: what if it fails? You have to throw an error.
  # The client has no typed way to know if it succeeded.
}

# GOOD — industry standard
type PostResponse {
  success: Boolean!
  message: String!
  post: Post        # nullable — null when operation failed
}

type Mutation {
  createPost(title: String!, content: String!): PostResponse!
  # Client always gets a typed response, success or failure.
  # No surprise errors[]. Clean, predictable.
}
```

### Partial Update Pattern

For update mutations, make all fields optional. Only update what's provided:

```js
updatePost: (_, args) => {
  const post = posts.find(p => p.id === args.id);

  // Only update fields that were actually passed
  if (args.title   !== undefined) post.title   = args.title;
  if (args.content !== undefined) post.content = args.content;

  // Or more elegantly:
  Object.assign(post, Object.fromEntries(
    Object.entries(args).filter(([k, v]) => k !== 'id' && v != null)
  ));
}
```

---

## Mutations to Try

```graphql
# 1. CREATE a post
mutation {
  createPost(
    title: "My First Post"
    content: "GraphQL mutations are powerful!"
    authorId: "1"
  ) {
    success
    message
    post {
      id
      title
      author { name }
    }
  }
}

# 2. UPDATE a post (partial — only title)
mutation {
  updatePost(id: "1", title: "Updated Title") {
    success
    message
    post { id title updatedAt }
  }
}

# 3. DELETE a post
mutation {
  deletePost(id: "4") {
    success
    message
    post { id title }   # returns the deleted post
  }
}

# 4. Try creating with a non-existent author
mutation {
  createPost(title: "Test", content: "Test", authorId: "999") {
    success   # false
    message   # "User with ID 999 not found"
    post      # null
  }
}

# 5. Search posts
query {
  searchPosts(query: "GraphQL") {
    id title content
    author { name }
  }
}
```

---

## Interview Questions & Answers — Coding Round

---

### Q1. What is the difference between a Query and a Mutation in GraphQL?

**Answer**:

```
Semantic difference:
  Query    → read-only operations (like HTTP GET)
  Mutation → write operations — create, update, delete (like POST, PUT, DELETE)

Execution difference:
  Queries    → execute in PARALLEL (multiple root query fields run concurrently)
  Mutations  → execute SERIALLY (one at a time, in order)

Why mutations are serial:
  If you have:
    mutation {
      createUser(name: "Alice")  ← runs first, completes fully
      deleteUser(id: "1")        ← then runs second
    }
  If they ran in parallel, you could delete a user that hasn't been created yet.
  Serial execution prevents race conditions.
```

---

### Q2. Implement `createPost` mutation resolver

```graphql
# Schema given:
type Mutation {
  createPost(title: String!, content: String!, authorId: ID!): PostResponse!
}
```

**Answer**:

```js
let nextPostId = 100;

const resolvers = {
  Mutation: {
    createPost(_, { title, content, authorId }) {
      // Step 1: Validate inputs
      if (!title.trim()) {
        return { success: false, message: 'Title cannot be empty', post: null };
      }

      // Step 2: Check foreign key exists
      const author = users.find(u => u.id === authorId);
      if (!author) {
        return {
          success: false,
          message: `Author with ID "${authorId}" not found`,
          post: null,
        };
      }

      // Step 3: Create the new record
      const post = {
        id:        String(nextPostId++),
        title:     title.trim(),
        content,
        authorId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Step 4: Persist (to in-memory array / DB)
      posts.push(post);

      // Step 5: Return success response
      return {
        success: true,
        message: 'Post created successfully',
        post,
      };
    },
  },
};
```

---

### Q3. Implement `updatePost` with partial update

**Question**: Allow updating only the fields provided. If `title` is not passed, don't change it.

**Answer**:

```js
const resolvers = {
  Mutation: {
    updatePost(_, { id, title, content }) {
      const post = posts.find(p => p.id === id);

      if (!post) {
        return {
          success: false,
          message: `Post with ID "${id}" not found`,
          post: null,
        };
      }

      // Only update what was passed (partial update)
      // Check `!== undefined` not `!= null` — because empty string "" is valid
      if (title   !== undefined) post.title   = title;
      if (content !== undefined) post.content = content;

      post.updatedAt = new Date().toISOString();

      return { success: true, message: 'Post updated', post };
    },
  },
};
```

---

### Q4. Implement `deletePost` and explain what to return

**Answer**:

```js
const resolvers = {
  Mutation: {
    deletePost(_, { id }) {
      const index = posts.findIndex(p => p.id === id);

      if (index === -1) {
        return {
          success: false,
          message: `Post "${id}" not found`,
          post: null,
        };
      }

      // splice returns array of removed items — we want the first (only) one
      const [deletedPost] = posts.splice(index, 1);

      // Return the deleted post — clients often need it to update their UI
      // (e.g., remove from list, show "Deleted: <title>" confirmation)
      return {
        success: true,
        message: 'Post deleted',
        post: deletedPost,
      };
    },
  },
};
```

---

### Q5. Why use a response wrapper type instead of returning Post directly?

**Answer**:

```
Direct return — the naive approach:
  createPost(...): Post!
  Problem 1: If creation fails, you MUST throw an error.
             Errors go to response.errors[] — not in the data shape.
  Problem 2: Client has no structured way to handle failures.
             They parse error message strings to understand what went wrong.

Response wrapper — the correct approach:
  createPost(...): PostResponse!

  type PostResponse {
    success: Boolean!
    message: String!
    post:    Post        ← null on failure
  }

  Advantages:
  1. Client always gets a predictable shape (success: true/false)
  2. Human-readable message for UI display
  3. post is null on failure — client handles this gracefully
  4. Can add extra fields: validationErrors, redirectTo, etc.
  5. No need to try/catch on the client side

In modern GraphQL, the Error Union pattern (Project 08) is even better
because it's fully type-safe. But the response wrapper is widely used and
acceptable in most projects.
```

---

### Q6. Write a `searchPosts` query resolver (case-insensitive search)

```graphql
type Query {
  searchPosts(query: String!): [Post!]!
}
```

**Answer**:

```js
const resolvers = {
  Query: {
    searchPosts: (_, { query }) => {
      // Always lowercase both sides for case-insensitive comparison
      const q = query.toLowerCase().trim();

      if (!q) return posts; // empty search = return all

      return posts.filter(post =>
        post.title.toLowerCase().includes(q) ||
        post.content.toLowerCase().includes(q)
      );
    },
  },
};
```

---

### Q7. How do multiple mutations in a single request execute?

```graphql
mutation {
  post1: createPost(title: "First",  content: "...", authorId: "1") { success }
  post2: createPost(title: "Second", content: "...", authorId: "1") { success }
  post3: createPost(title: "Third",  content: "...", authorId: "1") { success }
}
```

**Answer**:

```
Unlike queries (which run in parallel), mutations run SERIALLY:
  post1 starts → completes → post2 starts → completes → post3 starts → completes

This is guaranteed by the GraphQL spec to prevent race conditions.

The syntax above uses ALIASES (post1, post2, post3) to distinguish multiple
calls to the same mutation in one request. Without aliases, the field names
would collide in the response object.

Response shape:
{
  "data": {
    "post1": { "success": true },
    "post2": { "success": true },
    "post3": { "success": true }
  }
}
```

---

### Q8. What is the ID scalar type and when to use it vs Int?

**Answer**:

```
ID scalar:
  - Represents a unique identifier
  - Serialized as a String always (even if you pass a number)
  - GraphQL spec says IDs are always strings on the wire
  - Use ID! for: primary keys, foreign keys, any unique identifier field
  - Never use Int for IDs (IDs shouldn't be arithmetic-compared or summed)

Int scalar:
  - 32-bit signed integer
  - Use for: counts, ages, quantities, ratings, anything numeric

Example:
  type Post {
    id:    ID!     ← correct — unique identifier
    views: Int!   ← correct — count (numeric)
    authorId: ID! ← correct — foreign key reference
  }
```

---

## Key Takeaways

1. Mutations write data. Queries read data. They look similar but execute differently.
2. Multiple mutations in one request execute **serially** — guaranteed by spec.
3. Always use a **response wrapper type** for mutations — never return the raw type.
4. **Partial updates**: check `!== undefined` to know if a field was actually passed.
5. Return the **deleted object** from delete mutations — clients often need it for UI updates.
6. Use aliases when calling the same mutation multiple times in one request.
