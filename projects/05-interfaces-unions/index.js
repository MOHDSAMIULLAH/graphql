/**
 * ============================================================
 * MINI PROJECT 5: Interfaces & Union Types
 * System: Multi-type Media Library + Search
 * ============================================================
 *
 * CONCEPTS COVERED:
 * ─────────────────
 * 1. INTERFACE
 *    - Defines a contract: "every type implementing this must have these fields"
 *    - Think of it like an abstract class or TypeScript interface
 *    - Used when multiple types SHARE common fields
 *    - Query the interface field → returns any implementing type
 *
 * 2. UNION TYPE
 *    - Groups multiple types that DON'T necessarily share fields
 *    - Think: "result could be TypeA OR TypeB OR TypeC"
 *    - Use for search results, API responses, polymorphic returns
 *
 * 3. __resolveType
 *    - Resolver function that tells GraphQL WHICH concrete type an object is
 *    - Required for both interfaces and unions
 *    - Returns a type name string: 'Book', 'Movie', 'Podcast'
 *
 * 4. INLINE FRAGMENTS (... on TypeName)
 *    - Client uses these to query type-specific fields
 *    - Without inline fragment: can only query shared/interface fields
 *    - With inline fragment: can query Book-specific, Movie-specific fields
 *
 * 5. __typename
 *    - Built-in field available on every GraphQL type
 *    - Returns the type name as a string
 *    - Client uses this for type discrimination (routing, conditional rendering)
 *
 * INTERFACE vs UNION — When to use which?
 * ──────────────────────────────────────────
 * Interface: types share common fields  →  Book, Movie, Podcast all have title, createdAt
 * Union:     types have nothing in common → TransferResult = Transfer | Error | Limit
 *
 * INTERVIEW Q&A:
 * ──────────────
 * Q: What is the difference between interface and union in GraphQL?
 * A: Interface requires implementing types to share defined fields.
 *    Union just groups types with no shared field requirement.
 *    Use interface when types share structure; union when they don't.
 *
 * Q: What is __resolveType and why is it needed?
 * A: GraphQL needs to know the concrete type of a returned object at runtime
 *    (for interfaces and unions). __resolveType is a resolver that inspects
 *    the returned object and returns the type name string. Without it,
 *    GraphQL can't determine which fields to include in the response.
 *
 * Q: What are inline fragments?
 * A: Syntax: ... on TypeName { fields }. They let clients request fields
 *    that only exist on specific types within an interface or union.
 *
 * RUN: npm install && npm run dev
 * OPEN: http://localhost:4000
 */

import { ApolloServer } from 'apollo-server';

// ─── MOCK DATABASE ────────────────────────────────────────────────────────────
const books = [
  { id: '1', __type: 'Book',    title: 'Clean Code',           author: 'Robert Martin', pages: 431,  isbn: '978-0132350884',  genre: 'TECHNOLOGY', createdAt: '2023-01-10' },
  { id: '2', __type: 'Book',    title: 'Atomic Habits',        author: 'James Clear',   pages: 319,  isbn: '978-0735211292',  genre: 'SELF_HELP',  createdAt: '2023-03-15' },
];

const movies = [
  { id: '3', __type: 'Movie',   title: 'Inception',            director: 'Christopher Nolan', duration: 148, genre: 'SCI_FI',  rating: 8.8, createdAt: '2023-02-20' },
  { id: '4', __type: 'Movie',   title: 'The Dark Knight',      director: 'Christopher Nolan', duration: 152, genre: 'ACTION',  rating: 9.0, createdAt: '2023-04-12' },
  { id: '5', __type: 'Movie',   title: 'Interstellar',         director: 'Christopher Nolan', duration: 169, genre: 'SCI_FI',  rating: 8.6, createdAt: '2023-06-01' },
];

const podcasts = [
  { id: '6', __type: 'Podcast', title: 'Lex Fridman Podcast',  host: 'Lex Fridman',     episodes: 400, category: 'TECH',     createdAt: '2023-05-08' },
  { id: '7', __type: 'Podcast', title: 'The Joe Rogan Experience', host: 'Joe Rogan',   episodes: 2000, category: 'GENERAL', createdAt: '2023-07-22' },
];

const songs = [
  { id: '8', __type: 'Song',    title: 'Bohemian Rhapsody',    artist: 'Queen',    duration: 354, album: 'A Night at the Opera', createdAt: '2023-08-15' },
  { id: '9', __type: 'Song',    title: 'Stairway to Heaven',   artist: 'Led Zeppelin', duration: 482, album: 'Led Zeppelin IV', createdAt: '2023-09-10' },
];

const allMedia   = [...books, ...movies, ...podcasts, ...songs];
const allContent = [...books, ...movies, ...podcasts, ...songs]; // for search

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const typeDefs = `
  # ── INTERFACE ──────────────────────────────────────────────────────────────
  # Contract: every type implementing Media MUST have these fields.
  # Book, Movie, Podcast, Song all have id, title, createdAt → use interface.
  interface Media {
    id:        ID!
    title:     String!
    createdAt: String!
  }

  # ── TYPES IMPLEMENTING INTERFACE ──────────────────────────────────────────
  # 'implements Media' means Book must have all Media fields + its own fields.
  type Book implements Media {
    id:        ID!           # required by interface
    title:     String!       # required by interface
    createdAt: String!       # required by interface
    # Book-specific fields:
    author:  String!
    pages:   Int!
    isbn:    String!
    genre:   String!
  }

  type Movie implements Media {
    id:        ID!
    title:     String!
    createdAt: String!
    # Movie-specific fields:
    director: String!
    duration: Int!        # minutes
    genre:    String!
    rating:   Float!
  }

  type Podcast implements Media {
    id:        ID!
    title:     String!
    createdAt: String!
    # Podcast-specific fields:
    host:      String!
    episodes:  Int!
    category:  String!
  }

  type Song implements Media {
    id:        ID!
    title:     String!
    createdAt: String!
    # Song-specific fields:
    artist:   String!
    duration: Int!        # seconds
    album:    String!
  }

  # ── UNION TYPE ──────────────────────────────────────────────────────────────
  # SearchResult can be ANY of these types.
  # They don't need shared fields (unlike interface).
  # Use for: search results, API responses, "this can be X or Y or Z"
  union SearchResult = Book | Movie | Podcast | Song

  # Union for notification-style polymorphism (a realistic use case)
  union Notification = LikeNotification | CommentNotification | FollowNotification

  type LikeNotification {
    id:      ID!
    liker:   String!
    post:    String!
    likedAt: String!
  }

  type CommentNotification {
    id:        ID!
    commenter: String!
    comment:   String!
    post:      String!
  }

  type FollowNotification {
    id:        ID!
    follower:  String!
    followedAt: String!
  }

  type Query {
    # Returns interface type — can be Book, Movie, Podcast, or Song
    allMedia: [Media!]!

    # Returns union type — search across all content types
    search(query: String!): [SearchResult!]!

    # Type-specific queries
    books:    [Book!]!
    movies:   [Movie!]!
    podcasts: [Podcast!]!
    songs:    [Song!]!

    # Notifications demo
    notifications: [Notification!]!
  }
`;

// ─── RESOLVERS ────────────────────────────────────────────────────────────────
const resolvers = {
  Query: {
    allMedia:  () => allMedia,
    books:     () => books,
    movies:    () => movies,
    podcasts:  () => podcasts,
    songs:     () => songs,

    search(_, { query }) {
      const q = query.toLowerCase();
      return allContent.filter(item =>
        item.title.toLowerCase().includes(q) ||
        // Check various text fields depending on type
        (item.author    && item.author.toLowerCase().includes(q))    ||
        (item.director  && item.director.toLowerCase().includes(q))  ||
        (item.host      && item.host.toLowerCase().includes(q))      ||
        (item.artist    && item.artist.toLowerCase().includes(q))
      );
    },

    notifications: () => [
      { id: 'n1', __type: 'LikeNotification', liker: 'alice', post: 'My GraphQL Journey', likedAt: '2024-01-15T10:00:00Z' },
      { id: 'n2', __type: 'CommentNotification', commenter: 'bob', comment: 'Great post!', post: 'My GraphQL Journey' },
      { id: 'n3', __type: 'FollowNotification', follower: 'charlie', followedAt: '2024-01-16T09:00:00Z' },
    ],
  },

  // ── __resolveType for INTERFACE ─────────────────────────────────────────────
  // GraphQL calls this to determine which concrete type each Media item is.
  // You inspect the object and return the type name string.
  Media: {
    __resolveType(obj) {
      // Strategy 1: use a __type discriminator field (explicit)
      return obj.__type;
      // Strategy 2: duck typing (check for type-specific fields)
      // if (obj.isbn)     return 'Book';
      // if (obj.director) return 'Movie';
      // if (obj.host)     return 'Podcast';
      // if (obj.artist)   return 'Song';
    },
  },

  // ── __resolveType for UNION ─────────────────────────────────────────────────
  // Same idea — inspect and return the type name.
  SearchResult: {
    __resolveType(obj) {
      return obj.__type;
    },
  },

  Notification: {
    __resolveType(obj) {
      return obj.__type;
    },
  },
};

// ─── SERVER ───────────────────────────────────────────────────────────────────
const server = new ApolloServer({ typeDefs, resolvers });
await server.listen({ port: 4000 });
console.log('🎬 Media Library API → http://localhost:4000\n');
console.log(`Try these queries — notice how inline fragments work:

# ── 1. Interface query: shared fields only (no inline fragments needed)
query AllMediaBasic {
  allMedia {
    id title createdAt   # These work on ANY Media type
    __typename           # Built-in field: returns the type name
  }
}

# ── 2. Interface query with inline fragments for type-specific fields
query AllMediaDetailed {
  allMedia {
    id title createdAt __typename

    # ... on TypeName { } fetches fields only when the item is that type
    ... on Book {
      author pages isbn
    }
    ... on Movie {
      director duration rating
    }
    ... on Podcast {
      host episodes category
    }
    ... on Song {
      artist album duration
    }
  }
}

# ── 3. Union search — must use inline fragments (no shared fields)
query Search {
  search(query: "nolan") {
    __typename
    ... on Book    { title author pages }
    ... on Movie   { title director rating duration }
    ... on Podcast { title host episodes }
    ... on Song    { title artist album }
  }
}

# ── 4. Notifications — realistic union use case
query GetNotifications {
  notifications {
    __typename
    ... on LikeNotification    { liker post likedAt }
    ... on CommentNotification { commenter comment post }
    ... on FollowNotification  { follower followedAt }
  }
}

# ── 5. Try querying type-specific fields WITHOUT inline fragment — will ERROR
# query WillFail {
#   search(query: "clean") {
#     title    # ERROR: 'title' doesn't exist on SearchResult (it's a union, no shared fields)
#   }
# }
`);
