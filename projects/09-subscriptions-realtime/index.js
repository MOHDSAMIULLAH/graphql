/**
 * ============================================================
 * MINI PROJECT 9: Real-time Subscriptions
 * System: Live Chat Room
 * ============================================================
 *
 * CONCEPTS COVERED:
 * ─────────────────
 * 1. SUBSCRIPTION TYPE  → Third operation type alongside Query and Mutation
 * 2. PubSub             → Publish/Subscribe event bus (in-memory for dev)
 * 3. ASYNC GENERATORS   → The mechanism that drives subscriptions
 * 4. FILTERING          → Only receive events relevant to you (by room ID)
 * 5. TRIGGERS           → Mutations publish events, subscriptions listen
 *
 * HOW SUBSCRIPTIONS WORK:
 * ───────────────────────
 *  Client                          Server
 *   │                                │
 *   │── subscribe { messageAdded } ──► (opens WebSocket connection)
 *   │                                │
 *   │  [Another client sends message]│
 *   │                                │── pubsub.publish('MESSAGE_ADDED', {...})
 *   │◄── { data: { messageAdded } } ─│   (pushes to subscriber)
 *   │                                │
 *   │  [repeats for every new event] │
 *
 * HTTP vs WebSocket:
 *  - Query/Mutation: HTTP request-response (one-shot)
 *  - Subscription:  WebSocket (persistent, bidirectional connection)
 *
 * This project uses GraphQL Yoga (graphql-yoga) — it has the simplest
 * built-in subscription support. Apollo Server v4 also supports this
 * via graphql-ws, but requires more setup.
 *
 * GRAPHQL YOGA vs APOLLO SERVER:
 *  - Apollo Server: more features, larger ecosystem
 *  - GraphQL Yoga: simpler, built-in subscriptions, better DX
 *  - Both implement the same GraphQL spec — learn one, transfer to other
 *
 * INTERVIEW Q&A:
 * ──────────────
 * Q: What are GraphQL subscriptions?
 * A: A real-time operation that maintains a WebSocket connection. The server
 *    pushes updates to the client whenever relevant data changes. Uses the
 *    Pub/Sub pattern — mutations publish events, subscriptions listen.
 *
 * Q: What transport does GraphQL use for subscriptions?
 * A: WebSocket (ws:// or wss://). Standard HTTP is request-response and
 *    cannot push. WebSocket provides a persistent bidirectional channel.
 *    The graphql-ws protocol is the current standard (replaced subscriptions-transport-ws).
 *
 * Q: What is PubSub?
 * A: A message broker pattern. Publishers send events to named channels
 *    (topics). Subscribers listen on those channels and receive events.
 *    In-memory PubSub is fine for single-server dev. Production needs
 *    Redis PubSub (for multi-server/horizontal scaling).
 *
 * Q: How do you filter subscription events?
 * A: Use an async generator that filters the event stream, only yielding
 *    events that match the subscriber's criteria (e.g., same room ID).
 *
 * Q: What are the production considerations for subscriptions?
 * A: 1. Use Redis PubSub (not in-memory) for multi-server deployments
 *    2. Handle connection cleanup (unsubscribe on disconnect)
 *    3. Add authentication to subscription context
 *    4. Rate limiting for subscription events
 *    5. Consider alternatives: Server-Sent Events (SSE) for simpler cases
 *
 * RUN: npm install && npm run dev
 * OPEN: http://localhost:4000/graphql (GraphQL Yoga built-in playground)
 *
 * TO TEST:
 *  Open TWO browser tabs at http://localhost:4000/graphql
 *  Tab 1: Run the subscription query
 *  Tab 2: Run the sendMessage mutation
 *  Watch Tab 1 receive messages in real-time!
 */

import { createYoga, createPubSub } from 'graphql-yoga';
import { createServer } from 'node:http';

// ─── PUB/SUB EVENT BUS ────────────────────────────────────────────────────────
// In-memory PubSub — fine for development and single-server apps
// Production: use Redis PubSub → createClient from ioredis + custom PubSub
const pubsub = createPubSub();

// Event channel names — constants prevent typos
const EVENTS = {
  MESSAGE_ADDED:  'MESSAGE_ADDED',
  USER_JOINED:    'USER_JOINED',
  USER_LEFT:      'USER_LEFT',
  USER_TYPING:    'USER_TYPING',
};

// ─── MOCK DATABASE ────────────────────────────────────────────────────────────
const rooms = new Map([
  ['general', { id: 'general', name: 'General',   description: 'Main chat room' }],
  ['tech',    { id: 'tech',    name: 'Technology', description: 'Tech discussions' }],
  ['random',  { id: 'random',  name: 'Random',     description: 'Random topics' }],
]);

const messages = [
  { id: '1', content: 'Welcome to GraphQL chat!', sender: 'system', roomId: 'general', timestamp: '2024-01-01T10:00:00Z' },
  { id: '2', content: 'Hello everyone!',           sender: 'alice',  roomId: 'general', timestamp: '2024-01-01T10:01:00Z' },
  { id: '3', content: 'React vs Vue debate 🔥',    sender: 'bob',    roomId: 'tech',    timestamp: '2024-01-01T10:02:00Z' },
];

const activeUsers = new Map(); // roomId → Set of usernames
let msgCounter = 4;

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const typeDefs = `
  type Message {
    id:        ID!
    content:   String!
    sender:    String!
    roomId:    String!
    room:      Room!
    timestamp: String!
  }

  type Room {
    id:          ID!
    name:        String!
    description: String!
    messages:    [Message!]!
    activeUsers: [String!]!
    messageCount: Int!
  }

  type TypingEvent {
    username: String!
    roomId:   String!
    isTyping: Boolean!
  }

  type UserEvent {
    username: String!
    roomId:   String!
    eventAt:  String!
  }

  type Query {
    rooms:           [Room!]!
    room(id: ID!):   Room
    messages(roomId: ID!): [Message!]!
  }

  type Mutation {
    sendMessage(content: String!, sender: String!, roomId: ID!): Message!
    joinRoom(username: String!, roomId: ID!): Room!
    leaveRoom(username: String!, roomId: ID!): Boolean!
    setTyping(username: String!, roomId: ID!, isTyping: Boolean!): Boolean!
  }

  # ── SUBSCRIPTIONS ────────────────────────────────────────────────────────────
  # Each subscription field takes args to filter relevant events
  type Subscription {
    """Fires when a new message is sent in a specific room"""
    messageAdded(roomId: ID!): Message!

    """Fires when a user joins or leaves"""
    userJoined(roomId: ID!): UserEvent!
    userLeft(roomId: ID!): UserEvent!

    """Fires when a user starts/stops typing (for typing indicators)"""
    userTyping(roomId: ID!): TypingEvent!
  }
`;

// ─── RESOLVERS ────────────────────────────────────────────────────────────────
const resolvers = {
  Query: {
    rooms:    () => [...rooms.values()],
    room:     (_, { id }) => rooms.get(id) ?? null,
    messages: (_, { roomId }) => messages.filter(m => m.roomId === roomId),
  },

  Mutation: {
    sendMessage(_, { content, sender, roomId }) {
      if (!rooms.has(roomId)) throw new Error(`Room "${roomId}" not found`);
      if (!content.trim())    throw new Error('Message cannot be empty');
      if (!sender.trim())     throw new Error('Sender name required');

      const message = {
        id:        String(msgCounter++),
        content:   content.trim(),
        sender:    sender.trim(),
        roomId,
        timestamp: new Date().toISOString(),
      };
      messages.push(message);

      // PUBLISH the event — all subscribers to MESSAGE_ADDED will receive it
      pubsub.publish(EVENTS.MESSAGE_ADDED, { messageAdded: message, roomId });

      return message;
    },

    joinRoom(_, { username, roomId }) {
      const room = rooms.get(roomId);
      if (!room) throw new Error(`Room "${roomId}" not found`);

      if (!activeUsers.has(roomId)) activeUsers.set(roomId, new Set());
      activeUsers.get(roomId).add(username);

      pubsub.publish(EVENTS.USER_JOINED, {
        userJoined: { username, roomId, eventAt: new Date().toISOString() },
        roomId,
      });

      return room;
    },

    leaveRoom(_, { username, roomId }) {
      activeUsers.get(roomId)?.delete(username);

      pubsub.publish(EVENTS.USER_LEFT, {
        userLeft: { username, roomId, eventAt: new Date().toISOString() },
        roomId,
      });

      return true;
    },

    setTyping(_, { username, roomId, isTyping }) {
      pubsub.publish(EVENTS.USER_TYPING, {
        userTyping: { username, roomId, isTyping },
        roomId,
      });
      return true;
    },
  },

  Subscription: {
    // ── messageAdded ────────────────────────────────────────────────────────
    messageAdded: {
      // subscribe returns an async iterator that GraphQL Yoga drives
      // We use an async generator to filter events by roomId
      subscribe: async function* (_, { roomId }) {
        // Subscribe to the event channel
        const sub = pubsub.subscribe(EVENTS.MESSAGE_ADDED);

        for await (const event of sub) {
          // FILTER: only yield events for the requested room
          if (event.roomId === roomId) {
            yield event;  // This sends data to the subscriber
          }
        }
      },
      // resolve extracts the payload value to send to client
      resolve: (payload) => payload.messageAdded,
    },

    userJoined: {
      subscribe: async function* (_, { roomId }) {
        const sub = pubsub.subscribe(EVENTS.USER_JOINED);
        for await (const event of sub) {
          if (event.roomId === roomId) yield event;
        }
      },
      resolve: (payload) => payload.userJoined,
    },

    userLeft: {
      subscribe: async function* (_, { roomId }) {
        const sub = pubsub.subscribe(EVENTS.USER_LEFT);
        for await (const event of sub) {
          if (event.roomId === roomId) yield event;
        }
      },
      resolve: (payload) => payload.userLeft,
    },

    userTyping: {
      subscribe: async function* (_, { roomId }) {
        const sub = pubsub.subscribe(EVENTS.USER_TYPING);
        for await (const event of sub) {
          if (event.roomId === roomId) yield event;
        }
      },
      resolve: (payload) => payload.userTyping,
    },
  },

  Room: {
    messages:    (parent) => messages.filter(m => m.roomId === parent.id),
    activeUsers: (parent) => [...(activeUsers.get(parent.id) ?? new Set())],
    messageCount:(parent) => messages.filter(m => m.roomId === parent.id).length,
  },

  Message: {
    room: (parent) => rooms.get(parent.roomId),
  },
};

// ─── SERVER ───────────────────────────────────────────────────────────────────
// GraphQL Yoga: handles both HTTP (queries/mutations) and WebSocket (subscriptions)
const yoga = createYoga({ typeDefs, resolvers });
const server = createServer(yoga);

server.listen(4000, () => {
  console.log('💬 Live Chat API → http://localhost:4000/graphql\n');
  console.log(`
HOW TO TEST SUBSCRIPTIONS:
───────────────────────────
Open TWO browser tabs at http://localhost:4000/graphql

TAB 1 — Start listening (subscription):
─────────────────────────────────────────
subscription ListenForMessages {
  messageAdded(roomId: "general") {
    id content sender timestamp
    room { name }
  }
}

subscription WatchTyping {
  userTyping(roomId: "general") {
    username isTyping
  }
}

TAB 2 — Send messages (mutation):
───────────────────────────────────
mutation JoinRoom {
  joinRoom(username: "alice", roomId: "general") {
    name activeUsers
  }
}

mutation SendMessage {
  sendMessage(
    content: "Hello from GraphQL Subscriptions!"
    sender: "alice"
    roomId: "general"
  ) {
    id content sender timestamp
  }
}

mutation Typing {
  setTyping(username: "alice", roomId: "general", isTyping: true)
}

Watch Tab 1 receive events in real-time!

OTHER QUERIES:
───────────────
query GetRooms {
  rooms {
    id name description messageCount
    messages { content sender }
  }
}
`);
});
