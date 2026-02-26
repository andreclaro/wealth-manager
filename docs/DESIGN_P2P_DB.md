# P2P Local-First Database Design Spec

## Overview

This document outlines the architecture for migrating Wealth Manager from a server-centric SQLite database to a **local-first, peer-to-peer (P2P) data layer** using [Pears](https://docs.pears.com) by Holepunch. The design enables:

- **True data ownership** - User data lives on their devices, not on servers
- **Offline-first operation** - Full functionality without internet connectivity
- **Cross-device sync** - Seamless data synchronization between user's devices via P2P
- **Zero infrastructure** - No backend servers required for data storage/sync
- **Future mobile app readiness** - Same data layer works on desktop & mobile

---

## Current Architecture (Baseline)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│   API Routes    │────▶│  SQLite (Prisma)│
│  (Client/Server)│     │   (Server)      │     │   (Server)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌─────────────────┐
                        │ External APIs   │
                        │ (Finnhub, etc.) │
                        └─────────────────┘
```

**Limitations:**
- Data locked to server/host device
- No native sync between devices
- Requires internet for most operations
- Server maintenance required

---

## Target P2P Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER'S DEVICES                               │
│                                                                      │
│  ┌─────────────────────┐        ┌─────────────────────┐             │
│  │   Desktop (Pear)    │◄──────►│   Mobile (Pear)     │             │
│  │  ┌───────────────┐  │  P2P   │  ┌───────────────┐  │             │
│  │  │  Next.js App  │  │  Sync  │  │  React Native │  │             │
│  │  │  (Electron)   │  │        │  │    / Bare     │  │             │
│  │  └───────┬───────┘  │        │  └───────┬───────┘  │             │
│  │          ▼          │        │          ▼          │             │
│  │  ┌───────────────┐  │        │  ┌───────────────┐  │             │
│  │  │  Corestore    │  │        │  │  Corestore    │  │             │
│  │  │  (Encrypted)  │◄─┼────────┼─►│  (Encrypted)  │  │             │
│  │  └───────┬───────┘  │        │  └───────┬───────┘  │             │
│  │          ▼          │        │          ▼          │             │
│  │  ┌───────────────┐  │        │  ┌───────────────┐  │             │
│  │  │  Hyperbee DB  │  │        │  │  Hyperbee DB  │  │             │
│  │  │  (User Data)  │  │        │  │  (User Data)  │  │             │
│  │  └───────────────┘  │        │  └───────────────┘  │             │
│  └─────────────────────┘        └─────────────────────┘             │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     Hyperswarm Network                       │   │
│  │         (Device Discovery & Encrypted P2P Connections)       │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌─────────────────────┐
                  │   Price Services    │
                  │  (Optional APIs)    │
                  │  Finnhub, CoinGecko │
                  └─────────────────────┘
```

---

## Core P2P Building Blocks

### 1. Hypercore - Append-Only Logs

**Purpose:** Immutable audit trail for all data changes

```javascript
// Each data type gets its own hypercore
const assetLog = store.get({ name: 'assets' })
const priceHistoryLog = store.get({ name: 'price-history' })
const accountLog = store.get({ name: 'accounts' })
```

**Benefits:**
- Complete history of every change (who, what, when)
- Tamper-evident data integrity
- Efficient sync (only send missing entries)
- Supports point-in-time recovery

### 2. Hyperbee - Key-Value Store

**Purpose:** Primary structured data storage (replaces SQLite tables)

```javascript
// Hyperbee built on top of hypercore
const db = new Hyperbee(core, {
  keyEncoding: 'utf-8',
  valueEncoding: 'json'
})

// Schema mapping from current SQLite tables
await db.put('asset:{id}', assetData)
await db.put('account:{id}', accountData)
await db.put('user:{id}', userData)
```

**Benefits:**
- Query by key (fast lookups)
- Range queries (e.g., all assets for a user)
- Automatic replication via hypercore
- Works offline completely

### 3. Corestore - Hypercore Management

**Purpose:** Manage multiple hypercores with shared encryption

```javascript
const store = new Corestore('./data', {
  primaryKey: deriveKeyFromUserCredentials()
})

// All cores encrypted with same primary key
const assetCore = store.get({ name: 'assets' })
const accountCore = store.get({ name: 'accounts' })
```

### 4. Hyperswarm - P2P Networking

**Purpose:** Device discovery and secure peer connections

```javascript
const swarm = new Hyperswarm()
const topic = crypto.hash('wealth-manager:' + userId)

// Join swarm - discover other devices for this user
swarm.join(topic, { server: true, client: true })

// When a peer connects, replicate all cores
swarm.on('connection', (conn, info) => {
  store.replicate(conn)
})
```

---

## Data Schema Migration

### Current SQLite Schema → Hyperbee Key Structure

| SQLite Table | Hyperbee Key Pattern | Value |
|--------------|---------------------|-------|
| `User` | `user:{id}` | User record |
| `PortfolioAccount` | `account:{id}` | Account record |
| `Asset` | `asset:{id}` | Asset record |
| `PriceHistory` | `history:{assetId}:{timestamp}` | Price snapshot |
| `ExchangeRate` | `rate:{from}:{to}:{date}` | Rate record |
| `AppConfig` | `config:{key}` | Config value |

### Index Keys for Efficient Queries

```javascript
// User's accounts (for quick lookup)
`user-accounts:{userId}:{accountId}` → null

// Account's assets (for quick lookup)
`account-assets:{accountId}:{assetId}` → null

// Asset type index
`asset-by-type:{userId}:{type}:{assetId}` → null

// Chronological price history
`asset-history:{assetId}:{timestamp}` → priceData
```

---

## Sync Architecture

### Conflict-Free Replicated Data Type (CRDT) Approach

For user data that may change on multiple devices simultaneously, we use **Last-Write-Wins (LWW)** with vector clocks:

```typescript
interface SyncRecord<T> {
  data: T
  metadata: {
    version: number        // Monotonic counter
    timestamp: number      // Logical clock
    deviceId: string       // Originating device
    vectorClock: {        // For causality tracking
      [deviceId: string]: number
    }
  }
}
```

### Sync Flow

```
Device A                        Device B
   │                               │
   ├── 1. Edit Asset ─────────────►│
   │   (Update local Hyperbee)     │
   │                               │
   │◄──────── 2. P2P Connection ───┤
   │   (Hyperswarm discovery)      │
   │                               │
   ├── 3. Replicate Hypercores ───►│
   │   (Bidirectional sync)        │
   │                               │
   │◄──────── 4. Resolve Conflicts─┤
   │   (LWW + vector clocks)       │
   │                               │
   ├── 5. Confirm Sync ───────────►│
   │   (Acknowledge receipt)       │
```

### Offline Queue

When devices are offline, changes are queued locally:

```typescript
interface PendingChange {
  id: string
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
  entity: 'Asset' | 'Account' | '...'
  entityId: string
  data: unknown
  timestamp: number
  retries: number
}

// Stored in Hyperbee: `pending:{timestamp}:{id}`
// Processed when connection restored
```

---

## Security Model

### Encryption Layers

```
┌─────────────────────────────────────────┐
│  Layer 1: Hypercore Encryption          │
│  - All data encrypted at rest           │
│  - Keys derived from user credentials   │
├─────────────────────────────────────────┤
│  Layer 2: Transport Encryption          │
│  - Noise protocol (Hyperswarm)          │
│  - End-to-end encrypted P2P connections │
├─────────────────────────────────────────┤
│  Layer 3: Application Encryption        │
│  - Sensitive fields (purchase price)    │
│  - Additional AES-256-GCM layer         │
└─────────────────────────────────────────┘
```

### Key Derivation

```javascript
// Derive encryption key from user's master password
async function derivePrimaryKey(password: string, salt: Uint8Array): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, key) => {
      if (err) reject(err)
      else resolve(key)
    })
  })
}

// Primary key used for Corestore encryption
const store = new Corestore('./data', { primaryKey })
```

### Device Authorization

New devices must be explicitly authorized by an existing device:

```typescript
interface DeviceAuthorization {
  deviceId: string          // Unique device identifier
  deviceName: string        // User-friendly name
  authorizedAt: number      // Authorization timestamp
  authorizedBy: string      // Authorizing device ID
  publicKey: Uint8Array     // For encrypted communication
}

// Stored at: `authorized-device:{deviceId}`
```

---

## Migration Strategy

### Phase 1: Hybrid Mode (Backward Compatible)

```
┌─────────────────────────────────────────────────────────┐
│                    Hybrid Architecture                  │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐                  │
│  │   Next.js    │    │   P2P Sync   │                  │
│  │   SQLite     │◄──►│   Engine     │                  │
│  │   (Current)  │    │  (New Layer) │                  │
│  └──────────────┘    └──────────────┘                  │
│                           │                             │
│                           ▼                             │
│                     ┌──────────────┐                    │
│                     │   Hyperbee   │                    │
│                     │  (Shadow DB) │                    │
│                     └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

- SQLite remains primary during transition
- Changes mirrored to Hyperbee in real-time
- P2P sync runs in background (opt-in)

### Phase 2: Full P2P Mode

- Hyperbee becomes primary data store
- SQLite optionally for local caching only
- Full offline functionality

### Phase 3: Multi-Device

- Mobile app using same Corestore/Hyperbee
- Seamless cross-device sync
- QR-code based device pairing

---

## Implementation Roadmap

### Milestone 1: Foundation (Weeks 1-2)
- [ ] Set up Pear runtime integration
- [ ] Create Corestore wrapper with encryption
- [ ] Implement Hyperbee schema layer
- [ ] Build data migration utilities

### Milestone 2: Sync Engine (Weeks 3-4)
- [ ] Implement Hyperswarm networking
- [ ] Build replication manager
- [ ] Create conflict resolution logic
- [ ] Add offline queue system

### Milestone 3: Hybrid Mode (Weeks 5-6)
- [ ] SQLite ↔ Hyperbee bidirectional sync
- [ ] Background P2P sync worker
- [ ] Device pairing UI flow
- [ ] Authorization mechanism

### Milestone 4: Full P2P (Weeks 7-8)
- [ ] Make Hyperbee primary store
- [ ] Remove SQLite dependency (optional)
- [ ] Performance optimizations
- [ ] Security audit

### Milestone 5: Mobile Prep (Weeks 9-10)
- [ ] React Native/Bare integration
- [ ] Mobile-specific optimizations
- [ ] Cross-platform sync testing
- [ ] App store preparation

---

## Code Structure

```
lib/p2p/
├── core/
│   ├── store.ts           # Corestore initialization & encryption
│   ├── database.ts        # Hyperbee wrapper with schema
│   └── crypto.ts          # Key derivation & encryption utilities
├── sync/
│   ├── swarm.ts           # Hyperswarm network management
│   ├── replicator.ts      # Core replication logic
│   ├── conflict.ts        # Conflict resolution strategies
│   └── queue.ts           # Offline change queue
├── entities/
│   ├── user.ts            # User CRUD operations
│   ├── account.ts         # Account CRUD operations
│   ├── asset.ts           # Asset CRUD operations
│   └── history.ts         # Price history operations
├── migration/
│   ├── sqlite-to-p2p.ts   # Data migration utilities
│   └── hybrid-sync.ts     # Bidirectional sync layer
└── types.ts               # TypeScript interfaces
```

---

## API Compatibility Layer

To minimize changes to the UI layer, create API-compatible wrappers:

```typescript
// lib/p2p/api-compat/assets.ts
// Maintains same interface as current API routes

export async function getAssets(): Promise<AssetWithValue[]> {
  // Instead of: prisma.asset.findMany()
  // Use: hyperbee query with indexes
  return db.query('asset-by-user', { userId })
}

export async function createAsset(data: CreateAssetInput): Promise<Asset> {
  // Instead of: prisma.asset.create()
  // Use: hyperbee put + replicate
  const asset = await db.put(`asset:${id}`, record)
  await sync.queueChange({ operation: 'CREATE', entity: 'Asset', data: asset })
  return asset
}
```

---

## Trade-offs & Considerations

### Advantages

| Aspect | Benefit |
|--------|---------|
| **Privacy** | Data never leaves user's devices |
| **Resilience** | Works offline, no server downtime |
| **Cost** | Zero infrastructure costs |
| **Speed** | Local reads are instant |
| **Ownership** | User truly owns their data |
| **Scalability** | No backend scaling needed |

### Challenges

| Challenge | Mitigation |
|-----------|------------|
| **Initial sync time** | Delta sync, compression |
| **Storage growth** | Pruning, compaction |
| **Key management** | Secure enclaves, recovery codes |
| **Device loss** | Encrypted backups to user's cloud |
| **Conflict complexity** | Simple LWW for most, manual for edge cases |
| **Search performance** | Local indexes, not suitable for complex queries |

---

## Backup & Recovery

### Encrypted Cloud Backup (Optional)

```typescript
// User can opt-in to encrypted backup
interface EncryptedBackup {
  version: number
  encryptedData: Uint8Array       // AES-256-GCM encrypted
  salt: Uint8Array
  iv: Uint8Array
  createdAt: number
  deviceId: string
}

// Store in user's Dropbox/Google Drive/iCloud
// Restore on new device using master password
```

### Recovery Flow

1. User installs app on new device
2. Enters master password
3. App downloads encrypted backup from cloud
4. Decrypts and populates Corestore
5. Syncs with other devices via P2P

---

## Testing Strategy

```
tests/p2p/
├── unit/
│   ├── crypto.test.ts         # Encryption/decryption
│   ├── conflict.test.ts       # Conflict resolution
│   └── schema.test.ts         # Data validation
├── integration/
│   ├── sync.test.ts           # Two-device sync scenarios
│   ├── offline.test.ts        # Offline/online transitions
│   └── migration.test.ts      # SQLite → P2P migration
└── e2e/
    └── multi-device.test.ts   # Full user workflows
```

---

## Future Enhancements

1. **Selective Sync** - Choose which accounts/assets sync to mobile
2. **Collaborative Portfolios** - Share view-only access with family/advisor
3. **Federation** - Multiple users can form trusted groups
4. **IPFS Backup** - Optional decentralized backup layer
5. **Local AI** - On-device portfolio analysis (keeps data private)

---

## Conclusion

This P2P architecture transforms Wealth Manager from a traditional web app into a **sovereign personal finance tool**. Users maintain complete control over their financial data while gaining the convenience of multi-device access through direct device-to-device synchronization.

The phased migration approach minimizes risk while allowing iterative development and user feedback incorporation.

---

## References

- [Pears Documentation](https://docs.pears.com)
- [Hypercore Spec](https://docs.pears.com/building-blocks/hypercore)
- [Hyperbee Spec](https://docs.pears.com/building-blocks/hyperbee)
- [Hyperswarm Guide](https://docs.pears.com/how-to/connect-to-many-peers-by-topic-with-hyperswarm)
- [Holepunch GitHub](https://github.com/holepunchto)
