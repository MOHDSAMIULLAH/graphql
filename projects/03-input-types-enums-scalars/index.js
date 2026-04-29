/**
 * ============================================================
 * MINI PROJECT 3: Input Types, Enums & Custom Scalars
 * System: Library Management
 * ============================================================
 *
 * CONCEPTS COVERED:
 * ─────────────────
 * 1. INPUT TYPES
 *    - "type" = output type (returned to client in queries)
 *    - "input" = input type (received from client in mutations)
 *    - Input fields: ONLY scalars, enums, other inputs (no output types!)
 *    - Industry rule: ALWAYS use input types for mutations, never raw args
 *
 * 2. ENUM TYPES
 *    - Fixed set of named constants
 *    - GraphQL validates automatically — invalid value = descriptive error
 *    - In JS resolvers, enum values are plain strings: 'FICTION', 'AVAILABLE'
 *    - Use for: status, category, role, permission, direction fields
 *
 * 3. CUSTOM SCALARS
 *    - Extend built-in scalars with custom validation + serialization
 *    - 3 hooks: serialize (JS→client), parseValue (variable→JS), parseLiteral (inline→JS)
 *    - Production shortcut: `graphql-scalars` package has 50+ ready scalars
 *
 * INTERVIEW Q&A:
 * ──────────────
 * Q: What is the difference between 'type' and 'input'?
 * A: 'type' is an output type — used in queries, can have resolvers, can reference
 *    other output types bidirectionally. 'input' is for mutation arguments — no
 *    resolvers, only scalars/enums/other inputs, cannot reference output types.
 *
 * Q: Why use an input type instead of individual scalar arguments?
 * A: (1) Reusable across multiple mutations, (2) extendable without breaking clients,
 *    (3) cleaner API surface, (4) easier to validate as a unit, (5) works better
 *    with tools like form generators and type-safe clients.
 *
 * Q: How do custom scalars work?
 * A: GraphQLScalarType takes 3 hooks:
 *    serialize    → called when SENDING to client (JS value → JSON)
 *    parseValue   → called for client JSON variables ({ "date": "2024-01-15" })
 *    parseLiteral → called for inline literal values (date: "2024-01-15" in query)
 *
 * RUN: npm install && npm run dev
 * OPEN: http://localhost:4000
 */

import { ApolloServer } from 'apollo-server';
import { GraphQLScalarType, Kind } from 'graphql';

// ─── MOCK DATABASE ────────────────────────────────────────────────────────────
let nextId = 5;

const authors = [
  { id: '1', name: 'Robert C. Martin', email: 'unclebob@example.com' },
  { id: '2', name: 'Martin Fowler',    email: 'fowler@example.com'   },
  { id: '3', name: 'Kyle Simpson',     email: 'getify@example.com'   },
  { id: '4', name: 'Eric Evans',       email: 'evans@example.com'    },
];

let books = [
  { id: '1', title: 'Clean Code',           isbn: '978-0132350884', genre: 'TECHNOLOGY', status: 'AVAILABLE', authorId: '1', publishedAt: '2008-08-01' },
  { id: '2', title: 'Refactoring',          isbn: '978-0201485677', genre: 'TECHNOLOGY', status: 'BORROWED',  authorId: '2', publishedAt: '1999-07-08' },
  { id: '3', title: "You Don't Know JS",    isbn: '978-1491924464', genre: 'TECHNOLOGY', status: 'AVAILABLE', authorId: '3', publishedAt: '2015-12-27' },
  { id: '4', title: 'Domain-Driven Design', isbn: '978-0321125217', genre: 'TECHNOLOGY', status: 'RESERVED',  authorId: '4', publishedAt: '2003-08-30' },
];

// ─── CUSTOM SCALARS ───────────────────────────────────────────────────────────

// DateTime Scalar: validates ISO 8601 format
// Production: use `graphql-scalars` → DateTimeResolver (pre-built, well-tested)
const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'ISO 8601 date string — e.g. "2024-01-15" or "2024-01-15T10:30:00Z"',

  // STEP 1: Called when SENDING value to client (output serialization)
  // JS value from resolver → JSON string in HTTP response
  serialize(value) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    throw new Error('DateTime serialize: must be a string or Date instance');
  },

  // STEP 2: Called when receiving FROM client as a JSON variable
  // e.g.  variables: { "publishedAt": "2024-01-15" }
  parseValue(value) {
    if (typeof value !== 'string') throw new Error('DateTime must be a string');
    const d = new Date(value);
    if (isNaN(d.getTime())) throw new Error(`Invalid DateTime: "${value}"`);
    return value; // store as ISO string
  },

  // STEP 3: Called when value appears INLINE in the query (not a variable)
  // e.g.  createBook(input: { publishedAt: "2024-01-15" })  ← inline literal
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING)
      throw new Error('DateTime parseLiteral: must be a string literal');
    const d = new Date(ast.value);
    if (isNaN(d.getTime())) throw new Error(`Invalid DateTime literal: "${ast.value}"`);
    return ast.value;
  },
});

// Email Scalar: validates basic email format
const EmailScalar = new GraphQLScalarType({
  name: 'Email',
  description: 'Valid email address — e.g. "user@example.com"',
  serialize:     (v) => String(v),
  parseValue(v)  { return validateEmail(v); },
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) throw new Error('Email must be a string literal');
    return validateEmail(ast.value);
  },
});

function validateEmail(value) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    throw new Error(`Invalid email format: "${value}"`);
  return value.toLowerCase();
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const typeDefs = `
  # Declare custom scalars (must match the GraphQLScalarType name)
  scalar DateTime
  scalar Email

  # ── ENUMS ──────────────────────────────────────────────────────────────────
  # Sending an unlisted value (e.g. genre: ROMANCE) → automatic GraphQL error
  # In resolvers, these are plain JS strings: 'FICTION', 'TECHNOLOGY', etc.

  enum BookGenre {
    FICTION
    NON_FICTION
    SCIENCE
    BIOGRAPHY
    HISTORY
    TECHNOLOGY
  }

  enum BookStatus {
    AVAILABLE   # On the shelf — can be borrowed
    BORROWED    # Checked out
    RESERVED    # Reserved for upcoming borrower
    LOST        # Cannot be found
  }

  # ── INPUT TYPES ─────────────────────────────────────────────────────────────
  # RULE: input fields can ONLY be: scalars, enums, or other input types.
  # They CANNOT reference output types (Book, Author, etc.)

  """Use this when creating a new book — all fields required"""
  input CreateBookInput {
    title:       String!
    isbn:        String!
    genre:       BookGenre!   # enum in input
    authorId:    ID!
    publishedAt: DateTime!    # custom scalar in input
  }

  """Use this when updating a book — all fields optional for partial update"""
  input UpdateBookInput {
    title:  String
    genre:  BookGenre
    status: BookStatus
  }

  # ── OUTPUT TYPES ────────────────────────────────────────────────────────────
  type Book {
    id:          ID!
    title:       String!
    isbn:        String!
    genre:       BookGenre!    # enum in output
    status:      BookStatus!
    publishedAt: DateTime!     # custom scalar in output
    author:      Author!
  }

  type Author {
    id:        ID!
    name:      String!
    email:     Email!          # custom scalar
    books:     [Book!]!
    bookCount: Int!
  }

  """Standard response wrapper for mutations — widely used industry pattern"""
  type BookResponse {
    success: Boolean!
    message: String!
    book:    Book
  }

  # ── QUERIES ─────────────────────────────────────────────────────────────────
  type Query {
    books:                          [Book!]!
    book(id: ID!):                  Book
    booksByGenre(genre: BookGenre!): [Book!]!
    availableBooks:                 [Book!]!
    authors:                        [Author!]!
    author(id: ID!):                Author
  }

  # ── MUTATIONS ───────────────────────────────────────────────────────────────
  type Mutation {
    """
    Notice: single 'input' arg wraps all fields.
    This is the industry-standard pattern — NOT: createBook(title: ..., isbn: ..., genre: ...)
    """
    createBook(input: CreateBookInput!): BookResponse!
    updateBook(id: ID!, input: UpdateBookInput!): BookResponse!
    deleteBook(id: ID!): BookResponse!

    """Business-logic mutations (named for their domain action, not CRUD)"""
    borrowBook(bookId: ID!): BookResponse!
    returnBook(bookId: ID!): BookResponse!
  }
`;

// ─── RESOLVERS ────────────────────────────────────────────────────────────────
const resolvers = {
  // Register custom scalars — key must match scalar name in typeDefs
  DateTime: DateTimeScalar,
  Email:    EmailScalar,

  Query: {
    books:          ()             => books,
    book:           (_, { id })    => books.find(b => b.id === id) ?? null,
    booksByGenre:   (_, { genre }) => books.filter(b => b.genre === genre),
    availableBooks: ()             => books.filter(b => b.status === 'AVAILABLE'),
    authors:        ()             => authors,
    author:         (_, { id })    => authors.find(a => a.id === id) ?? null,
  },

  Mutation: {
    createBook(_, { input }) {
      const author = authors.find(a => a.id === input.authorId);
      if (!author)
        return { success: false, message: `Author "${input.authorId}" not found`, book: null };

      if (books.find(b => b.isbn === input.isbn))
        return { success: false, message: `ISBN "${input.isbn}" already exists`, book: null };

      const book = { id: String(nextId++), ...input, status: 'AVAILABLE' };
      books.push(book);
      return { success: true, message: 'Book created successfully', book };
    },

    updateBook(_, { id, input }) {
      const book = books.find(b => b.id === id);
      if (!book)
        return { success: false, message: `Book "${id}" not found`, book: null };

      // Partial update: only overwrite fields that were provided
      for (const [key, val] of Object.entries(input)) {
        if (val != null) book[key] = val;
      }
      return { success: true, message: 'Book updated', book };
    },

    deleteBook(_, { id }) {
      const idx = books.findIndex(b => b.id === id);
      if (idx === -1)
        return { success: false, message: `Book "${id}" not found`, book: null };

      const [deleted] = books.splice(idx, 1);
      return { success: true, message: 'Book deleted', book: deleted };
    },

    borrowBook(_, { bookId }) {
      const book = books.find(b => b.id === bookId);
      if (!book) return { success: false, message: 'Book not found', book: null };
      if (book.status !== 'AVAILABLE')
        return { success: false, message: `Cannot borrow: book is ${book.status}`, book };

      book.status = 'BORROWED';
      return { success: true, message: 'Borrowed successfully', book };
    },

    returnBook(_, { bookId }) {
      const book = books.find(b => b.id === bookId);
      if (!book) return { success: false, message: 'Book not found', book: null };
      if (book.status !== 'BORROWED')
        return { success: false, message: 'Book is not currently borrowed', book };

      book.status = 'AVAILABLE';
      return { success: true, message: 'Returned successfully', book };
    },
  },

  Author: {
    books:     (parent) => books.filter(b => b.authorId === parent.id),
    bookCount: (parent) => books.filter(b => b.authorId === parent.id).length,
  },

  Book: {
    author: (parent) => authors.find(a => a.id === parent.authorId),
  },
};

// ─── SERVER ───────────────────────────────────────────────────────────────────
const server = new ApolloServer({ typeDefs, resolvers });
await server.listen({ port: 4000 });
console.log('📚 Library API running → http://localhost:4000\n');
console.log(`Try these in Apollo Sandbox:

# ── 1. Query books by genre (enum argument)
query {
  booksByGenre(genre: TECHNOLOGY) {
    title genre status publishedAt
    author { name email }
  }
}

# ── 2. Create book with input type + DateTime scalar
mutation {
  createBook(input: {
    title: "The Pragmatic Programmer"
    isbn: "978-0201616224"
    genre: TECHNOLOGY
    authorId: "1"
    publishedAt: "1999-10-30"
  }) {
    success message
    book { id title genre status publishedAt }
  }
}

# ── 3. Borrow a book (domain-specific mutation)
mutation {
  borrowBook(bookId: "1") {
    success message
    book { title status }
  }
}

# ── 4. Partial update — only pass fields to change
mutation {
  updateBook(id: "2", input: { status: AVAILABLE }) {
    success message
    book { title status }
  }
}

# ── 5. Try an invalid enum — GraphQL will reject it automatically
query {
  booksByGenre(genre: ROMANCE) {   # ERROR: ROMANCE is not a valid BookGenre
    title
  }
}
`);
