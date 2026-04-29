# Project 09 — Real-time Subscriptions

**System: Live Chat Room**
**Difficulty: Advanced**

---

## What This Project Teaches

GraphQL subscriptions are how you push real-time data to clients. This project builds a complete live chat system — the canonical subscription example. After this, you will understand the full subscription lifecycle: publishing events from mutations and receiving them in subscription resolvers.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| Node.js | Runtime |
| graphql-yoga | GraphQL server with built-in WebSocket subscription support |
| graphql | Core library |

> **Why GraphQL Yoga instead of Apollo Server?**  
> Apollo Server 3 removed built-in subscriptions. Setting them up requires manual WebSocket wiring with `graphql-ws`. GraphQL Yoga has them built-in out of the box, making it the simplest choice for learning. Both implement the same GraphQL spec — concepts transfer 1:1.

---

## Concepts Covered

- `type Subscription` — the third root operation type
- `createPubSub` — in-memory publish/subscribe event bus
- `pubsub.publish(EVENT, data)` — publishing events from mutations
- Async generators — how subscription resolvers work internally
- Event filtering — only send events relevant to the subscriber
- Real-time vs polling trade-offs
- Production considerations: Redis PubSub, connection cleanup

---

## Setup & Run

```bash
cd projects/09-subscriptions-realtime
npm install
npm run dev
```

Open **http://localhost:4000/graphql** (GraphQL Yoga playground)

**To test subscriptions**: Open **two browser tabs** at the same URL.

---

## Project Structure

```
09-subscriptions-realtime/
├── index.js        ← Schema + resolvers + PubSub + server
├── package.json
└── README.md
```

---

## Core Concepts Explained

### The Three Root Types

```graphql
type Query        { ... }    # Read (HTTP request-response)
type Mutation     { ... }    # Write (HTTP request-response)
type Subscription { ... }    # Real-time push (WebSocket, persistent)
```

### How Subscriptions Work

```
CLIENT (Tab 1)                           SERVER
────────────────────────────────────────────────────────────
                                         Subscription resolver
                                         opens event stream

  subscription { messageAdded(roomId: "general") { content } }
  ──── WebSocket connection opened ────►
                                         pubsub.subscribe('MESSAGE_ADDED')
                                         → waiting for events...

CLIENT (Tab 2)                           SERVER
  mutation { sendMessage(...) }          pubsub.publish('MESSAGE_ADDED', { ... })
  ─────────────────────────────────────►
                                         event emitted to all subscribers

CLIENT (Tab 1)                           SERVER
  ◄──── { data: { messageAdded: {...} } } ──
  receives the pushed message!
```

### PubSub — The Event Bus

```js
import { createPubSub } from 'graphql-yoga';

const pubsub = createPubSub();

// Publisher (in a Mutation resolver):
pubsub.publish('MESSAGE_ADDED', { messageAdded: newMessage, roomId: 'general' });
//             ^ channel name   ^ event payload

// Subscriber (in a Subscription resolver):
const subscription = pubsub.subscribe('MESSAGE_ADDED');
// subscription is an async iterable — yields events as they are published
```

### Subscription Resolver Structure

```js
const resolvers = {
  Subscription: {
    messageAdded: {
      // subscribe: returns an async iterable / async generator
      subscribe: async function* (_, { roomId }) {
        const sub = pubsub.subscribe('MESSAGE_ADDED');

        for await (const event of sub) {
          // FILTER: only yield events for the requested room
          if (event.roomId === roomId) {
            yield event;
          }
        }
      },

      // resolve: extracts the specific value to send to the client
      resolve: (payload) => payload.messageAdded,
    },
  },
};
```

### In-Memory vs Redis PubSub

```
In-Memory PubSub (this project):
  + Simple, no external dependencies
  + Works great for single-server development
  - Dies when the server restarts
  - Does NOT work with multiple server instances (horizontal scaling)

Redis PubSub (production):
  + Persists across server restarts
  + Works with multiple server instances (a publish on server A reaches
    subscribers connected to server B, via Redis as the message broker)
  + Required for any horizontally scaled deployment
  
  Setup:
  npm install ioredis @graphql-yoga/redis-event-target
```

---

## How to Test

**Open two browser tabs at `http://localhost:4000/graphql`**

**Tab 1 — Subscribe:**
```graphql
subscription {
  messageAdded(roomId: "general") {
    id content sender timestamp
    room { name }
  }
}
```
Press the Run button. The tab now waits for messages.

**Tab 2 — Publish:**
```graphql
mutation {
  sendMessage(
    content: "Hello from GraphQL Subscriptions!"
    sender: "alice"
    roomId: "general"
  ) {
    id content sender
  }
}
```
Watch Tab 1 receive the message instantly.

---

## Interview Questions & Answers — Coding Round

---

### Q1. What are GraphQL subscriptions?

**Answer**:

```
GraphQL subscriptions are the third operation type (alongside Query and Mutation).
They maintain a persistent WebSocket connection between client and server.
The server pushes updates to the client whenever relevant data changes.

Key characteristics:
  - Uses WebSocket (ws:// or wss://) — NOT regular HTTP
  - HTTP is request-response (client asks, server answers, connection closes)
  - WebSocket is persistent bidirectional — server can push anytime
  - Implemented with Pub/Sub pattern:
    Mutations publish events → subscriptions listen and push to clients

When to use subscriptions:
  - Live chat / messaging
  - Real-time notifications (likes, comments, follows)
  - Live sports scores, stock prices
  - Collaborative editing (Google Docs-style)
  - Status updates (order tracking, job progress)

When NOT to use subscriptions:
  - Polling is simpler for infrequent updates (every 30s refresh is fine)
  - SSE (Server-Sent Events) is better for one-way push without full WebSocket
  - If you just need to refresh data after an action, use a query after mutation
```

---

### Q2. What transport protocol do GraphQL subscriptions use?

**Answer**:

```
WebSocket — a full-duplex, persistent communication channel.

Why not regular HTTP?
  HTTP is request-response: client sends request, server responds, connection closes.
  The server CANNOT push data to the client without the client asking first.

WebSocket handshake:
  1. Client sends HTTP Upgrade request:
     GET /graphql HTTP/1.1
     Upgrade: websocket
     Connection: Upgrade
  2. Server responds: 101 Switching Protocols
  3. Connection is now a persistent WebSocket channel

GraphQL WebSocket protocols:
  subscriptions-transport-ws  ← older (Apollo Server 2 era) — DEPRECATED
  graphql-ws                  ← current standard (Apollo Server 4, GraphQL Yoga)

URL scheme:
  http:// → ws://     (development)
  https:// → wss://   (production — WebSocket over TLS)

Important: The path is usually the same as your GraphQL HTTP endpoint.
  Apollo Client automatically handles the WebSocket upgrade for subscriptions.
```

---

### Q3. What is PubSub and how does it work?

**Answer**:

```
PubSub = Publish/Subscribe messaging pattern.

Two roles:
  Publisher: sends messages to a CHANNEL (also called topic)
  Subscriber: listens on a channel and receives messages

In GraphQL:
  Mutations are publishers:
    sendMessage mutation → pubsub.publish('MESSAGE_ADDED', { message, roomId })

  Subscriptions are subscribers:
    messageAdded subscription → pubsub.subscribe('MESSAGE_ADDED')
    → waits for published events → pushes to WebSocket client

Multiple subscribers:
  1000 clients subscribed to 'MESSAGE_ADDED' (1000 open WebSocket connections)
  One pubsub.publish() → all 1000 clients receive the message simultaneously

In-memory vs Redis PubSub:
  In-memory: events only reach subscribers on the SAME SERVER PROCESS
  Redis:     events reach subscribers on ANY server (multi-server scaling)

  Production: always use Redis PubSub for any horizontally scaled deployment.
  A single server with in-memory PubSub is fine for development and small apps.
```

---

### Q4. Implement a subscription for order status updates

**Question**: Write the schema and resolver for subscribing to order status updates. A client should only receive updates for their specific order.

**Answer**:

```graphql
enum OrderStatus {
  PENDING
  CONFIRMED
  PREPARING
  OUT_FOR_DELIVERY
  DELIVERED
  CANCELLED
}

type OrderStatusUpdate {
  orderId:   ID!
  status:    OrderStatus!
  message:   String!
  updatedAt: String!
}

type Subscription {
  orderStatusUpdated(orderId: ID!): OrderStatusUpdate!
}

type Mutation {
  updateOrderStatus(orderId: ID!, status: OrderStatus!, message: String!): Order!
}
```

```js
const pubsub = createPubSub();

const resolvers = {
  Mutation: {
    updateOrderStatus(_, { orderId, status, message }) {
      const order = orders.find(o => o.id === orderId);
      if (!order) throw new UserInputError(`Order "${orderId}" not found`);

      order.status = status;
      const update = { orderId, status, message, updatedAt: new Date().toISOString() };

      // Publish — all subscribers to ORDER_STATUS_UPDATED receive this
      pubsub.publish('ORDER_STATUS_UPDATED', {
        orderStatusUpdated: update,
        orderId,               // used for filtering
      });

      return order;
    },
  },

  Subscription: {
    orderStatusUpdated: {
      subscribe: async function* (_, { orderId }) {
        const sub = pubsub.subscribe('ORDER_STATUS_UPDATED');

        for await (const event of sub) {
          // FILTER: only yield updates for the specific order this client cares about
          if (event.orderId === orderId) {
            yield event;
          }
        }
      },
      resolve: (payload) => payload.orderStatusUpdated,
    },
  },
};
```

---

### Q5. What are the production considerations for subscriptions?

**Answer**:

```
1. Redis PubSub for multi-server scaling:
   In-memory PubSub only works on one process.
   Production apps run multiple instances (load balancing).
   Redis acts as the shared message broker across all instances.

2. Authentication for subscriptions:
   WebSocket doesn't send Authorization headers on each message.
   Authenticate on connection establishment:
     context: ({ connectionParams }) => {
       const token = connectionParams?.Authorization;
       return { user: verifyToken(token) };
     }

3. Connection cleanup:
   Handle subscriber disconnects — release resources, clean up listeners.
   GraphQL Yoga and Apollo handle this automatically for well-behaved clients.

4. Rate limiting:
   A malicious client could open thousands of WebSocket connections.
   Add connection limits per user and rate limit publish events.

5. Scale of events:
   1000 subscribers × 10 events/second = 10,000 pushes/second
   Each push serializes and sends a JSON payload over WebSocket.
   Plan your infrastructure for the expected load.

6. Alternatives to consider:
   Server-Sent Events (SSE): simpler for one-directional push (no WebSocket needed)
   Polling: simpler to implement, fine for low-frequency updates (every 30s)
   Webhooks: for server-to-server notifications (not client-facing)
```

---

### Q6. How do you filter subscription events?

**Answer**:

```js
// Problem: All subscribers to 'MESSAGE_ADDED' receive ALL messages.
//          But each client only wants messages from their specific room.

// Solution: Filter in the async generator

Subscription: {
  messageAdded: {
    subscribe: async function* (_, { roomId }) {
      const sub = pubsub.subscribe('MESSAGE_ADDED');

      // Async generator: yield only events that pass the filter
      for await (const event of sub) {
        if (event.roomId === roomId) {
          yield event;   // only messages for THIS room are sent to this client
        }
        // If roomId doesn't match, the event is silently discarded for this subscriber
        // Other subscribers with matching roomId still receive it
      }
    },
    resolve: (payload) => payload.messageAdded,
  },
},

// The published event must include the filter key:
pubsub.publish('MESSAGE_ADDED', {
  messageAdded: newMessage,
  roomId:       newMessage.roomId,  // ← used in the filter above
});

// Filtering happens PER SUBSCRIBER — each subscriber has its own async generator
// running independently, filtering independently.
```

---

## Key Takeaways

1. Subscriptions use WebSocket — persistent, bidirectional connection.
2. Three root types: Query (read), Mutation (write), Subscription (real-time push).
3. PubSub pattern: mutations publish events, subscriptions subscribe to them.
4. Subscription resolver has two parts: `subscribe` (async generator) and `resolve` (extract value).
5. Filter in the async generator — check if the event's data matches the subscriber's criteria.
6. In-memory PubSub for development. Redis PubSub for production / multi-server.
7. Always include the filter key in the published payload so the subscriber can filter.
