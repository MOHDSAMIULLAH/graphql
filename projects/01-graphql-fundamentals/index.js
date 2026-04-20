import { ApolloServer } from 'apollo-server';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname for ES modules
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * ============================================
 * MINI PROJECT 1: GraphQL Fundamentals
 * ============================================
 *
 * What you'll learn:
 * 1. Define a GraphQL Schema
 * 2. Create Resolvers (functions that return data)
 * 3. Understand Type System
 * 4. Query data
 *
 * Run: npm run dev
 * Then open: http://localhost:4000
 */

// ============ STEP 1: Sample Data (Mock Database) ============
const users = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com', age: 28 },
  { id: '2', name: 'Bob Smith', email: 'bob@example.com', age: 35 },
  { id: '3', name: 'Charlie Brown', email: 'charlie@example.com', age: 25 },
];

const posts = [
  { id: '1', title: 'Learning GraphQL', content: 'GraphQL is awesome!', authorId: '1' },
  { id: '2', title: 'Node.js Best Practices', content: 'Always use async/await', authorId: '1' },
  { id: '3', title: 'REST vs GraphQL', content: 'GraphQL is the future', authorId: '2' },
  { id: '4', title: 'JavaScript Tips', content: 'Closures are powerful', authorId: '3' },
];

// ============ STEP 2: Define GraphQL Schema (Type Definitions) ============
const typeDefs = `
  """
  A User type represents a person in our system
  """
  type User {
    """Unique identifier"""
    id: ID!

    """User's full name"""
    name: String!

    """User's email address"""
    email: String!

    """User's age"""
    age: Int!

    """All posts written by this user"""
    posts: [Post!]!
  }

  """
  A Post type represents a blog post
  """
  type Post {
    """Unique identifier"""
    id: ID!

    """Post title"""
    title: String!

    """Post content"""
    content: String!

    """Author of the post"""
    author: User!
  }

  """
  Root Query type - entry point for reading data
  Think of this like GET endpoints in REST
  """
  type Query {
    """Get all users"""
    users: [User!]!

    """Get a specific user by ID"""
    user(id: ID!): User

    """Get all posts"""
    posts: [Post!]!

    """Get a specific post by ID"""
    post(id: ID!): Post
  }
`;

// ============ STEP 3: Define Resolvers (Functions that return data) ============
/**
 * Resolvers are functions that return the data for each field
 *
 * Structure: resolverName(parent, args, context, info)
 * - parent: Data from parent resolver
 * - args: Arguments passed to the query
 * - context: Shared data (database, auth, etc.)
 * - info: Info about the GraphQL query
 */
const resolvers = {
  Query: {
    // Query: users
    // Returns: All users
    users: () => {
      console.log('Resolver: Fetching all users');
      return users;
    },

    // Query: user(id: "1")
    // Returns: Single user by ID or null
    user: (parent, args) => {
      console.log(`Resolver: Fetching user with id: ${args.id}`);
      return users.find(user => user.id === args.id);
    },

    // Query: posts
    // Returns: All posts
    posts: () => {
      console.log('Resolver: Fetching all posts');
      return posts;
    },

    // Query: post(id: "1")
    // Returns: Single post by ID or null
    post: (parent, args) => {
      console.log(`Resolver: Fetching post with id: ${args.id}`);
      return posts.find(post => post.id === args.id);
    },
  },

  // ============ Field Resolvers (for nested data) ============
  User: {
    // When someone queries user.posts, this resolver is called
    posts: (parent) => {
      console.log(`Resolver: Fetching posts for user ${parent.id}`);
      return posts.filter(post => post.authorId === parent.id);
    },
  },

  Post: {
    // When someone queries post.author, this resolver is called
    author: (parent) => {
      console.log(`Resolver: Fetching author for post ${parent.id}`);
      return users.find(user => user.id === parent.authorId);
    },
  },
};

// ============ STEP 4: Create and Start Apollo Server ============
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

// Start the server
await server.listen({ port: 4000 });
console.log('\n✨ GraphQL Server is running!');
console.log('📊 Open your browser and go to: http://localhost:4000');
console.log('\n💡 Try these queries in Apollo Sandbox:');
console.log('\n1. Get all users:');
console.log(`
  query {
    users {
      id
      name
      email
    }
  }
`);

console.log('2. Get a user with their posts:');
console.log(`
  query {
    user(id: "1") {
      name
      email
      posts {
        title
        content
      }
    }
  }
`);

console.log('3. Get a post with author details:');
console.log(`
  query {
    post(id: "1") {
      title
      content
      author {
        name
        email
      }
    }
  }
`);

console.log('4. Get all posts with their authors:');
console.log(`
  query {
    posts {
      id
      title
      author {
        name
      }
    }
  }
`);

console.log('\n📚 Type Ctrl+C to stop the server\n');
