# Project 08 — Error Handling Patterns

**System: Banking & Payment API**
**Difficulty: Advanced**

---

## What This Project Teaches

GraphQL error handling is fundamentally different from REST. You cannot use HTTP status codes for business logic errors — GraphQL always returns HTTP 200. This project teaches three patterns, from basic to advanced, so you can handle every type of error correctly and professionally.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| Node.js | Runtime |
| Apollo Server 3 | GraphQL server (includes ApolloError, UserInputError, etc.) |

---

## Concepts Covered

- GraphQL's HTTP 200 convention and where errors appear
- **Pattern 1**: Standard `ApolloError` — throw-based, errors go to `response.errors[]`
- **Pattern 2**: Error Union types — typed errors as return values (GitHub/Shopify pattern)
- **Pattern 3**: Partial success — some succeed, some fail in a batch operation
- Custom error classes extending `ApolloError`
- Error codes as machine-readable identifiers
- `__resolveType` for error union discrimination
- When to throw vs when to return an error

---

## Setup & Run

```bash
cd projects/08-error-handling-patterns
npm install
npm run dev
```

Open **http://localhost:4000**

---

## Project Structure

```
08-error-handling-patterns/
├── index.js        ← Schema + resolvers + error classes + server
├── package.json
└── README.md
```

---

## Core Concepts Explained

### GraphQL Error Format

GraphQL always responds with HTTP 200. Errors appear in the `errors` array:

```json
{
  "data": { "transfer": null },
  "errors": [
    {
      "message": "Insufficient funds: available $200, required $500",
      "extensions": {
        "code": "INSUFFICIENT_FUNDS",
        "available": 200,
        "required": 500
      },
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["transfer"]
    }
  ]
}
```

### Pattern 1 — Standard ApolloError (Throw-based)

```js
import { ApolloError, UserInputError, AuthenticationError } from 'apollo-server';

// Custom error class
class InsufficientFundsError extends ApolloError {
  constructor(available, required) {
    super(
      `Insufficient funds: available $${available}, required $${required}`,
      'INSUFFICIENT_FUNDS',    // machine-readable code
      { available, required }  // extra context in extensions
    );
  }
}

// In resolver: throw the error
transfer(_, { amount, fromAccountId }) {
  const account = findAccount(fromAccountId);
  if (account.balance < amount) {
    throw new InsufficientFundsError(account.balance, amount);
  }
}

// Response shape:
// { data: { transfer: null }, errors: [{ message: "...", extensions: { code: "INSUFFICIENT_FUNDS" } }] }
```

### Pattern 2 — Error Union (Return-based, type-safe)

The modern pattern used by GitHub, Shopify, and Stripe:

```graphql
union TransferResult = TransferSuccess | InsufficientFundsError | AccountNotFoundError

type TransferSuccess {
  transaction:    Transaction!
  newFromBalance: Float!
}

type InsufficientFundsError {
  message:   String!
  available: Float!
  required:  Float!
  shortfall: Float!
}

type Mutation {
  transfer(fromAccountId: ID!, toAccountId: ID!, amount: Float!): TransferResult!
}
```

```js
// In resolver: RETURN the error, don't throw
transfer(_, { fromAccountId, amount }) {
  const account = findAccount(fromAccountId);

  if (!account) {
    return {
      __typename: 'AccountNotFoundError',
      message:    `Account "${fromAccountId}" not found`,
      accountId:   fromAccountId,
    };
  }

  if (account.balance < amount) {
    return {
      __typename:  'InsufficientFundsError',
      message:     'Insufficient funds',
      available:   account.balance,
      required:    amount,
      shortfall:   amount - account.balance,
    };
  }

  // Success
  return { __typename: 'TransferSuccess', transaction: txn, newFromBalance: account.balance };
}

// Response shape:
// { data: { transfer: { __typename: "InsufficientFundsError", available: 200, required: 500 } } }
```

### Pattern 3 — Partial Success (Batch Operations)

```js
batchTransfer(_, { transfers }) {
  const results = transfers.map((t, index) => {
    try {
      const txn = executeTransfer(t);
      return { index, success: true, message: 'OK', transaction: txn };
    } catch (err) {
      // Don't rethrow — capture the error per item
      return { index, success: false, message: err.message, transaction: null };
    }
  });

  return {
    successCount: results.filter(r => r.success).length,
    failureCount: results.filter(r => !r.success).length,
    results,
  };
}
```

### When to Throw vs When to Return

```
THROW (Pattern 1 — ApolloError):
  ✓ Unexpected system errors (DB connection failed, file not found)
  ✓ Authentication failures (no token, invalid token)
  ✓ Authorization failures (not allowed)
  ✓ Invalid input format (UserInputError)
  ✓ When the error is not something the client should "handle gracefully"

RETURN (Pattern 2 — Error Union):
  ✓ Expected business logic failures the client should explicitly handle
  ✓ Insufficient funds, item out of stock, duplicate email
  ✓ When the error type matters to the client's UI flow
  ✓ When you want errors to be typed and documented in the schema
  ✓ When the client needs structured data about the failure (not just a message)

Rule of thumb:
  Would a frontend engineer need to switch on the ERROR TYPE to show different UI?
    YES → Error Union (they can: if (__typename === 'InsufficientFundsError') ...)
    NO  → Throw ApolloError
```

---

## Mutations to Try

```graphql
# Pattern 1: Standard throw — error in response.errors[]
mutation {
  transferV1(fromAccountId: "ACC002", toAccountId: "ACC001", amount: 1000) {
    id amount status
  }
}

# Pattern 2: Error Union — typed error in response.data
mutation {
  transfer(fromAccountId: "ACC002", toAccountId: "ACC001", amount: 1000) {
    __typename
    ... on TransferSuccess {
      message newFromBalance
      transaction { id amount }
    }
    ... on InsufficientFundsError {
      message available required shortfall
    }
    ... on TransferLimitError {
      message dailyLimit alreadySent
    }
    ... on AccountNotFoundError {
      message accountId
    }
  }
}

# Pattern 3: Batch — partial success
mutation {
  batchTransfer(transfers: [
    { fromAccountId: "ACC001", toAccountId: "ACC002", amount: 100 }
    { fromAccountId: "ACC002", toAccountId: "ACC001", amount: 5000 }
    { fromAccountId: "ACC003", toAccountId: "ACC001", amount: 200 }
  ]) {
    successCount failureCount
    results { index success message transaction { id amount } }
  }
}
```

---

## Interview Questions & Answers — Coding Round

---

### Q1. What HTTP status code does GraphQL use for errors?

**Answer**:

```
GraphQL ALWAYS returns HTTP 200 OK, even for errors.

This is a deliberate design choice:
  - A single GraphQL request can return BOTH partial data AND errors
  - Example: { data: { user: {...} }, errors: [{ message: "posts failed" }] }
    User data succeeded, posts failed — which HTTP code would you use? 200 or 500?
  - HTTP status codes are for transport-level issues, not application-level

Exceptions (when GraphQL does return non-200):
  - 400 Bad Request: completely malformed GraphQL query (syntax error)
  - 500 Internal Server Error: complete server crash before any execution

Where errors appear:
  response.errors[]  ← array of error objects, each with message + extensions
  response.data      ← partial data (can contain nulls where resolvers failed)

Contrast with REST:
  REST: 200, 201, 400, 401, 403, 404, 422, 500...
  GraphQL: always 200, application errors in response.errors[]
```

---

### Q2. Implement a custom error class in Apollo Server

**Question**: Create a `NotFoundError` that includes the resource type and ID.

**Answer**:

```js
import { ApolloError } from 'apollo-server';

class NotFoundError extends ApolloError {
  constructor(resource, id) {
    super(
      `${resource} with ID "${id}" not found`,  // human-readable message
      'NOT_FOUND',                               // machine-readable code (in extensions.code)
      {                                          // extra context in extensions
        resource,
        id,
      }
    );

    // Optional: attach to the instance for programmatic access
    this.resource = resource;
    this.id = id;
  }
}

// Usage:
throw new NotFoundError('User', '99');

// Client receives:
// {
//   "errors": [{
//     "message": "User with ID \"99\" not found",
//     "extensions": {
//       "code": "NOT_FOUND",
//       "resource": "User",
//       "id": "99"
//     }
//   }]
// }
```

---

### Q3. Design an Error Union for a payment flow

**Question**: Design the schema for a `processPayment` mutation that can succeed or fail with different typed errors.

**Answer**:

```graphql
union PaymentResult =
  PaymentSuccess
  | InsufficientFundsError
  | CardDeclinedError
  | FraudDetectedError
  | InvalidCardError

type PaymentSuccess {
  transactionId:  ID!
  amount:         Float!
  currency:       String!
  receiptUrl:     String!
}

type InsufficientFundsError {
  message:   String!
  available: Float!
  required:  Float!
}

type CardDeclinedError {
  message:    String!
  declineCode: String!   # "insufficient_funds", "do_not_honor", etc.
  canRetry:   Boolean!
}

type FraudDetectedError {
  message:  String!
  caseId:   ID!
  action:   String!   # "blocked", "review_required"
}

type InvalidCardError {
  message: String!
  field:   String!   # "number", "expiry", "cvv"
}

type Mutation {
  processPayment(
    amount:   Float!
    currency: String!
    cardId:   ID!
  ): PaymentResult!
}
```

```js
// Resolver:
const resolvers = {
  Mutation: {
    processPayment(_, { amount, currency, cardId }) {
      if (amount <= 0) throw new UserInputError('Amount must be positive');

      const card = cards.find(c => c.id === cardId);
      if (!card) throw new UserInputError(`Card "${cardId}" not found`);

      if (!card.isValid)
        return { __typename: 'InvalidCardError', message: 'Card is expired', field: 'expiry' };

      if (card.balance < amount)
        return { __typename: 'InsufficientFundsError', message: 'Insufficient funds',
                 available: card.balance, required: amount };

      const txn = executePayment(card, amount, currency);
      return { __typename: 'PaymentSuccess', transactionId: txn.id, amount, currency,
               receiptUrl: `https://receipts.example.com/${txn.id}` };
    },
  },

  PaymentResult: {
    __resolveType: (obj) => obj.__typename,
  },
};
```

---

### Q4. What are the built-in Apollo error types?

**Answer**:

```js
import {
  ApolloError,           // Base class — extend this for custom errors
  UserInputError,        // Invalid user input (400 equivalent)
  AuthenticationError,   // Not authenticated (401 equivalent)
  ForbiddenError,        // Not authorized (403 equivalent)
} from 'apollo-server';

// ApolloError — base class
throw new ApolloError('Something went wrong', 'CUSTOM_CODE', { extra: 'data' });

// UserInputError — for validation failures
throw new UserInputError('Email is invalid', {
  invalidArgs: ['email']  // standard field for the Apollo Client
});

// AuthenticationError — missing or invalid credentials
throw new AuthenticationError('You must be logged in');
// Note: do NOT include the actual token or credential details in the message

// ForbiddenError — authenticated but not permitted
throw new ForbiddenError('Admins only');

// All errors produce:
// { errors: [{ message: "...", extensions: { code: "USER_INPUT_ERROR" } }] }
```

---

### Q5. What is the Error Union pattern and why is it better than throwing?

**Answer**:

```
Throwing (Pattern 1):
  Errors appear in response.errors[] as unstructured objects.
  Client must parse the message string to understand the error type.
  The errors[] array is NOT type-safe — any shape can appear there.
  Not documented in the schema — clients discover errors by trial and error.

Error Union (Pattern 2):
  Errors are RETURN VALUES — part of the schema, typed, documented.
  Client uses __typename to discriminate: if (result.__typename === 'InsufficientFundsError')
  Fully type-safe — code generators produce typed error interfaces.
  Self-documenting — clients introspect the schema to see all possible errors.

  Who uses it:
    GitHub API:  createIssue returns CreateIssuePayload | UserError
    Shopify:     mutations return ...Payload with userErrors field
    Stripe:      uses error union-like patterns in their newer APIs

Hybrid approach (most real projects):
  - Use Error Union for expected business failures (the ones clients handle explicitly)
  - Use throw for unexpected/system errors (auth failures, infra errors, validation)
```

---

### Q6. Implement `__resolveType` for an error union

**Answer**:

```js
const resolvers = {
  TransferResult: {
    __resolveType(obj) {
      // Strategy 1: explicit __typename (recommended)
      return obj.__typename;

      // Strategy 2: check for type-discriminating fields
      if (obj.transaction)  return 'TransferSuccess';
      if (obj.shortfall)    return 'InsufficientFundsError';
      if (obj.accountId)    return 'AccountNotFoundError';
      if (obj.dailyLimit)   return 'TransferLimitError';
      return null;
    },
  },
};

// Best practice: always set __typename explicitly in your return objects
// so __resolveType is a simple one-liner:
// return { __typename: 'InsufficientFundsError', ...errorData }
```

---

## Key Takeaways

1. GraphQL always returns HTTP 200. Errors appear in `response.errors[]`.
2. Three patterns: throw ApolloError, return Error Union, partial success for batches.
3. **Throw** for: auth failures, system errors, unexpected failures.
4. **Return error union** for: expected business logic failures clients handle explicitly.
5. Custom error classes give you machine-readable codes (`extensions.code`) for clients to switch on.
6. Error Union types are fully typed and schema-documented — the modern industry standard.
7. Partial success for batch mutations — wrap each item in try/catch, return results array.
