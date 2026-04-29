/**
 * ============================================================
 * MINI PROJECT 7: DataLoader & The N+1 Problem
 * System: Social Network Feed
 * ============================================================
 *
 * THE N+1 PROBLEM — The most critical GraphQL performance issue:
 * ──────────────────────────────────────────────────────────────
 * Imagine querying 10 posts, each with an author field:
 *
 *   query { posts { title author { name } } }
 *
 * WITHOUT DataLoader:
 *   1 query → get 10 posts
 *   10 queries → get each post's author (1 per post)
 *   TOTAL: 11 queries (1 + N = "N+1")
 *   With 1000 posts → 1001 database queries! 💀
 *
 * WITH DataLoader:
 *   1 query → get 10 posts
 *   1 query → get ALL 10 authors in one batch: WHERE id IN (1,2,3,...,10)
 *   TOTAL: 2 queries
 *
 * HOW DATALOADER WORKS:
 * ─────────────────────
 * DataLoader collects all IDs requested during ONE event loop tick,
 * then calls your batch function ONCE with all collected IDs.
 * It also caches results within a request (no duplicate DB calls).
 *
 * KEY RULE: Create DataLoaders INSIDE the context function (per request),
 * NOT at module level. This ensures:
 *   - Cache is request-scoped (not shared between users)
 *   - No stale data from previous requests
 *
 * INTERVIEW Q&A:
 * ──────────────
 * Q: What is the N+1 problem in GraphQL?
 * A: When fetching a list of N items and each item triggers a separate
 *    database query for a related resource, you end up with N+1 total
 *    queries. It's invisible in schema design but devastating in production.
 *
 * Q: How does DataLoader solve N+1?
 * A: DataLoader batches all IDs requested in a single JS event loop tick
 *    into a single batch function call. It also caches results per request.
 *    Instead of 1 DB call per item, you get 1 DB call for all items.
 *
 * Q: Where do you create DataLoaders?
 * A: Inside the Apollo context function — per request. This ensures each
 *    request has a fresh cache. Never create them at module level.
 *
 * Q: Can DataLoader work with any data source?
 * A: Yes — it's data-source agnostic. You write the batch function,
 *    which can call a database, REST API, or any async data source.
 *
 * RUN: npm install && npm run dev
 * OPEN: http://localhost:4000
 *
 * Watch the console logs — they will clearly show the difference
 * between N+1 (without DataLoader) and batched queries (with DataLoader).
 */

import { ApolloServer } from 'apollo-server';
import DataLoader from 'dataloader';

// ─── MOCK DATABASE ────────────────────────────────────────────────────────────
const usersDB = [
  { id: '1', name: 'Alice',   username: 'alice',   avatar: '👩' },
  { id: '2', name: 'Bob',     username: 'bob',     avatar: '👨' },
  { id: '3', name: 'Charlie', username: 'charlie', avatar: '🧑' },
  { id: '4', name: 'Diana',   username: 'diana',   avatar: '👩‍💼' },
];

const postsDB = [
  { id: '1',  title: 'GraphQL is Amazing',     likes: 42, authorId: '1', createdAt: '2024-01-01' },
  { id: '2',  title: 'Node.js Performance',    likes: 31, authorId: '2', createdAt: '2024-01-02' },
  { id: '3',  title: 'TypeScript Tips',        likes: 28, authorId: '1', createdAt: '2024-01-03' },
  { id: '4',  title: 'React Hooks Deep Dive',  likes: 55, authorId: '3', createdAt: '2024-01-04' },
  { id: '5',  title: 'CSS Grid Mastery',       likes: 19, authorId: '4', createdAt: '2024-01-05' },
  { id: '6',  title: 'Async/Await Patterns',   likes: 37, authorId: '2', createdAt: '2024-01-06' },
  { id: '7',  title: 'Docker for Developers',  likes: 44, authorId: '3', createdAt: '2024-01-07' },
  { id: '8',  title: 'GraphQL Subscriptions',  likes: 61, authorId: '1', createdAt: '2024-01-08' },
];

const commentsDB = [
  { id: '1', text: 'Great post!',  postId: '1', authorId: '2' },
  { id: '2', text: 'Very helpful', postId: '1', authorId: '3' },
  { id: '3', text: 'Love this',    postId: '2', authorId: '1' },
  { id: '4', text: 'Well written', postId: '3', authorId: '4' },
  { id: '5', text: 'Thanks!',      postId: '4', authorId: '1' },
];

// ─── "DATABASE" FUNCTIONS (simulate async DB calls with query counting) ───────
let queryCount = 0; // Track total DB queries — key metric!

function getUserById(id) {
  queryCount++;
  console.log(`  📦 DB Query #${queryCount}: SELECT user WHERE id = ${id}`);
  return usersDB.find(u => u.id === id) ?? null;
}

// Batch function: receives array of IDs, returns array of results in SAME ORDER
// This is what DataLoader calls — ONE call per event loop tick
function getUsersByIds(ids) {
  queryCount++;
  console.log(`  📦 DB Query #${queryCount}: SELECT users WHERE id IN (${ids.join(', ')}) ← BATCHED!`);
  // CRITICAL: must return results in SAME ORDER as input ids
  return ids.map(id => usersDB.find(u => u.id === id) ?? null);
}

function getPostsByAuthorId(authorId) {
  queryCount++;
  console.log(`  📦 DB Query #${queryCount}: SELECT posts WHERE authorId = ${authorId}`);
  return postsDB.filter(p => p.authorId === authorId);
}

function getPostsByAuthorIds(authorIds) {
  queryCount++;
  console.log(`  📦 DB Query #${queryCount}: SELECT posts WHERE authorId IN (${authorIds.join(', ')}) ← BATCHED!`);
  // For one-to-many (user → posts), return array of arrays
  return authorIds.map(id => postsDB.filter(p => p.authorId === id));
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const typeDefs = `
  type User {
    id:       ID!
    name:     String!
    username: String!
    avatar:   String!
    posts:    [Post!]!
  }

  type Post {
    id:        ID!
    title:     String!
    likes:     Int!
    author:    User!      # This field CAUSES N+1 if not using DataLoader
    comments:  [Comment!]!
    createdAt: String!
  }

  type Comment {
    id:     ID!
    text:   String!
    author: User!         # Another potential N+1
    post:   Post!
  }

  type Query {
    """Fetches posts WITHOUT DataLoader — shows N+1 problem in console logs"""
    postsWithoutDataLoader: [Post!]!

    """Fetches posts WITH DataLoader — shows batching in console logs"""
    postsWithDataLoader: [Post!]!

    """Feed: posts + their comments + each comment's author (3 levels deep!)"""
    feed: [Post!]!

    """Users and their posts"""
    usersWithPosts: [User!]!
  }
`;

// ─── RESOLVERS ────────────────────────────────────────────────────────────────
const resolvers = {
  Query: {
    // ── WITHOUT DATALOADER: Shows N+1 ─────────────────────────────────────────
    postsWithoutDataLoader(_, __, context) {
      queryCount = 0;
      console.log('\n🔴 WITHOUT DataLoader:');
      console.log('  📦 DB Query #0: SELECT * FROM posts');
      context.useDataLoader = false; // signal to Post.author resolver
      return postsDB;
    },

    // ── WITH DATALOADER: Shows batching ───────────────────────────────────────
    postsWithDataLoader(_, __, context) {
      queryCount = 0;
      console.log('\n🟢 WITH DataLoader:');
      console.log('  📦 DB Query #0: SELECT * FROM posts');
      context.useDataLoader = true;
      return postsDB;
    },

    feed(_, __, context) {
      context.useDataLoader = true;
      return postsDB;
    },

    usersWithPosts: () => usersDB,
  },

  Post: {
    // ── THIS IS WHERE N+1 HAPPENS (or is fixed) ──────────────────────────────
    author(parent, _, context) {
      if (context.useDataLoader) {
        // DataLoader: collect this ID, batch with others, fetch all at once
        return context.loaders.user.load(parent.authorId);
      } else {
        // No DataLoader: separate DB call for EACH post's author
        return getUserById(parent.authorId);
      }
    },

    comments: (parent) => commentsDB.filter(c => c.postId === parent.id),
  },

  Comment: {
    // Uses DataLoader — comment authors are also batched
    author: (parent, _, context) => context.loaders.user.load(parent.authorId),
    post:   (parent) => postsDB.find(p => p.id === parent.postId),
  },

  User: {
    // Uses DataLoader for posts-by-author
    posts: (parent, _, context) => context.loaders.postsByAuthor.load(parent.id),
  },
};

// ─── SERVER WITH DATALOADER IN CONTEXT ───────────────────────────────────────
const server = new ApolloServer({
  typeDefs,
  resolvers,

  context() {
    // CRITICAL: Create DataLoaders INSIDE context (per-request scope).
    // If created at module level, cache persists across requests → stale data!
    return {
      useDataLoader: true, // default

      loaders: {
        // ── USER LOADER ──────────────────────────────────────────────────────
        // Batch function: receives [id1, id2, id3, ...] → returns [user1, user2, user3, ...]
        // DataLoader calls this ONCE per event loop tick with all queued IDs
        user: new DataLoader(async (ids) => {
          return getUsersByIds(ids);
          // In real apps with a DB:
          // const users = await db.query('SELECT * FROM users WHERE id = ANY($1)', [ids]);
          // return ids.map(id => users.find(u => u.id === id) ?? null);
        }),

        // ── POSTS BY AUTHOR LOADER ───────────────────────────────────────────
        // One-to-many: each author ID maps to an array of posts
        postsByAuthor: new DataLoader(async (authorIds) => {
          return getPostsByAuthorIds(authorIds);
          // In real apps:
          // const posts = await db.query('SELECT * FROM posts WHERE author_id = ANY($1)', [authorIds]);
          // return authorIds.map(id => posts.filter(p => p.authorId === id));
        }),
      },
    };
  },
});

await server.listen({ port: 4000 });
console.log('📱 Social Network API → http://localhost:4000\n');
console.log(`
Watch the CONSOLE LOGS when running these queries:

# ── 1. WITHOUT DataLoader: N+1 problem visible in logs
#    Expected: 1 post query + 8 separate author queries = 9 total
query WithoutDataLoader {
  postsWithoutDataLoader {
    title
    likes
    author { name username }   # ← triggers N individual DB queries
  }
}

# ── 2. WITH DataLoader: batched — logs show 1 batched query
#    Expected: 1 post query + 1 batched author query = 2 total
query WithDataLoader {
  postsWithDataLoader {
    title
    likes
    author { name username }   # ← batched into 1 query!
  }
}

# ── 3. Deep nesting: posts → comments → comment authors (3 levels!)
#    DataLoader handles this automatically — all author IDs batched
query Feed {
  feed {
    title
    author { name }
    comments {
      text
      author { name }           # ← also batched with post authors!
    }
  }
}

# ── 4. Users with their posts (reverse direction)
query UsersWithPosts {
  usersWithPosts {
    name
    posts { title likes }
  }
}
`);
