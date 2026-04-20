# 🚀 Mini Project 1: GraphQL Fundamentals

## 📌 What You'll Learn
- ✅ Define a GraphQL Schema with Types
- ✅ Create Resolvers (functions that return data)
- ✅ Query nested data relationships
- ✅ Understand the Type System (Scalars, Objects, Arrays)
- ✅ Use Apollo Sandbox for testing

---

## 🎯 Project Overview

This project demonstrates the core GraphQL concepts using a **Blog Platform** example:
- Users can write posts
- Each user has multiple posts
- Each post has an author

**Data Model:**
```
User (id, name, email, age)
  └─ posts: Post[]

Post (id, title, content, authorId)
  └─ author: User
```

---

## 📂 Project Structure

```
01-graphql-fundamentals/
├── package.json          # Dependencies
├── index.js              # Main Apollo Server (all code in one file for learning)
└── README.md            # This file
```

---

## 🚀 Getting Started

### Step 1: Install Dependencies
```bash
cd projects/01-graphql-fundamentals
npm install
```

This will install:
- `apollo-server`: GraphQL server framework
- `@apollo/client`: GraphQL client library

### Step 2: Start the Server
```bash
npm run dev
```

You should see:
```
✨ GraphQL Server is running!
📊 Open your browser and go to: http://localhost:4000
```

### Step 3: Open Apollo Sandbox
1. Open your browser to `http://localhost:4000`
2. Apollo Sandbox will open automatically
3. You're ready to query! 🎉

---

## 💡 Understanding the Code

### 1. **Sample Data** (Mock Database)
```javascript
const users = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com', age: 28 },
  // ...
];
```
In real apps, this comes from a database (PostgreSQL, MongoDB, etc.)

### 2. **Type Definitions** (Schema)
```javascript
type User {
  id: ID!              # Required ID field
  name: String!        # Required string
  email: String!
  age: Int!
  posts: [Post!]!      # Required array of required Posts
}
```

**Key Symbols:**
- `!` = Required (must always have a value)
- `[]` = Array (list of items)
- `String`, `Int`, `Boolean`, `ID`, `Float` = Scalars (basic types)

### 3. **Resolvers** (Data Fetchers)
```javascript
const resolvers = {
  Query: {
    // This function is called when someone queries "users"
    users: () => users,

    // This function is called when someone queries "user(id: ...)"
    user: (parent, args) => {
      return users.find(user => user.id === args.id);
    },
  },

  User: {
    // This is called when querying a User's posts
    posts: (parent) => {
      return posts.filter(post => post.authorId === parent.id);
    },
  },
};
```

---

## 🔍 Try These Queries

### Query 1: Get All Users
```graphql
query {
  users {
    id
    name
    email
    age
  }
}
```

**Response:**
```json
{
  "data": {
    "users": [
      {
        "id": "1",
        "name": "Alice Johnson",
        "email": "alice@example.com",
        "age": 28
      },
      // ...
    ]
  }
}
```

### Query 2: Get User with Posts (Nested Query)
```graphql
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
```

This demonstrates the power of GraphQL:
- Single request
- Gets user + their posts
- Only fields you asked for

### Query 3: Get Post with Author
```graphql
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
```

### Query 4: Complex Nested Query
```graphql
query {
  posts {
    id
    title
    author {
      id
      name
      email
    }
  }
}
```

---

## 🧪 Hands-On Exercises

### Exercise 1: Add a New Field
**Task:** Add `createdAt` field to User type

**Steps:**
1. Open `index.js`
2. Find the `User` type definition
3. Add: `createdAt: String!`
4. Save and the server auto-reloads
5. Update the users data with dates
6. Query it!

**Solution:**
```javascript
// In typeDefs
type User {
  id: ID!
  name: String!
  email: String!
  age: Int!
  createdAt: String!    // Add this line
  posts: [Post!]!
}

// In mock data
const users = [
  { 
    id: '1', 
    name: 'Alice Johnson', 
    email: 'alice@example.com', 
    age: 28,
    createdAt: '2024-01-15'   // Add this
  },
  // ...
];
```

### Exercise 2: Query with Argument
**Task:** Get only users older than 25

**Steps:**
1. Add an argument to the `users` query: `users(minAge: Int)`
2. Filter users in the resolver based on minAge
3. Query it!

**Solution:**
```javascript
// In typeDefs
type Query {
  users(minAge: Int): [User!]!
  // ... other queries
}

// In resolvers
users: (parent, args) => {
  if (args.minAge) {
    return users.filter(user => user.age >= args.minAge);
  }
  return users;
}

// Query it:
query {
  users(minAge: 30) {
    name
    age
  }
}
```

### Exercise 3: Add Your Own Field
**Task:** Add a `postCount` field to User that returns how many posts they have

**Hint:** Use a field resolver to calculate this dynamically

---

## 📊 Comparison with REST API

### REST API Approach:
```
GET /api/users/1           → returns User object
GET /api/users/1/posts     → returns Posts array
GET /api/posts/1           → returns Post object
GET /api/posts/1/author    → returns User object

Total: 4 API calls
```

### GraphQL Approach:
```
POST /graphql
{
  user(id: "1") {
    posts {
      author
    }
  }
}

Total: 1 API call
```

---

## 🔑 Key Concepts Recap

| Concept | Explanation |
|---------|-------------|
| **Schema** | Contract between client & server (defines all possible queries) |
| **Type** | Blueprint for an object (User, Post, etc.) |
| **Scalar** | Basic type (String, Int, Boolean, ID, Float) |
| **Resolver** | Function that returns data for a field |
| **Query** | Operation to read data |
| **Argument** | Parameter passed to a field/query |
| **Mutation** | Operation to write/modify data (we'll learn next) |

---

## 🚨 Common Mistakes

### ❌ Mistake 1: Forgetting `!`
```graphql
# Wrong - email could be null
name: String

# Right - email must always have a value
name: String!
```

### ❌ Mistake 2: Field Resolver Not Called
```javascript
// If User type has posts field, resolver is called
// You MUST have User.posts resolver
User: {
  posts: (parent) => {
    return posts.filter(post => post.authorId === parent.id);
  },
}
```

### ❌ Mistake 3: Wrong Return Type
```javascript
// Wrong - resolving posts should return array
posts: (parent) => posts[0]  // Returns single object

// Right
posts: (parent) => posts.filter(...)  // Returns array
```

---

## 🎬 What's Next?

Once you're comfortable with this project:

1. **Mini Project 2:** Build a mutations-based API (Create, Update, Delete)
2. **Mini Project 3:** Add real database (MongoDB/PostgreSQL)
3. **Mini Project 4:** Add authentication & authorization
4. **Mini Project 5:** Add subscriptions for real-time updates

---

## 📚 Learning Resources

- [GraphQL Official Tutorial](https://graphql.org/learn)
- [Apollo Server Docs](https://www.apollographql.com/docs)
- [GraphQL Queries & Mutations](https://graphql.org/learn/queries)

---

## 💬 Tips for Success

✅ **Type every query yourself** - don't copy-paste
✅ **Experiment** - try removing fields, see what happens
✅ **Read the errors** - GraphQL errors are very helpful
✅ **Use Apollo Sandbox** - it has auto-complete & docs
✅ **Break it intentionally** - then fix it

---

**Happy Learning! 🚀 You've got this!**
