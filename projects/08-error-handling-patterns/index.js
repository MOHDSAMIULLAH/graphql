/**
 * ============================================================
 * MINI PROJECT 8: Error Handling Patterns
 * System: Banking / Payment API
 * ============================================================
 *
 * CONCEPTS COVERED — Three patterns, from simple to advanced:
 * ──────────────────────────────────────────────────────────
 *
 * PATTERN 1: Standard ApolloError (most common)
 *   - throw new UserInputError / AuthenticationError / ApolloError
 *   - Error appears in response "errors" array
 *   - HTTP status always 200 (GraphQL convention)
 *   - Best for: simple error cases
 *
 * PATTERN 2: Error Union (modern, type-safe pattern)
 *   - Return type is a UNION: union Result = SuccessType | ErrorType1 | ErrorType2
 *   - Errors are part of the schema — fully typed and documented
 *   - Client uses __typename to discriminate
 *   - Best for: business logic errors that clients handle explicitly
 *   - Used by: GitHub API, Shopify, Stripe
 *
 * PATTERN 3: Partial Success
 *   - Some operations succeed, some fail in the same mutation
 *   - Return both successful and failed results
 *   - Best for: batch operations
 *
 * INTERVIEW Q&A:
 * ──────────────
 * Q: What is the difference between GraphQL errors and HTTP errors?
 * A: GraphQL always returns HTTP 200 (even for errors). Errors appear in
 *    the "errors" array of the response alongside data. This lets a single
 *    response have both partial data AND errors. HTTP errors (400, 500) are
 *    only used for transport-level issues (malformed request, server crash).
 *
 * Q: What are the built-in Apollo error types?
 * A: UserInputError       → invalid client input (400-like)
 *    AuthenticationError  → not authenticated (401-like)
 *    ForbiddenError        → authenticated but not authorized (403-like)
 *    ApolloError           → base class, any custom error with code + extensions
 *
 * Q: What is the Error Union pattern and why use it?
 * A: Instead of throwing errors, return a union type that includes error types.
 *    Advantages: errors are in the schema (documented, typed), clients can use
 *    code generation to handle specific errors, no need to parse error messages.
 *    The errors[] array approach is "stringly typed" — the union approach is not.
 *
 * Q: When do you throw vs return an error?
 * A: Throw (ApolloError):    unexpected/system errors, auth failures, infra issues
 *    Return (Error Union):   expected business logic failures the client should handle
 *
 * RUN: npm install && npm run dev
 * OPEN: http://localhost:4000
 */

import { ApolloServer, ApolloError, UserInputError, AuthenticationError } from 'apollo-server';

// ─── CUSTOM ERROR CLASSES ─────────────────────────────────────────────────────
// Extend ApolloError to create domain-specific errors with custom codes.
// These codes are machine-readable — clients can switch on them.
class NotFoundError extends ApolloError {
  constructor(resource, id) {
    super(`${resource} with ID "${id}" not found`, 'NOT_FOUND');
    this.resource = resource;
  }
}

class InsufficientFundsError extends ApolloError {
  constructor(available, required) {
    super(
      `Insufficient funds: available $${available}, required $${required}`,
      'INSUFFICIENT_FUNDS',
      { available, required }
    );
  }
}

class DailyLimitExceededError extends ApolloError {
  constructor(limit) {
    super(
      `Daily transfer limit of $${limit} exceeded`,
      'DAILY_LIMIT_EXCEEDED',
      { dailyLimit: limit }
    );
  }
}

// ─── MOCK DATABASE ────────────────────────────────────────────────────────────
const accounts = [
  { id: 'ACC001', owner: 'Alice Johnson', balance: 5000, dailyTransferred: 0,   dailyLimit: 2000 },
  { id: 'ACC002', owner: 'Bob Smith',     balance: 200,  dailyTransferred: 1800, dailyLimit: 2000 },
  { id: 'ACC003', owner: 'Charlie Brown', balance: 10000, dailyTransferred: 0,  dailyLimit: 5000 },
];

const transactions = [
  { id: 'TXN001', fromId: 'ACC001', toId: 'ACC002', amount: 100, status: 'COMPLETED', createdAt: '2024-01-10T10:00:00Z' },
];

let txnCounter = 2;

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const typeDefs = `
  type Account {
    id:          ID!
    owner:       String!
    balance:     Float!
    dailyLimit:  Float!
    transactions: [Transaction!]!
  }

  type Transaction {
    id:        ID!
    from:      Account!
    to:        Account!
    amount:    Float!
    status:    TransactionStatus!
    createdAt: String!
  }

  enum TransactionStatus {
    PENDING
    COMPLETED
    FAILED
  }

  # ════════════════════════════════════════════════════════════
  # PATTERN 2: ERROR UNION TYPES
  # These are SCHEMA-LEVEL errors — typed, documented, discoverable
  # ════════════════════════════════════════════════════════════

  """Success case for a transfer"""
  type TransferSuccess {
    transaction:    Transaction!
    newFromBalance: Float!
    newToBalance:   Float!
    message:        String!
  }

  """Business error: not enough money in the account"""
  type InsufficientFundsError {
    message:   String!
    available: Float!
    required:  Float!
    shortfall: Float!
  }

  """Business error: account not found"""
  type AccountNotFoundError {
    message:   String!
    accountId: String!
  }

  """Business error: daily transfer limit exceeded"""
  type TransferLimitError {
    message:    String!
    dailyLimit: Float!
    alreadySent: Float!
    requested:  Float!
  }

  """
  The union return type for transfer.
  Client uses __typename to know which case they got:
  TransferSuccess | InsufficientFundsError | AccountNotFoundError | TransferLimitError
  """
  union TransferResult =
    TransferSuccess
    | InsufficientFundsError
    | AccountNotFoundError
    | TransferLimitError

  # ════════════════════════════════════════════════════════════
  # PATTERN 3: PARTIAL SUCCESS
  # For batch operations — some succeed, some fail
  # ════════════════════════════════════════════════════════════

  type BatchTransferItem {
    index:   Int!
    success: Boolean!
    message: String!
    transaction: Transaction
  }

  type BatchTransferResult {
    successCount: Int!
    failureCount: Int!
    results:      [BatchTransferItem!]!
  }

  type Query {
    account(id: ID!): Account
    accounts: [Account!]!
    transaction(id: ID!): Transaction
  }

  type Mutation {
    # ── PATTERN 1: Standard ApolloError (throw-based) ──────────────────────
    # Errors appear in response.errors[] array
    transferV1(fromAccountId: ID!, toAccountId: ID!, amount: Float!): Transaction!

    # ── PATTERN 2: Error Union (return-based, type-safe) ───────────────────
    # Errors are typed return values — no surprise errors[], all in 'data'
    transfer(fromAccountId: ID!, toAccountId: ID!, amount: Float!): TransferResult!

    # ── PATTERN 3: Batch / Partial Success ──────────────────────────────────
    batchTransfer(transfers: [TransferInput!]!): BatchTransferResult!

    # Utility
    resetDailyLimits: Boolean!
  }

  input TransferInput {
    fromAccountId: ID!
    toAccountId:   ID!
    amount:        Float!
  }
`;

// ─── RESOLVERS ────────────────────────────────────────────────────────────────
const resolvers = {
  Query: {
    account:     (_, { id })  => accounts.find(a => a.id === id) ?? null,
    accounts:    ()           => accounts,
    transaction: (_, { id })  => transactions.find(t => t.id === id) ?? null,
  },

  Mutation: {
    // ── PATTERN 1: Standard throw-based errors ───────────────────────────────
    // Errors appear in: response.errors[0].message and response.errors[0].extensions.code
    transferV1(_, { fromAccountId, toAccountId, amount }) {
      // Input validation → UserInputError
      if (amount <= 0)
        throw new UserInputError('Transfer amount must be positive', { field: 'amount' });

      const from = accounts.find(a => a.id === fromAccountId);
      if (!from) throw new NotFoundError('Account', fromAccountId);

      const to = accounts.find(a => a.id === toAccountId);
      if (!to) throw new NotFoundError('Account', toAccountId);

      if (from.id === to.id)
        throw new UserInputError('Cannot transfer to the same account');

      // Business logic errors → custom ApolloError with code
      if (from.balance < amount)
        throw new InsufficientFundsError(from.balance, amount);

      if (from.dailyTransferred + amount > from.dailyLimit)
        throw new DailyLimitExceededError(from.dailyLimit);

      // Execute transfer
      return executeTransfer(from, to, amount);
    },

    // ── PATTERN 2: Error Union (return typed errors, don't throw) ────────────
    // Errors are in: response.data.transfer.__typename
    // Client handles specific error types without parsing strings
    transfer(_, { fromAccountId, toAccountId, amount }) {
      // Still throw for truly invalid input (not business logic)
      if (amount <= 0)
        throw new UserInputError('Transfer amount must be positive');

      const from = accounts.find(a => a.id === fromAccountId);
      if (!from) {
        // RETURN an error object instead of throwing
        return { __typename: 'AccountNotFoundError', message: `Account "${fromAccountId}" not found`, accountId: fromAccountId };
      }

      const to = accounts.find(a => a.id === toAccountId);
      if (!to) {
        return { __typename: 'AccountNotFoundError', message: `Account "${toAccountId}" not found`, accountId: toAccountId };
      }

      if (from.balance < amount) {
        return {
          __typename: 'InsufficientFundsError',
          message:   `Insufficient funds`,
          available:  from.balance,
          required:   amount,
          shortfall:  amount - from.balance,
        };
      }

      const newFromBalance = from.balance - amount;
      if (from.dailyTransferred + amount > from.dailyLimit) {
        return {
          __typename:  'TransferLimitError',
          message:     `Daily limit exceeded`,
          dailyLimit:  from.dailyLimit,
          alreadySent: from.dailyTransferred,
          requested:   amount,
        };
      }

      // Success case
      const txn = executeTransfer(from, to, amount);
      return {
        __typename:     'TransferSuccess',
        transaction:    txn,
        newFromBalance: from.balance,
        newToBalance:   to.balance,
        message:        `Successfully transferred $${amount}`,
      };
    },

    // ── PATTERN 3: Partial Success ────────────────────────────────────────────
    // Process each transfer independently — some may fail, some succeed
    batchTransfer(_, { transfers }) {
      const results = transfers.map((t, index) => {
        try {
          const from = accounts.find(a => a.id === t.fromAccountId);
          if (!from) throw new Error(`Account "${t.fromAccountId}" not found`);

          const to = accounts.find(a => a.id === t.toAccountId);
          if (!to) throw new Error(`Account "${t.toAccountId}" not found`);

          if (from.balance < t.amount)
            throw new Error(`Insufficient funds: available $${from.balance}`);

          const txn = executeTransfer(from, to, t.amount);
          return { index, success: true, message: `Transferred $${t.amount}`, transaction: txn };

        } catch (err) {
          return { index, success: false, message: err.message, transaction: null };
        }
      });

      return {
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length,
        results,
      };
    },

    resetDailyLimits() {
      accounts.forEach(a => (a.dailyTransferred = 0));
      return true;
    },
  },

  // __resolveType for TransferResult union
  TransferResult: {
    __resolveType(obj) {
      return obj.__typename;
    },
  },

  Account: {
    transactions: (parent) =>
      transactions.filter(t => t.fromId === parent.id || t.toId === parent.id),
  },

  Transaction: {
    from: (parent) => accounts.find(a => a.id === parent.fromId),
    to:   (parent) => accounts.find(a => a.id === parent.toId),
  },
};

// ─── HELPER ───────────────────────────────────────────────────────────────────
function executeTransfer(from, to, amount) {
  from.balance -= amount;
  to.balance   += amount;
  from.dailyTransferred += amount;

  const txn = {
    id:        `TXN${String(txnCounter++).padStart(3, '0')}`,
    fromId:    from.id,
    toId:      to.id,
    amount,
    status:    'COMPLETED',
    createdAt: new Date().toISOString(),
  };
  transactions.push(txn);
  return txn;
}

// ─── SERVER ───────────────────────────────────────────────────────────────────
const server = new ApolloServer({ typeDefs, resolvers });
await server.listen({ port: 4000 });
console.log('🏦 Banking API → http://localhost:4000\n');
console.log(`
# ── PATTERN 1: Standard ApolloError (error in response.errors[])
mutation Pattern1_Success {
  transferV1(fromAccountId: "ACC001", toAccountId: "ACC002", amount: 100) {
    id amount status
    from { owner balance }
    to   { owner balance }
  }
}

mutation Pattern1_InsufficientFunds {
  transferV1(fromAccountId: "ACC002", toAccountId: "ACC001", amount: 1000) {
    id
  }
  # Response: { errors: [{ message: "Insufficient funds...", extensions: { code: "INSUFFICIENT_FUNDS" } }] }
}

# ── PATTERN 2: Error Union (typed errors in response.data)
mutation Pattern2_Success {
  transfer(fromAccountId: "ACC001", toAccountId: "ACC002", amount: 500) {
    __typename
    ... on TransferSuccess {
      message newFromBalance newToBalance
      transaction { id amount status }
    }
    ... on InsufficientFundsError {
      message available required shortfall
    }
    ... on AccountNotFoundError {
      message accountId
    }
    ... on TransferLimitError {
      message dailyLimit alreadySent requested
    }
  }
}

mutation Pattern2_LimitExceeded {
  transfer(fromAccountId: "ACC002", toAccountId: "ACC001", amount: 300) {
    __typename
    ... on TransferLimitError { message dailyLimit alreadySent }
    ... on InsufficientFundsError { message available required }
  }
}

# ── PATTERN 3: Partial Success (batch — some fail, some succeed)
mutation Pattern3_Batch {
  batchTransfer(transfers: [
    { fromAccountId: "ACC001", toAccountId: "ACC002", amount: 100 }
    { fromAccountId: "ACC002", toAccountId: "ACC001", amount: 5000 }  # will fail
    { fromAccountId: "ACC003", toAccountId: "ACC001", amount: 200 }
  ]) {
    successCount failureCount
    results {
      index success message
      transaction { id amount }
    }
  }
}
`);
