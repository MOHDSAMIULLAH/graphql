/**
 * ============================================================
 * MINI PROJECT 10: Directives & Fragments
 * System: Analytics Dashboard
 * ============================================================
 *
 * CONCEPTS COVERED:
 * ─────────────────
 * 1. BUILT-IN DIRECTIVES  → @skip, @include, @deprecated
 * 2. NAMED FRAGMENTS      → Reusable query pieces (client-side)
 * 3. FRAGMENT VARIABLES   → Parameterizing fragments
 * 4. CUSTOM DIRECTIVES    → @uppercase, @auth (server-side)
 * 5. SCHEMA DIRECTIVES    → Annotating schema with metadata
 *
 * DIRECTIVES OVERVIEW:
 * ────────────────────
 * Directives modify execution behavior or schema metadata.
 * Syntax: @directiveName(argument: value)
 *
 * BUILT-IN (query-level):
 *   @skip(if: Boolean)    → skip this field if condition is true
 *   @include(if: Boolean) → include this field only if condition is true
 *   @deprecated(reason)  → schema-level, marks field as deprecated
 *
 * CUSTOM (server-defined):
 *   @uppercase  → transforms string field to uppercase
 *   @auth(role) → access control at field level
 *
 * FRAGMENTS OVERVIEW:
 * ───────────────────
 * Named fragments let you define reusable pieces of a query.
 * They are CLIENT-SIDE (defined in the query string, not the schema).
 * The server never "sees" fragment names — they're expanded before execution.
 *
 * INTERVIEW Q&A:
 * ──────────────
 * Q: What is a GraphQL directive?
 * A: A directive annotates schema elements or modifies query execution.
 *    Built-in: @skip, @include (conditional fields), @deprecated (schema).
 *    Custom: defined in schema with `directive @name on FIELD_DEFINITION`.
 *    Custom directives can transform field values or add access control.
 *
 * Q: What is the difference between @skip and @include?
 * A: @skip(if: true) → skip the field (exclude it from response)
 *    @include(if: true) → include the field (only if true, skip if false)
 *    They are inverses. @skip(if: X) === @include(if: !X)
 *    Use @skip when you "default to include, sometimes skip"
 *    Use @include when you "default to skip, sometimes include"
 *
 * Q: What are named fragments and why use them?
 * A: Named fragments are reusable query pieces: fragment UserFields on User { ... }
 *    Benefits: (1) Avoid repetition, (2) Consistent field selection across queries,
 *    (3) Co-locate component data requirements (Relay pattern),
 *    (4) Easier maintenance — change fields in one place.
 *
 * Q: How do you implement a custom directive?
 * A: 1. Declare in schema: directive @uppercase on FIELD_DEFINITION
 *    2. Implement with mapSchema + getDirective from @graphql-tools/utils
 *    3. Transform the schema — wrap affected field resolvers
 *
 * RUN: npm install && npm run dev
 * OPEN: http://localhost:4000
 */

import { ApolloServer } from 'apollo-server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { defaultFieldResolver } from 'graphql';

// ─── MOCK DATABASE ────────────────────────────────────────────────────────────
const users = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com', role: 'USER',  department: 'Engineering', salary: 95000, joinedAt: '2022-01-15' },
  { id: '2', name: 'Bob Smith',     email: 'bob@example.com',   role: 'USER',  department: 'Marketing',   salary: 75000, joinedAt: '2021-06-20' },
  { id: '3', name: 'Carol Admin',   email: 'carol@example.com', role: 'ADMIN', department: 'Management',  salary: 120000, joinedAt: '2020-03-10' },
];

const metrics = {
  activeUsers: 1247,
  totalRevenue: 284750.50,
  newSignups: 89,
  conversionRate: 3.2,
  avgSessionTime: 342,
  bounceRate: 42.1,
  errorRate: 0.02,
};

const posts = [
  { id: '1', title: 'Q4 Report',           views: 450, author: 'Carol Admin', tags: ['report', 'finance'], createdAt: '2024-01-01' },
  { id: '2', title: 'Marketing Campaign',  views: 230, author: 'Bob Smith',   tags: ['marketing'],         createdAt: '2024-01-05' },
  { id: '3', title: 'Tech Stack Update',   views: 780, author: 'Alice Johnson',tags: ['tech', 'update'],   createdAt: '2024-01-10' },
];

// ─── SCHEMA (with custom directive declarations) ───────────────────────────────
const typeDefs = `
  # ── CUSTOM DIRECTIVE DECLARATIONS ──────────────────────────────────────────
  # Must declare directives before using them

  """Transforms the field value to UPPERCASE"""
  directive @uppercase on FIELD_DEFINITION

  """
  Restricts field access — only users with the required role can see it.
  Others get null instead of an error (silent restriction pattern).
  """
  directive @auth(
    role: String = "USER"
  ) on FIELD_DEFINITION

  enum UserRole {
    USER
    ADMIN
  }

  type User {
    id:         ID!
    name:       String!
    email:      String!
    role:       UserRole!
    department: String!
    joinedAt:   String!
    """Salary is admin-only — returns null for non-admins (@auth directive)"""
    salary: Float @auth(role: "ADMIN")
  }

  type DashboardMetrics {
    activeUsers:    Int!
    newSignups:     Int!
    conversionRate: Float!

    """Use @uppercase to demonstrate field-level transformation directive"""
    departmentName: String! @uppercase

    """Only visible to admins"""
    totalRevenue:   Float @auth(role: "ADMIN")
    avgSessionTime: Int   @auth(role: "ADMIN")
    errorRate:      Float @auth(role: "ADMIN")
    bounceRate:     Float @auth(role: "ADMIN")
  }

  type Post {
    id:        ID!
    title:     String!
    views:     Int!
    author:    String!
    tags:      [String!]!
    createdAt: String!
    """
    This field is deprecated — use 'createdAt' instead.
    @deprecated in the schema is a built-in directive.
    Tools like GraphQL Playground will show a strikethrough.
    """
    date: String @deprecated(reason: "Use 'createdAt' instead. Will be removed in v3.")
  }

  type Query {
    users:   [User!]!
    user(id: ID!): User

    """Dashboard metrics — some fields require admin role"""
    dashboard(department: String!): DashboardMetrics!

    posts: [Post!]!
    post(id: ID!): Post
  }
`;

// ─── RESOLVERS ────────────────────────────────────────────────────────────────
const resolvers = {
  Query: {
    users:  () => users,
    user:   (_, { id }) => users.find(u => u.id === id) ?? null,

    dashboard: (_, { department }) => ({
      activeUsers:    metrics.activeUsers,
      newSignups:     metrics.newSignups,
      conversionRate: metrics.conversionRate,
      departmentName: department,   // will be UPPERCASED by @uppercase directive
      totalRevenue:   metrics.totalRevenue,
      avgSessionTime: metrics.avgSessionTime,
      errorRate:      metrics.errorRate,
      bounceRate:     metrics.bounceRate,
    }),

    posts: () => posts,
    post:  (_, { id }) => posts.find(p => p.id === id) ?? null,
  },

  Post: {
    // @deprecated field — still works, just marked in schema
    date: (parent) => parent.createdAt,
  },
};

// ─── CUSTOM DIRECTIVE TRANSFORMERS ───────────────────────────────────────────
// Using @graphql-tools/utils mapSchema pattern — the modern approach
// (SchemaDirectiveVisitor was Apollo Server 2 only, now deprecated)

/**
 * @uppercase directive transformer
 * Wraps the field resolver to uppercase the returned string value
 */
function uppercaseDirectiveTransformer(schema) {
  return mapSchema(schema, {
    // Run on every FIELD_DEFINITION in the schema
    [MapperKind.OBJECT_FIELD](fieldConfig) {
      const directive = getDirective(schema, fieldConfig, 'uppercase')?.[0];
      if (!directive) return fieldConfig; // no @uppercase on this field

      // Wrap the existing resolver (or use defaultFieldResolver)
      const { resolve = defaultFieldResolver } = fieldConfig;
      return {
        ...fieldConfig,
        resolve: async (source, args, context, info) => {
          const value = await resolve(source, args, context, info);
          if (typeof value === 'string') return value.toUpperCase();
          return value; // non-string: pass through unchanged
        },
      };
    },
  });
}

/**
 * @auth(role) directive transformer
 * Wraps the field resolver to check context.user.role
 * Returns null silently if role doesn't match (or throws — your choice)
 */
function authDirectiveTransformer(schema) {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD](fieldConfig) {
      const directive = getDirective(schema, fieldConfig, 'auth')?.[0];
      if (!directive) return fieldConfig;

      const requiredRole = directive.role ?? 'USER';
      const { resolve = defaultFieldResolver } = fieldConfig;

      return {
        ...fieldConfig,
        resolve: async (source, args, context, info) => {
          const userRole = context.user?.role;

          if (userRole !== requiredRole) {
            // Option A: return null silently (soft restriction)
            return null;
            // Option B: throw an error (hard restriction)
            // throw new ForbiddenError(`This field requires the ${requiredRole} role`);
          }

          return resolve(source, args, context, info);
        },
      };
    },
  });
}

// ─── BUILD SCHEMA WITH DIRECTIVES APPLIED ────────────────────────────────────
let schema = makeExecutableSchema({ typeDefs, resolvers });
schema = uppercaseDirectiveTransformer(schema); // apply @uppercase
schema = authDirectiveTransformer(schema);       // apply @auth

// ─── SERVER ───────────────────────────────────────────────────────────────────
const server = new ApolloServer({
  schema,
  // Simulate different users by passing role in a custom header
  // In real apps: decode JWT here
  context({ req }) {
    const role = req.headers['x-user-role'] || 'USER'; // 'USER' or 'ADMIN'
    return { user: { role } };
  },
});

await server.listen({ port: 4000 });
console.log('📊 Dashboard API → http://localhost:4000\n');
console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 1: BUILT-IN DIRECTIVES (@skip, @include)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# @include(if: Boolean) — include field ONLY if condition is true
# @skip(if: Boolean)    — skip field ONLY if condition is true
# They are inverses: @skip(if: x) == @include(if: !x)

# Try changing showEmail/showRole to true/false
query ConditionalFields {
  users {
    id
    name
    email    @include(if: true)   # show email
    role     @include(if: false)  # hide role
    salary   @skip(if: true)      # always skip
    joinedAt @skip(if: false)     # always include
  }
}

# Useful for: mobile vs desktop (skip heavy fields on mobile)
# Or: showing admin fields only when user is admin
query SmartDashboard($isAdmin: Boolean!) {
  dashboard(department: "engineering") {
    activeUsers
    newSignups
    conversionRate
    totalRevenue  @include(if: $isAdmin)   # admin only
    errorRate     @include(if: $isAdmin)
  }
}
# Variables: { "isAdmin": true }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 2: @deprecated DIRECTIVE (in schema)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# The 'date' field is @deprecated in the schema
# It still works but tools show a warning/strikethrough
query UseDeprecatedField {
  posts {
    id title createdAt
    date   # DEPRECATED — use createdAt instead (shown with strikethrough in IDE)
  }
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 3: CUSTOM @uppercase DIRECTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# departmentName field has @uppercase — returns UPPERCASE automatically
query UppercaseDemo {
  dashboard(department: "engineering") {
    departmentName   # returns "ENGINEERING" (uppercased by directive)
    activeUsers
  }
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 4: CUSTOM @auth(role) DIRECTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# salary and totalRevenue have @auth(role: "ADMIN")
# In Apollo Sandbox → Headers tab, add: x-user-role: USER (or ADMIN)

# With header x-user-role: USER
query AsUser {
  users {
    id name email
    salary   # returns null (USER role, @auth requires ADMIN)
  }
  dashboard(department: "sales") {
    activeUsers
    totalRevenue   # returns null
  }
}

# With header x-user-role: ADMIN
query AsAdmin {
  users {
    id name email
    salary   # returns actual salary value!
  }
  dashboard(department: "sales") {
    activeUsers
    totalRevenue   # returns actual revenue!
    errorRate
  }
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 5: NAMED FRAGMENTS (client-side query patterns)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Named fragments: define once, reuse across multiple queries
# This is pure client-side — the server never sees fragment names
# Useful for: co-locating data requirements, avoiding repetition

fragment UserBasicFields on User {
  id
  name
  email
}

fragment UserAdminFields on User {
  ...UserBasicFields
  salary
  department
  joinedAt
}

# Reuse the same fragment in multiple operations:
query GetAllUsers {
  users {
    ...UserBasicFields      # spread the fragment here
    role
  }
}

query GetUserProfile {
  user(id: "1") {
    ...UserAdminFields      # includes UserBasicFields too (nested fragments)
  }
}
`);
