/**
 * ============================================================
 * MINI PROJECT 4: Filtering, Sorting & Pagination
 * System: E-commerce Product Catalog
 * ============================================================
 *
 * CONCEPTS COVERED:
 * ─────────────────
 * 1. COMPLEX FILTERING  → Input type with multiple optional criteria
 * 2. SORTING            → Enum for sort field + sort order direction
 * 3. OFFSET PAGINATION  → skip/limit pattern (simple, SQL-friendly)
 *    Returns: { items, total, hasNextPage, currentPage, totalPages }
 * 4. CURSOR PAGINATION  → Relay Connection pattern (industry standard)
 *    Returns: { edges: [{node, cursor}], pageInfo: {hasNextPage, endCursor} }
 *    Used by: GitHub, Facebook, Shopify, Stripe
 *
 * INTERVIEW Q&A:
 * ──────────────
 * Q: What is the difference between offset and cursor-based pagination?
 * A: Offset (skip/limit): simple, maps to SQL OFFSET/LIMIT. Problem: if items
 *    are inserted/deleted mid-page, you get duplicates or skipped items.
 *    Cursor: stable pointer to a specific item. No drift on inserts/deletes.
 *    Cursor is preferred for real-time feeds (social media, notifications).
 *
 * Q: What is the Relay Connection Pattern?
 * A: A GraphQL pagination spec where results come as:
 *    - edges: array of { node (the item), cursor (opaque position pointer) }
 *    - pageInfo: { hasNextPage, hasPreviousPage, startCursor, endCursor }
 *    The cursor is typically base64(id) or base64(sortField:value).
 *    Many tools (Relay, Apollo) have built-in support for this pattern.
 *
 * Q: How do you implement filtering in GraphQL?
 * A: Define a FilterInput type with optional fields. In the resolver, build
 *    the filter logic dynamically based on which fields are provided.
 *    Never use individual scalar args for complex filtering — use input types.
 *
 * RUN: npm install && npm run dev
 * OPEN: http://localhost:4000
 */

import { ApolloServer } from 'apollo-server';

// ─── MOCK DATABASE ────────────────────────────────────────────────────────────
const products = [
  { id: '1',  name: 'MacBook Pro 14"',      price: 1999, category: 'ELECTRONICS', inStock: true,  rating: 4.8, createdAt: '2023-01-10' },
  { id: '2',  name: 'iPhone 15 Pro',        price: 1099, category: 'ELECTRONICS', inStock: true,  rating: 4.7, createdAt: '2023-09-22' },
  { id: '3',  name: 'Sony Headphones WH',   price: 349,  category: 'ELECTRONICS', inStock: false, rating: 4.5, createdAt: '2023-03-15' },
  { id: '4',  name: 'Nike Air Max 90',      price: 120,  category: 'CLOTHING',    inStock: true,  rating: 4.3, createdAt: '2023-05-20' },
  { id: '5',  name: 'Levi\'s 501 Jeans',   price: 89,   category: 'CLOTHING',    inStock: true,  rating: 4.1, createdAt: '2023-02-08' },
  { id: '6',  name: 'JavaScript: The Good Parts', price: 29, category: 'BOOKS', inStock: true, rating: 4.6, createdAt: '2023-04-12' },
  { id: '7',  name: 'Clean Code Book',      price: 39,   category: 'BOOKS',       inStock: true,  rating: 4.9, createdAt: '2023-06-30' },
  { id: '8',  name: 'Standing Desk',        price: 599,  category: 'FURNITURE',   inStock: true,  rating: 4.4, createdAt: '2023-07-11' },
  { id: '9',  name: 'Ergonomic Chair',      price: 449,  category: 'FURNITURE',   inStock: false, rating: 4.6, createdAt: '2023-08-05' },
  { id: '10', name: 'Samsung 4K Monitor',   price: 799,  category: 'ELECTRONICS', inStock: true,  rating: 4.5, createdAt: '2023-11-18' },
  { id: '11', name: 'Python Cookbook',      price: 49,   category: 'BOOKS',       inStock: true,  rating: 4.2, createdAt: '2023-10-25' },
  { id: '12', name: 'Mechanical Keyboard',  price: 159,  category: 'ELECTRONICS', inStock: true,  rating: 4.7, createdAt: '2023-12-01' },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
// Cursor encoding: base64(id) — opaque to client, meaningful to server
const encodeCursor = (id) => Buffer.from(String(id)).toString('base64');
const decodeCursor = (cursor) => Buffer.from(cursor, 'base64').toString('ascii');

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const typeDefs = `
  enum ProductCategory {
    ELECTRONICS
    CLOTHING
    BOOKS
    FURNITURE
    SPORTS
  }

  enum ProductSortField {
    PRICE
    RATING
    NAME
    CREATED_AT
  }

  enum SortOrder {
    ASC
    DESC
  }

  # ── FILTER INPUT ────────────────────────────────────────────────────────────
  # All fields optional — only filter on what's provided
  input ProductFilterInput {
    minPrice:  Float
    maxPrice:  Float
    category:  ProductCategory
    inStock:   Boolean
    minRating: Float
    search:    String          # partial name match
  }

  # ── SORT INPUT ──────────────────────────────────────────────────────────────
  input ProductSortInput {
    field: ProductSortField!
    order: SortOrder!
  }

  type Product {
    id:        ID!
    name:      String!
    price:     Float!
    category:  ProductCategory!
    inStock:   Boolean!
    rating:    Float!
    createdAt: String!
  }

  # ── OFFSET PAGINATION RESPONSE ──────────────────────────────────────────────
  # Simple: tell client what page they're on, how many total, is there a next?
  type ProductsPage {
    items:      [Product!]!
    total:      Int!           # total matching products (for "showing X of Y")
    hasNextPage: Boolean!
    hasPrevPage: Boolean!
    currentPage: Int!
    totalPages:  Int!
  }

  # ── CURSOR PAGINATION (RELAY CONNECTION PATTERN) ────────────────────────────
  # Industry standard for infinite scroll / feed-style UIs
  # edges: the items + their cursor position
  # pageInfo: navigation metadata
  type ProductEdge {
    node:   Product!
    cursor: String!   # opaque base64 position — pass as 'after' for next page
  }

  type PageInfo {
    hasNextPage:     Boolean!
    hasPreviousPage: Boolean!
    startCursor:     String   # cursor of first item in this page
    endCursor:       String   # cursor of last item → use as 'after' for next page
  }

  type ProductConnection {
    edges:    [ProductEdge!]!
    pageInfo: PageInfo!
    total:    Int!
  }

  type Query {
    product(id: ID!): Product

    # ── OFFSET PAGINATION ───────────────────────────────────────────────────
    # Use for: admin tables, numbered pages, reports
    products(
      filter: ProductFilterInput
      sort:   ProductSortInput
      page:   Int   = 1
      limit:  Int   = 5
    ): ProductsPage!

    # ── CURSOR PAGINATION ────────────────────────────────────────────────────
    # Use for: infinite scroll, social feeds, real-time lists
    # first: how many to return
    # after: cursor of last seen item (omit for first page)
    productsConnection(
      filter: ProductFilterInput
      sort:   ProductSortInput
      first:  Int    = 5
      after:  String
    ): ProductConnection!
  }
`;

// ─── RESOLVERS ────────────────────────────────────────────────────────────────
const resolvers = {
  Query: {
    product: (_, { id }) => products.find(p => p.id === id) ?? null,

    // ── OFFSET PAGINATION ────────────────────────────────────────────────────
    products(_, { filter = {}, sort, page = 1, limit = 5 }) {
      let result = applyFilter(products, filter);
      result = applySort(result, sort);

      const total      = result.length;
      const totalPages = Math.ceil(total / limit);
      const skip       = (page - 1) * limit;
      const items      = result.slice(skip, skip + limit);

      return {
        items,
        total,
        currentPage:  page,
        totalPages,
        hasNextPage:  page < totalPages,
        hasPrevPage:  page > 1,
      };
    },

    // ── CURSOR PAGINATION (Relay Connection) ─────────────────────────────────
    productsConnection(_, { filter = {}, sort, first = 5, after }) {
      let result = applyFilter(products, filter);
      result = applySort(result, sort);

      // If 'after' cursor given: find that item and start AFTER it
      let startIndex = 0;
      if (after) {
        const afterId = decodeCursor(after);
        const afterIdx = result.findIndex(p => p.id === afterId);
        if (afterIdx !== -1) startIndex = afterIdx + 1;
      }

      const pageItems = result.slice(startIndex, startIndex + first);
      const hasNextPage = startIndex + first < result.length;

      const edges = pageItems.map(node => ({
        node,
        cursor: encodeCursor(node.id),
      }));

      return {
        edges,
        total: result.length,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: startIndex > 0,
          startCursor: edges[0]?.cursor ?? null,
          endCursor:   edges[edges.length - 1]?.cursor ?? null,
        },
      };
    },
  },
};

// ─── FILTER HELPER ────────────────────────────────────────────────────────────
function applyFilter(items, filter) {
  return items.filter(p => {
    if (filter.minPrice  != null && p.price  < filter.minPrice)  return false;
    if (filter.maxPrice  != null && p.price  > filter.maxPrice)  return false;
    if (filter.category  != null && p.category !== filter.category) return false;
    if (filter.inStock   != null && p.inStock !== filter.inStock) return false;
    if (filter.minRating != null && p.rating < filter.minRating) return false;
    if (filter.search    != null && !p.name.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });
}

// ─── SORT HELPER ─────────────────────────────────────────────────────────────
function applySort(items, sort) {
  if (!sort) return items;
  const fieldMap = { PRICE: 'price', RATING: 'rating', NAME: 'name', CREATED_AT: 'createdAt' };
  const key = fieldMap[sort.field];
  const dir = sort.order === 'ASC' ? 1 : -1;
  return [...items].sort((a, b) => {
    if (a[key] < b[key]) return -1 * dir;
    if (a[key] > b[key]) return  1 * dir;
    return 0;
  });
}

// ─── SERVER ───────────────────────────────────────────────────────────────────
const server = new ApolloServer({ typeDefs, resolvers });
await server.listen({ port: 4000 });
console.log('🛒 Product Catalog API → http://localhost:4000\n');
console.log(`Try these queries:

# ── 1. Filter + Sort + Offset Pagination
query OffsetPagination {
  products(
    filter: { category: ELECTRONICS, inStock: true, maxPrice: 1500 }
    sort:   { field: PRICE, order: ASC }
    page: 1
    limit: 3
  ) {
    items { id name price rating inStock }
    total hasNextPage hasPrevPage currentPage totalPages
  }
}

# ── 2. Cursor Pagination — First Page
query CursorPage1 {
  productsConnection(
    filter: { minRating: 4.4 }
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

# ── 3. Cursor Pagination — Next Page (paste endCursor from above)
query CursorPage2 {
  productsConnection(
    filter: { minRating: 4.4 }
    sort: { field: RATING, order: DESC }
    first: 3
    after: "PASTE_END_CURSOR_HERE"
  ) {
    edges { cursor node { id name price rating } }
    pageInfo { hasNextPage hasPreviousPage endCursor }
  }
}

# ── 4. Search + Filter
query SearchBooks {
  products(
    filter: { category: BOOKS, search: "clean" }
    sort: { field: RATING, order: DESC }
  ) {
    items { name price rating }
    total
  }
}
`);
