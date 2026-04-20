import { ApolloServer } from 'apollo-server';

/**
 * ============================================
 * MINI PROJECT 2: GraphQL Mutations & Blog API
 * ============================================
 *
 * What you'll learn:
 * 1. Define Mutations (create, update, delete)
 * 2. Modify data with resolvers
 * 3. Return complex types
 * 4. Understand mutation patterns
 * 5. Error handling
 *
 * Run: npm run dev
 * Then open: http://localhost:4000
 */

// ============ STEP 1: Mock Database ============
let users = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com', age: 28 },
  { id: '2', name: 'Bob Smith', email: 'bob@example.com', age: 35 },
  { id: '3', name: 'Charlie Brown', email: 'charlie@example.com', age: 25 },
];

let posts = [
  {
    id: '1',
    title: 'Learning GraphQL',
    content: 'GraphQL is awesome!',
    authorId: '1',
    createdAt: '2024-01-15',
    updatedAt: '2024-01-15',
  },
  {
    id: '2',
    title: 'Node.js Best Practices',
    content: 'Always use async/await',
    authorId: '1',
    createdAt: '2024-01-16',
    updatedAt: '2024-01-16',
  },
  {
    id: '3',
    title: 'REST vs GraphQL',
    content: 'GraphQL is the future',
    authorId: '2',
    createdAt: '2024-01-17',
    updatedAt: '2024-01-17',
  },
  {
    id: '4',
    title: 'JavaScript Tips',
    content: 'Closures are powerful',
    authorId: '3',
    createdAt: '2024-01-18',
    updatedAt: '2024-01-18',
  },
];

let nextPostId = 5;

// ============ STEP 2: Define GraphQL Schema ============
const typeDefs = `
  type User {
    id: ID!
    name: String!
    email: String!
    age: Int!
    posts: [Post!]!
  }

  type Post {
    id: ID!
    title: String!
    content: String!
    author: User!
    createdAt: String!
    updatedAt: String!
  }

  """Response type for create/update/delete operations"""
  type PostResponse {
    success: Boolean!
    message: String!
    post: Post
  }

  type Query {
    """Get all users"""
    users: [User!]!

    """Get a specific user by ID"""
    user(id: ID!): User

    """Get all posts"""
    posts: [Post!]!

    """Get a specific post by ID"""
    post(id: ID!): Post

    """Search posts by title"""
    searchPosts(query: String!): [Post!]!
  }

  type Mutation {
    """Create a new blog post"""
    createPost(
      title: String!
      content: String!
      authorId: ID!
    ): PostResponse!

    """Update an existing blog post"""
    updatePost(
      id: ID!
      title: String
      content: String
    ): PostResponse!

    """Delete a blog post"""
    deletePost(id: ID!): PostResponse!

    """Create a new user"""
    createUser(
      name: String!
      email: String!
      age: Int!
    ): User!

    """Update user information"""
    updateUser(
      id: ID!
      name: String
      email: String
      age: Int
    ): User
  }
`;

// ============ STEP 3: Define Resolvers ============
const resolvers = {
  Query: {
    users: () => {
      console.log('Query: Fetching all users');
      return users;
    },

    user: (_, args) => {
      console.log(`Query: Fetching user with id: ${args.id}`);
      return users.find(u => u.id === args.id);
    },

    posts: () => {
      console.log('Query: Fetching all posts');
      return posts;
    },

    post: (_, args) => {
      console.log(`Query: Fetching post with id: ${args.id}`);
      return posts.find(p => p.id === args.id);
    },

    searchPosts: (_, args) => {
      console.log(`Query: Searching posts with query: ${args.query}`);
      const query = args.query.toLowerCase();
      return posts.filter(
        p =>
          p.title.toLowerCase().includes(query) ||
          p.content.toLowerCase().includes(query)
      );
    },
  },

  Mutation: {
    // ============ CREATE Post ============
    createPost: (_, args) => {
      console.log(
        `Mutation: Creating post "${args.title}" by user ${args.authorId}`
      );

      // Validate author exists
      const author = users.find(u => u.id === args.authorId);
      if (!author) {
        return {
          success: false,
          message: `User with ID ${args.authorId} not found`,
          post: null,
        };
      }

      const newPost = {
        id: String(nextPostId++),
        title: args.title,
        content: args.content,
        authorId: args.authorId,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
      };

      posts.push(newPost);

      return {
        success: true,
        message: 'Post created successfully',
        post: newPost,
      };
    },

    // ============ UPDATE Post ============
    updatePost: (_, args) => {
      console.log(`Mutation: Updating post with id: ${args.id}`);

      const post = posts.find(p => p.id === args.id);
      if (!post) {
        return {
          success: false,
          message: `Post with ID ${args.id} not found`,
          post: null,
        };
      }

      if (args.title) post.title = args.title;
      if (args.content) post.content = args.content;
      post.updatedAt = new Date().toISOString().split('T')[0];

      return {
        success: true,
        message: 'Post updated successfully',
        post,
      };
    },

    // ============ DELETE Post ============
    deletePost: (_, args) => {
      console.log(`Mutation: Deleting post with id: ${args.id}`);

      const index = posts.findIndex(p => p.id === args.id);
      if (index === -1) {
        return {
          success: false,
          message: `Post with ID ${args.id} not found`,
          post: null,
        };
      }

      const deletedPost = posts.splice(index, 1)[0];

      return {
        success: true,
        message: 'Post deleted successfully',
        post: deletedPost,
      };
    },

    // ============ CREATE User ============
    createUser: (_, args) => {
      console.log(`Mutation: Creating user "${args.name}"`);

      const newUser = {
        id: String(Math.max(...users.map(u => parseInt(u.id)), 0) + 1),
        name: args.name,
        email: args.email,
        age: args.age,
      };

      users.push(newUser);
      return newUser;
    },

    // ============ UPDATE User ============
    updateUser: (_, args) => {
      console.log(`Mutation: Updating user with id: ${args.id}`);

      const user = users.find(u => u.id === args.id);
      if (!user) {
        console.log(`User ${args.id} not found`);
        return null;
      }

      if (args.name) user.name = args.name;
      if (args.email) user.email = args.email;
      if (args.age) user.age = args.age;

      return user;
    },
  },

  // ============ Field Resolvers ============
  User: {
    posts: parent => {
      console.log(`Resolver: Fetching posts for user ${parent.id}`);
      return posts.filter(p => p.authorId === parent.id);
    },
  },

  Post: {
    author: parent => {
      console.log(`Resolver: Fetching author for post ${parent.id}`);
      return users.find(u => u.id === parent.authorId);
    },
  },
};

// ============ STEP 4: Create and Start Apollo Server ============
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

await server.listen({ port: 4000 });
console.log('\n✨ GraphQL Mutations Blog API is running!');
console.log('📊 Open your browser and go to: http://localhost:4000');
console.log('\n💡 Try these mutations in Apollo Sandbox:\n');

console.log('1. CREATE a new post:');
console.log(`
  mutation {
    createPost(
      title: "My New Post"
      content: "This is an awesome post"
      authorId: "1"
    ) {
      success
      message
      post {
        id
        title
        content
        author {
          name
        }
      }
    }
  }
`);

console.log('2. UPDATE a post:');
console.log(`
  mutation {
    updatePost(
      id: "1"
      title: "Updated Title"
      content: "Updated content here"
    ) {
      success
      message
      post {
        id
        title
        updatedAt
      }
    }
  }
`);

console.log('3. DELETE a post:');
console.log(`
  mutation {
    deletePost(id: "4") {
      success
      message
      post {
        id
        title
      }
    }
  }
`);

console.log('4. CREATE a new user:');
console.log(`
  mutation {
    createUser(
      name: "Diana Prince"
      email: "diana@example.com"
      age: 30
    ) {
      id
      name
      email
    }
  }
`);

console.log('5. UPDATE a user:');
console.log(`
  mutation {
    updateUser(
      id: "2"
      age: 36
    ) {
      id
      name
      age
    }
  }
`);

console.log('6. SEARCH posts:');
console.log(`
  query {
    searchPosts(query: "GraphQL") {
      id
      title
      content
      author {
        name
      }
    }
  }
`);

console.log('\n📚 Type Ctrl+C to stop the server\n');
