# Project 04 — Filtering, Sorting & Pagination

**System: E-commerce Product Catalog**
**Difficulty: Intermediate**

---

## What This Project Teaches

Every real-world API needs filtering, sorting, and pagination. Without them your API returns all data at once — useless at scale. This project implements both major pagination patterns (offset and cursor) side-by-side so you can see exactly how and when to use each.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| Node.js | Runtime |
| Apollo Server 3 | GraphQL server |
| graphql | Core library |

---

## Concepts Covered

- `FilterInput` — flexible multi-criteria filtering
- `SortInput` — sort by any field, any direction
- **Offset pagination** — skip/limit with `ProductsPage`
- **Cursor pagination** — Relay Connection pattern with `ProductConnection`
- `encodeCursor` / `decodeCursor` using Base64
- Combining filter + sort + pagination in one query

---

## Setup & Run

```bash
cd projects/04-filtering-pagination
npm install
npm run dev
```

Open **http://localhost:4000**

---

## Project Structure

```
04-filtering-pagination/
├── index.js        ← Schema + resolvers + server
├── package.json
└── README.md
```

---

## Core Concepts Explained

### Offset Pagination

The simplest pattern — `skip N items, take M items`:

```graphql
type ProductsPage {
  items:       [Product!]!
  total:       Int!
  hasNextPage: Boolean!
  hasPrevPage: Boolean!
  currentPage: Int!
  totalPages:  Int!
}

type Query {
  products(page: Int = 1, limit: Int = 10): ProductsPage!
}
```

```js
// Resolver implementation
products(_, { page = 1, limit = 10 }) {
  const total      = filteredProducts.length;
  const totalPages = Math.ceil(total / limit);
  const skip       = (page - 1) * limit;

  return {
    items:       filteredProducts.slice(skip, skip + limit),
    total,
    currentPage:  page,
    totalPages,
    hasNextPage:  page < totalPages,
    hasPrevPage:  page > 1,
  };
}
```

**When to use**: Admin tables, numbered pages, reports, search results.

**Problem**: If items are inserted or deleted, pages shift. Item on page 2 might appear on page 1 after a deletion — duplicates or skipped items in paginated views.

### Cursor Pagination (Relay Connection)

Industry standard for live feeds and infinite scroll:

```graphql
type ProductEdge {
  node:   Product!
  cursor: String!   # opaque base64 position marker
}

type PageInfo {
  hasNextPage: Boolean!
  endCursor:   String   # pass this as 'after' to get the next page
}

type ProductConnection {
  edges:    [ProductEdge!]!
  pageInfo: PageInfo!
  total:    Int!
}

type Query {
  productsConnection(first: Int = 10, after: String): ProductConnection!
}
```

```js
// Cursor helpers
const encodeCursor = (id) => Buffer.from(String(id)).toString('base64');
const decodeCursor = (cursor) => Buffer.from(cursor, 'base64').toString('ascii');

// Resolver
productsConnection(_, { first = 10, after }) {
  let startIndex = 0;
  if (after) {
    const afterId  = decodeCursor(after);
    const afterIdx = products.findIndex(p => p.id === afterId);
    if (afterIdx !== -1) startIndex = afterIdx + 1;
  }

  const pageItems = products.slice(startIndex, startIndex + first);
  const edges     = pageItems.map(node => ({ node, cursor: encodeCursor(node.id) }));

  return {
    edges,
    total: products.length,
    pageInfo: {
      hasNextPage: startIndex + first < products.length,
      endCursor:   edges[edges.length - 1]?.cursor ?? null,
    },
  };
}
```

**When to use**: Social media feeds, notifications, chat messages, any real-time list.

**Advantage**: Stable — inserting/deleting items doesn't break pagination position.

### How to Paginate — The Client Flow

```
Page 1:  productsConnection(first: 5)
         Response: edges[5 items], pageInfo.endCursor = "Mw=="

Page 2:  productsConnection(first: 5, after: "Mw==")
         Response: edges[next 5 items], pageInfo.endCursor = "Ng=="

Page 3:  productsConnection(first: 5, after: "Ng==")
         ...and so on until hasNextPage = false
```

---

## Queries to Try

```graphql
# 1. Filter + Sort + Offset Pagination
query {
  products(
    filter: { category: ELECTRONICS, inStock: true, maxPrice: 1500 }
    sort:   { field: PRICE, order: ASC }
    page: 1
    limit: 3
  ) {
    items { id name price rating }
    total hasNextPage currentPage totalPages
  }
}

# 2. Cursor Pagination — first page
query {
  productsConnection(
    filter: { minRating: 4.5 }
    sort: { field: RATING, order: DESC }
    first: 3
  ) {
    edges {
      cursor
      node { id name price rating }
    }
    pageInfo { hasNextPage endCursor }
    total
  }
}

# 3. Cursor Pagination — next page (use endCursor from above)
query {
  productsConnection(
    filter: { minRating: 4.5 }
    sort: { field: RATING, order: DESC }
    first: 3
    after: "PASTE_CURSOR_HERE"
  ) {
    edges { node { name price } }
    pageInfo { hasNextPage endCursor }
  }
}
```

---

## Interview Questions & Answers — Coding Round

---

### Q1. What is the difference between offset and cursor-based pagination?

**Answer**:

```
OFFSET PAGINATION (skip/limit):
  - Simple: SELECT * FROM products LIMIT 10 OFFSET 20
  - Problem: pages are unstable. If item #15 is deleted after you loaded page 1,
    what was item #21 is now item #20 — it gets skipped when you load page 2.
  - Use for: admin dashboards, numbered pages, static datasets, reports

CURSOR PAGINATION:
  - Cursor = opaque pointer to a specific item's position
  - "Give me 10 items AFTER this specific item" instead of "skip 20 items"
  - Stable: insertions/deletions don't affect your cursor position
  - Use for: social feeds, infinite scroll, real-time lists, any live data

Real-world rule:
  Twitter/Facebook/Instagram use cursor pagination.
  Google Search results use offset (pages 1, 2, 3...).
  GitHub's GraphQL API uses Relay Connection (cursor) everywhere.
```

---

### Q2. Implement an offset pagination resolver for a users list

**Question**: Implement `users(page: Int!, limit: Int!): UsersPage!`

**Answer**:

```js
// Schema
const typeDefs = `
  type UsersPage {
    items:       [User!]!
    total:       Int!
    hasNextPage: Boolean!
    currentPage: Int!
    totalPages:  Int!
  }

  type Query {
    users(page: Int = 1, limit: Int = 10): UsersPage!
  }
`;

// Resolver
const resolvers = {
  Query: {
    users(_, { page = 1, limit = 10 }) {
      if (page < 1)   throw new UserInputError('page must be >= 1');
      if (limit < 1)  throw new UserInputError('limit must be >= 1');
      if (limit > 100) throw new UserInputError('limit cannot exceed 100');

      const total      = usersDB.length;
      const totalPages = Math.ceil(total / limit);
      const skip       = (page - 1) * limit;
      const items      = usersDB.slice(skip, skip + limit);

      return {
        items,
        total,
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
      };
    },
  },
};
```

---

### Q3. What is the Relay Connection pattern? Explain each part.

**Answer**:

```graphql
# The full Relay Connection pattern:

type UserEdge {
  node:   User!    # The actual item
  cursor: String!  # Opaque position marker for THIS item
}

type PageInfo {
  hasNextPage:     Boolean!  # Is there a next page?
  hasPreviousPage: Boolean!  # Is there a previous page?
  startCursor:     String    # Cursor of the first item in this page
  endCursor:       String    # Cursor of the last item → pass as 'after' for next page
}

type UserConnection {
  edges:    [UserEdge!]!  # The items with their cursors
  pageInfo: PageInfo!      # Navigation metadata
  total:    Int!           # Total matching items (optional but useful)
}

type Query {
  users(first: Int, after: String, last: Int, before: String): UserConnection!
  #     ^ next page   ^ cursor    ^ prev page ^ cursor
}
```

```
Why this pattern:
  - 'edges' exists because you might need to attach metadata to the relationship
    (not just the item) — e.g., when a user was added to a list
  - 'node' is the actual item
  - 'cursor' is an opaque (base64-encoded) position pointer
  - 'pageInfo' is standardized navigation — tools like Relay and Apollo Client
    understand this shape automatically and handle pagination for you

Used by: GitHub, Shopify, Stripe, Prisma, Facebook
```

---

### Q4. Implement a FilterInput resolver for products

**Question**: Given this filter input, implement the resolver logic:

```graphql
input ProductFilterInput {
  minPrice:  Float
  maxPrice:  Float
  category:  String
  inStock:   Boolean
  search:    String
}
```

**Answer**:

```js
function applyFilter(products, filter = {}) {
  return products.filter(product => {
    // Each filter condition: if the filter field is provided, check it
    // If not provided (null/undefined), skip the check (include all)

    if (filter.minPrice  != null && product.price < filter.minPrice)   return false;
    if (filter.maxPrice  != null && product.price > filter.maxPrice)   return false;
    if (filter.category  != null && product.category !== filter.category) return false;
    if (filter.inStock   != null && product.inStock  !== filter.inStock)  return false;

    if (filter.search != null) {
      const q = filter.search.toLowerCase();
      const nameMatch = product.name.toLowerCase().includes(q);
      if (!nameMatch) return false;
    }

    return true; // passes all checks
  });
}

const resolvers = {
  Query: {
    products(_, { filter = {}, page = 1, limit = 10 }) {
      const filtered = applyFilter(products, filter);
      // ... then apply pagination
    },
  },
};
```

---

### Q5. How do you encode and decode a cursor? Why base64?

**Answer**:

```js
// Encode: item ID → base64 string (opaque to client)
const encodeCursor = (id) => Buffer.from(String(id)).toString('base64');

// Decode: base64 string → item ID
const decodeCursor = (cursor) => Buffer.from(cursor, 'base64').toString('ascii');

// Examples:
encodeCursor('42')    // "NDI="
decodeCursor('NDI=')  // "42"

// For sort-based cursors (more robust):
const encodeCursor = (id, createdAt) =>
  Buffer.from(JSON.stringify({ id, createdAt })).toString('base64');

const decodeCursor = (cursor) =>
  JSON.parse(Buffer.from(cursor, 'base64').toString('ascii'));

// Why base64:
// 1. Opaque: clients treat it as a black box (don't parse or construct it)
// 2. URL-safe: can be used in query strings without encoding
// 3. Convention: all Relay Connection cursors are base64-encoded
// 4. Not security: base64 is NOT encryption — it's just encoding
//    (Don't put sensitive info in cursors without proper encryption)
```

---

### Q6. How do you implement sorting in a GraphQL resolver?

**Answer**:

```graphql
# Schema:
enum SortField { PRICE RATING NAME CREATED_AT }
enum SortOrder { ASC DESC }

input SortInput {
  field: SortField!
  order: SortOrder!
}

type Query {
  products(sort: SortInput): [Product!]!
}
```

```js
// Resolver:
function applySort(items, sort) {
  if (!sort) return items; // no sort — return as-is

  const fieldMap = {
    PRICE:      'price',
    RATING:     'rating',
    NAME:       'name',
    CREATED_AT: 'createdAt',
  };
  const key = fieldMap[sort.field];
  const dir = sort.order === 'ASC' ? 1 : -1;

  // spread to avoid mutating original array
  return [...items].sort((a, b) => {
    if (a[key] < b[key]) return -1 * dir;
    if (a[key] > b[key]) return  1 * dir;
    return 0;
  });
}
```

---

## Key Takeaways

1. Offset pagination: simple, SQL-friendly, but unstable on live data.
2. Cursor pagination: stable, used by GitHub/Shopify/Stripe, best for feeds.
3. Relay Connection: `edges[{node, cursor}]` + `pageInfo{hasNextPage, endCursor}`.
4. To get the next page: pass `pageInfo.endCursor` as the `after` argument.
5. Always add a `total` count — clients need it to show "showing X of Y results".
6. Apply filter → sort → paginate in that order.
7. Set a max `limit` (e.g., 100) — never let clients request unlimited results.
