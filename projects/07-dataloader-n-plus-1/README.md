# Project 07 — DataLoader & The N+1 Problem

**System: Social Network Feed**
**Difficulty: Advanced**

---

## What This Project Teaches

The N+1 problem is the single most important performance concept in GraphQL. Every interviewer asks about it. This project shows you the problem happening in real-time (watch the console logs), then solves it with DataLoader. You will see the query count drop from `N+1` to `2` by changing one line.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| Node.js | Runtime |
| Apollo Server 3 | GraphQL server |
| dataloader | Batching and caching library by Facebook |

---

## Concepts Covered

- What the N+1 problem is and why it happens
- How DataLoader batches IDs into a single call
- The batch function contract: `ids → results in the same order`
- Per-request DataLoader (why they must be in context, not module-level)
- Request-scoped caching (DataLoader deduplication)
- One-to-one and one-to-many DataLoader patterns
- Comparing console logs before and after

---

## Setup & Run

```bash
cd projects/07-dataloader-n-plus-1
npm install
npm run dev
```

Open **http://localhost:4000** and watch the **terminal/console** — the logs show every DB query.

---

## Project Structure

```
07-dataloader-n-plus-1/
├── index.js        ← Schema + resolvers + DataLoaders + server
├── package.json
└── README.md
```

---

## Core Concepts Explained

### The N+1 Problem

```
Query: { posts { title author { name } } }

Without DataLoader:
  Query #0:  SELECT * FROM posts              → returns 8 posts
  Query #1:  SELECT user WHERE id = 1         → author of post 1
  Query #2:  SELECT user WHERE id = 2         → author of post 2
  Query #3:  SELECT user WHERE id = 1         → author of post 3 (DUPLICATE!)
  Query #4:  SELECT user WHERE id = 3         → author of post 4
  ...8 more queries...
  TOTAL: 9 queries (1 + N = N+1)

With DataLoader:
  Query #0:  SELECT * FROM posts              → returns 8 posts
  Query #1:  SELECT users WHERE id IN (1,2,3) → ALL authors in ONE query
  TOTAL: 2 queries
```

With 100 posts: N+1 means **101 DB queries**. DataLoader means **2**.

### Why N+1 Happens

```js
// The Post.author field resolver is called ONCE PER POST:
Post: {
  author: (parent) => {
    // For 8 posts, this runs 8 times
    // Each call hits the database separately
    return db.users.findById(parent.authorId); // ← 8 separate DB calls
  },
},
```

GraphQL's resolver-per-field design is clean, but without batching, it fires a separate DB call for every item in a list.

### How DataLoader Solves It

DataLoader collects all IDs requested during a single **event loop tick**, then calls your batch function **once** with all collected IDs:

```js
// Without DataLoader: called 8 times separately
Post: {
  author: (parent) => getUserById(parent.authorId), // 8 DB calls
},

// With DataLoader: all 8 authorId values are batched into 1 call
Post: {
  author: (parent, _, context) => context.loaders.user.load(parent.authorId),
  //                                                         ^^^^ queues this ID
  // DataLoader collects: [1, 2, 1, 3, 4, 2, 1, 3]
  // Calls batch function once with: [1, 2, 3, 4] (deduplicated!)
  // Result: 1 DB call instead of 8
},
```

### The Batch Function Contract

```js
// The batch function receives an array of keys
// It MUST return a Promise that resolves to an array of values
// in the EXACT SAME ORDER as the input keys

const userLoader = new DataLoader(async (ids) => {
  // ids = ['1', '2', '3'] (all IDs collected in this tick)

  const users = await db.query('SELECT * FROM users WHERE id IN (?)', [ids]);

  // CRITICAL: return in the SAME ORDER as ids
  // If ids = ['1', '2', '3'], return [user1, user2, user3]
  // NOT: return users (DB might return them in different order!)
  return ids.map(id => users.find(u => u.id === id) ?? null);
  //     ^^ preserves order                            ^^ null for missing
});
```

### DataLoader Must Be Per-Request

```js
// WRONG — module-level DataLoader (shared across all requests)
const userLoader = new DataLoader(batchUsers); // Cache persists between requests!
//                                             // User A's data leaks to User B!

// CORRECT — create inside context() (per request)
const server = new ApolloServer({
  context() {
    return {
      loaders: {
        user: new DataLoader(batchUsers), // Fresh loader + cache per request
        post: new DataLoader(batchPosts),
      },
    };
  },
});
```

---

## Queries to Try

**Run these and watch the console logs — the difference is immediately visible.**

```graphql
# 1. WITHOUT DataLoader — see N+1 in console
query WithoutDataLoader {
  postsWithoutDataLoader {
    title likes
    author { name username }
  }
}
# Console shows: 9 separate DB queries (1 + 8)

# 2. WITH DataLoader — see batching in console
query WithDataLoader {
  postsWithDataLoader {
    title likes
    author { name username }
  }
}
# Console shows: 2 DB queries (1 post + 1 batched user query)

# 3. Deep nesting — posts + comments + comment authors
query Feed {
  feed {
    title
    author { name }
    comments {
      text
      author { name }   # also batched with post authors!
    }
  }
}
# DataLoader even batches across different resolver levels!
```

---

## Interview Questions & Answers — Coding Round

---

### Q1. What is the N+1 problem? Explain with an example.

**Answer**:

```
The N+1 problem occurs when you fetch a list of N items, and then make
a separate database query for each item's related data, resulting in
N+1 total queries.

Example:
  Schema: type Post { author: User! }
  Query:  { posts { title author { name } } }

  What happens without DataLoader:
    Query 1:  SELECT * FROM posts               → 10 posts
    Query 2:  SELECT * FROM users WHERE id = 5  → post1's author
    Query 3:  SELECT * FROM users WHERE id = 3  → post2's author
    Query 4:  SELECT * FROM users WHERE id = 5  → post3's author (SAME AS Q2!)
    ...
    Query 11: SELECT * FROM users WHERE id = 8  → post10's author
    TOTAL: 11 queries (1 + 10)

Why it's invisible:
  The schema and resolvers look completely correct.
  Post.author resolver is simple: (parent) => db.users.findById(parent.authorId)
  The problem only appears at runtime when you have lists of data.

Why it's deadly:
  10 posts   → 11 DB queries
  100 posts  → 101 DB queries
  1000 posts → 1001 DB queries (can crash your DB under load)
```

---

### Q2. Implement a DataLoader for the N+1 problem

**Question**: You have a `Post.author` resolver causing N+1. Fix it with DataLoader.

**Answer**:

```js
import DataLoader from 'dataloader';

// Step 1: Write the batch function
// Receives array of userIds, must return array of users in SAME ORDER
async function batchLoadUsers(userIds) {
  console.log(`Batching ${userIds.length} user IDs: [${userIds.join(', ')}]`);

  // In real app with a database:
  // const users = await db.query('SELECT * FROM users WHERE id = ANY($1)', [userIds]);

  // With in-memory data:
  const users = userIds.map(id => usersDB.find(u => u.id === id) ?? null);
  return users;
  // MUST return in same order as input: if input = ['3', '1', '2']
  // return [user3, user1, user2]  — not sorted, not random
}

// Step 2: Create loader in context (per request!)
const server = new ApolloServer({
  context() {
    return {
      loaders: {
        user: new DataLoader(batchLoadUsers),
      },
    };
  },
});

// Step 3: Use loader in resolver
const resolvers = {
  Post: {
    // Before: (parent) => usersDB.find(u => u.id === parent.authorId)  ← N+1
    // After:
    author(parent, _, context) {
      return context.loaders.user.load(parent.authorId); // batched!
    },
  },
};
```

---

### Q3. Why must DataLoaders be created inside the context function?

**Answer**:

```
DataLoader has a built-in cache: it remembers results by key within one request.
If loader.load('user:1') is called twice in the same request, it only hits
the DB once — the second call returns the cached result.

The cache is keyed by the loader instance. So:

WRONG — module level (one loader for ALL requests):
  const userLoader = new DataLoader(batchUsers);
  // Request A: loads user 1 (cached as { name: 'Alice' })
  // Alice updates her name to 'Alicia'
  // Request B: loads user 1 — GETS STALE CACHED 'Alice' (data from Request A!)
  // Also: User A's data might leak to User B (security issue!)

CORRECT — inside context() (one loader per request):
  context() {
    return {
      loaders: {
        user: new DataLoader(batchUsers)  // fresh instance every request
      }
    }
  }
  // Each request gets its own loader with its own empty cache
  // No stale data, no data leaking between users
```

---

### Q4. What does DataLoader's batch function receive and what must it return?

**Answer**:

```js
// The batch function receives an array of keys (deduplicated within a tick)
// It must return a Promise resolving to an array of values
// VALUES MUST BE IN THE SAME ORDER AS KEYS

async function batchLoadUsers(userIds) {
  // userIds = ['1', '3', '2'] — the collected IDs

  const rows = await db.query(
    'SELECT * FROM users WHERE id IN (?)',
    [userIds]
  );
  // rows might come back in DB order: [user1, user3, user2] — might differ!

  // MUST map back to input order:
  return userIds.map(id => {
    const user = rows.find(r => r.id === id);
    return user ?? null;  // null for missing IDs (DataLoader expects null, not undefined)
  });
}

// For one-to-many (user → posts):
async function batchLoadPostsByAuthor(authorIds) {
  const posts = await db.query('SELECT * FROM posts WHERE author_id IN (?)', [authorIds]);

  // Return array of arrays — one array per authorId
  return authorIds.map(id => posts.filter(p => p.authorId === id));
  // if authorIds = ['1', '2']
  // returns: [[post1, post2], [post3]]  ← arrays, not single items
}
```

---

### Q5. Does DataLoader cache results? How?

**Answer**:

```
YES — DataLoader has a per-instance cache (Map by default).

How it works:
  loader.load('user:1')  → hits DB, caches { id: '1', name: 'Alice' }
  loader.load('user:1')  → returns from cache (no DB call!)
  loader.load('user:2')  → hits DB, caches { id: '2', name: 'Bob' }
  loader.load('user:1')  → returns from cache again

The cache is scoped to ONE loader instance (one request).
It does NOT persist between requests (if created in context()).

When to disable caching:
  If you expect data to change during a single request (rare):
  const loader = new DataLoader(batchFn, { cache: false });

Cache priming (add data manually to avoid DB calls):
  // If you already have the user object from a previous query:
  context.loaders.user.prime('1', user);
  // Now loader.load('1') returns the primed value without hitting DB
```

---

### Q6. How does DataLoader handle duplicate IDs in the same batch?

**Answer**:

```js
// If multiple resolvers request the same ID in one tick:
posts.forEach(post => context.loaders.user.load(post.authorId));
// Suppose all 10 posts have the same authorId: '1'
// DataLoader collects: ['1', '1', '1', '1', '1', '1', '1', '1', '1', '1']
// Deduplicates to:     ['1']
// Calls batch function with: ['1']  — just ONE DB call!
// Returns the cached result to all 10 resolvers

// This deduplication is automatic — you don't need to do anything.
// It's one of DataLoader's key features alongside batching.
```

---

## Key Takeaways

1. N+1: fetching N items with a child field = N+1 DB queries. With 1000 items → 1001 queries.
2. DataLoader batches all `.load(id)` calls in one event loop tick into a single batch function call.
3. Batch function contract: `(ids) => Promise<values in same order as ids>`.
4. **Always create DataLoaders in context()** (per request). Never at module level.
5. DataLoader deduplicates keys automatically — calling `.load('1')` 10 times = 1 DB call.
6. DataLoader has per-request caching — second call for the same key returns from cache.
7. For one-to-many (user → posts): batch function returns arrays of arrays.
