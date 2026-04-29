/**
 * ============================================================
 * MINI PROJECT 6: Authentication & Authorization
 * System: Protected API with JWT + Role-based Access
 * ============================================================
 *
 * CONCEPTS COVERED:
 * ─────────────────
 * 1. AUTHENTICATION  → Verifying WHO you are (login → JWT token)
 * 2. AUTHORIZATION   → Verifying WHAT you can do (role-based access)
 * 3. CONTEXT         → How to pass user info to every resolver safely
 * 4. PROTECTED RESOLVERS → throw AuthenticationError / ForbiddenError
 *
 * THE FLOW:
 * ─────────
 *  Client login → server returns JWT token
 *  Client sends: Authorization: Bearer <token> header on every request
 *  Server context() extracts & verifies token → puts user in context
 *  Resolvers read context.user → check auth & role
 *
 * INTERVIEW Q&A:
 * ──────────────
 * Q: How do you implement authentication in GraphQL?
 * A: 1. login mutation → verify credentials → return JWT token
 *    2. ApolloServer context function → extract Bearer token from headers
 *       → verify JWT → put decoded user in context object
 *    3. Resolvers check context.user — if null, throw AuthenticationError
 *
 * Q: Where should auth logic live — middleware or resolvers?
 * A: Both are valid. Context function is great for token verification (runs
 *    once per request). Individual resolvers handle authorization (role checks)
 *    since different resolvers have different permission requirements.
 *    For large apps: use a schema directive like @auth(role: ADMIN).
 *
 * Q: What is context in GraphQL?
 * A: A shared object passed to EVERY resolver (4th resolver argument: info).
 *    Used to share: database connection, authenticated user, DataLoaders,
 *    request headers. Created fresh per request (not shared between requests).
 *    Context function signature: ({ req, res }) => ({ user, db, loaders })
 *
 * Q: What errors should you throw in resolvers?
 * A: AuthenticationError  → not logged in (401 equivalent)
 *    ForbiddenError        → logged in but not allowed (403 equivalent)
 *    UserInputError        → invalid input data (400 equivalent)
 *    ApolloError           → generic error with custom code
 *
 * RUN: npm install && npm run dev
 * OPEN: http://localhost:4000
 *
 * TEST CREDENTIALS:
 *   alice@example.com / password123  (role: USER)
 *   admin@example.com / admin456     (role: ADMIN)
 */

import { ApolloServer, AuthenticationError, ForbiddenError, UserInputError } from 'apollo-server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'super-secret-key-change-in-production'; // Use env var in real apps!
const JWT_EXPIRES_IN = '7d';

// ─── MOCK DATABASE ────────────────────────────────────────────────────────────
// In production: passwords are bcrypt-hashed. Here plain text for clarity.
const users = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com', password: 'password123', role: 'USER',  bio: 'GraphQL learner', createdAt: '2023-01-01' },
  { id: '2', name: 'Bob Smith',     email: 'bob@example.com',   password: 'password456', role: 'USER',  bio: 'Backend dev',     createdAt: '2023-02-15' },
  { id: '3', name: 'Admin User',    email: 'admin@example.com', password: 'admin456',    role: 'ADMIN', bio: 'System admin',    createdAt: '2022-01-01' },
];

const posts = [
  { id: '1', title: 'Learning GraphQL',   content: 'GraphQL is amazing!', authorId: '1', published: true,  createdAt: '2023-06-01' },
  { id: '2', title: 'My Secret Draft',    content: 'Not ready yet...',    authorId: '1', published: false, createdAt: '2023-06-15' },
  { id: '3', title: 'Node.js Tips',       content: 'Use async/await',     authorId: '2', published: true,  createdAt: '2023-07-01' },
  { id: '4', title: 'Admin Notes',        content: 'Sensitive admin data', authorId: '3', published: false, createdAt: '2023-08-01' },
];

// ─── AUTH HELPERS ─────────────────────────────────────────────────────────────
function generateToken(user) {
  // Sign a JWT with user payload — do NOT include password!
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET); // returns decoded payload
  } catch {
    return null; // Invalid or expired token
  }
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const typeDefs = `
  enum UserRole {
    USER
    ADMIN
  }

  type User {
    id:        ID!
    name:      String!
    email:     String!
    role:      UserRole!
    bio:       String
    createdAt: String!
  }

  type Post {
    id:        ID!
    title:     String!
    content:   String!
    published: Boolean!
    author:    User!
    createdAt: String!
  }

  """Returned after successful login or register"""
  type AuthPayload {
    token: String!     # JWT token — client stores this and sends as Bearer header
    user:  User!
  }

  type Query {
    """Public: anyone can see published posts"""
    publicPosts: [Post!]!

    """Protected: must be logged in — returns YOUR own posts (including drafts)"""
    myPosts: [Post!]!

    """Protected: returns YOUR own profile"""
    me: User!

    """Admin only: see all users"""
    allUsers: [User!]!

    """Admin only: see ALL posts including unpublished"""
    allPosts: [Post!]!
  }

  type Mutation {
    """Register a new account"""
    register(name: String!, email: String!, password: String!): AuthPayload!

    """Login and get JWT token"""
    login(email: String!, password: String!): AuthPayload!

    """Protected: create a post (must be logged in)"""
    createPost(title: String!, content: String!, published: Boolean = false): Post!

    """Protected: only the post author can delete it"""
    deletePost(id: ID!): Boolean!

    """Admin only: promote a user to ADMIN role"""
    promoteToAdmin(userId: ID!): User!
  }
`;

// ─── RESOLVERS ────────────────────────────────────────────────────────────────
const resolvers = {
  Query: {
    // PUBLIC — no auth needed
    publicPosts: () => posts.filter(p => p.published),

    // PROTECTED — must be logged in
    myPosts(_, __, context) {
      requireAuth(context);           // throws AuthenticationError if not logged in
      return posts.filter(p => p.authorId === context.user.userId);
    },

    me(_, __, context) {
      requireAuth(context);
      const user = users.find(u => u.id === context.user.userId);
      if (!user) throw new AuthenticationError('User account not found');
      return user;
    },

    // ADMIN ONLY
    allUsers(_, __, context) {
      requireRole(context, 'ADMIN'); // throws ForbiddenError if not admin
      return users;
    },

    allPosts(_, __, context) {
      requireRole(context, 'ADMIN');
      return posts;
    },
  },

  Mutation: {
    register(_, { name, email, password }) {
      // Validation
      if (!name.trim())    throw new UserInputError('Name cannot be empty');
      if (!email.includes('@')) throw new UserInputError('Invalid email format');
      if (password.length < 6)  throw new UserInputError('Password must be at least 6 characters');

      if (users.find(u => u.email === email))
        throw new UserInputError('Email already registered', { field: 'email' });

      const user = {
        id: String(users.length + 1),
        name: name.trim(),
        email: email.toLowerCase(),
        password, // In production: bcrypt.hash(password, 10)
        role: 'USER',
        bio: null,
        createdAt: new Date().toISOString(),
      };
      users.push(user);

      return { token: generateToken(user), user };
    },

    login(_, { email, password }) {
      const user = users.find(u => u.email === email.toLowerCase());
      if (!user) throw new UserInputError('Invalid email or password'); // vague on purpose (security)

      // In production: await bcrypt.compare(password, user.passwordHash)
      if (user.password !== password)
        throw new UserInputError('Invalid email or password');

      return { token: generateToken(user), user };
    },

    createPost(_, { title, content, published }, context) {
      requireAuth(context);
      if (!title.trim()) throw new UserInputError('Title cannot be empty');

      const post = {
        id: String(posts.length + 1),
        title:     title.trim(),
        content,
        published: published ?? false,
        authorId:  context.user.userId,
        createdAt: new Date().toISOString(),
      };
      posts.push(post);
      return post;
    },

    deletePost(_, { id }, context) {
      requireAuth(context);
      const post = posts.find(p => p.id === id);
      if (!post) throw new UserInputError(`Post "${id}" not found`);

      // Only author OR admin can delete
      const isAuthor = post.authorId === context.user.userId;
      const isAdmin  = context.user.role === 'ADMIN';
      if (!isAuthor && !isAdmin)
        throw new ForbiddenError('You can only delete your own posts');

      posts.splice(posts.indexOf(post), 1);
      return true;
    },

    promoteToAdmin(_, { userId }, context) {
      requireRole(context, 'ADMIN');
      const user = users.find(u => u.id === userId);
      if (!user) throw new UserInputError(`User "${userId}" not found`);
      user.role = 'ADMIN';
      return user;
    },
  },

  Post: {
    author: (parent) => users.find(u => u.id === parent.authorId),
  },
};

// ─── AUTH GUARD HELPERS ───────────────────────────────────────────────────────
function requireAuth(context) {
  if (!context.user) {
    throw new AuthenticationError(
      'You must be logged in. Send header: Authorization: Bearer <token>'
    );
  }
}

function requireRole(context, role) {
  requireAuth(context);
  if (context.user.role !== role) {
    throw new ForbiddenError(`This action requires the ${role} role`);
  }
}

// ─── SERVER WITH CONTEXT ──────────────────────────────────────────────────────
const server = new ApolloServer({
  typeDefs,
  resolvers,

  // context() runs ONCE per request.
  // It extracts the JWT from the Authorization header and decodes it.
  // The returned object is passed as the 3rd argument to every resolver.
  context({ req }) {
    // Extract token from "Authorization: Bearer <token>" header
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    let user = null;
    if (token) {
      user = verifyToken(token); // null if invalid/expired
      if (!user) {
        // Optionally throw here to reject invalid tokens immediately
        // throw new AuthenticationError('Invalid or expired token');
        // OR silently set null (unauthenticated) — allows public routes to work
        console.log('⚠️  Invalid or expired JWT token');
      }
    }

    // Return context object — available in ALL resolvers as 3rd argument
    return {
      user,       // decoded JWT payload: { userId, email, role } or null
      // db,      // in real app: pass db connection here
      // loaders, // DataLoaders per request
    };
  },
});

await server.listen({ port: 4000 });
console.log('🔐 Auth API → http://localhost:4000\n');
console.log(`
STEP 1 — Login to get a token (or register):
──────────────────────────────────────────────
mutation Login {
  login(email: "alice@example.com", password: "password123") {
    token
    user { id name role }
  }
}

STEP 2 — Copy the token from response.
In Apollo Sandbox → Headers tab → add:
  Authorization: Bearer YOUR_TOKEN_HERE

STEP 3 — Now call protected queries:
──────────────────────────────────────
query MyProfile {
  me { id name email role }
}

query MyPosts {
  myPosts { id title published }
}

mutation CreatePost {
  createPost(title: "My First Post", content: "Hello GraphQL!", published: true) {
    id title published
    author { name }
  }
}

STEP 4 — Try admin-only with alice's token (role: USER) — gets ForbiddenError:
──────────────────────────────────────────────────────────────────────────────
query AdminOnly {
  allUsers { id name role }
}

STEP 5 — Login as admin and retry:
────────────────────────────────────
mutation AdminLogin {
  login(email: "admin@example.com", password: "admin456") {
    token
    user { name role }
  }
}
`);
