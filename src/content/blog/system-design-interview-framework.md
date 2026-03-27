---
title: "How I Approach System Design Interviews: A Framework That Actually Works"
description: "The framework I use to tackle system design interviews, demonstrated through designing a URL shortener from requirements to scaling strategies."
pubDate: 2025-12-06
tags: ["system-design", "interviews", "architecture", "scaling", "backend"]
draft: false
---

System design interviews are challenging. Unlike coding interviews where you write actual code, you're expected to architect entire systems while explaining your thinking out loud. The questions are deliberately open-ended, which makes it hard to know where to start.

This framework helped me navigate these interviews systematically. I'll demonstrate it by designing a URL shortener (like bit.ly), walking through each step with concrete examples you can apply to any system design problem.

## Why URL Shortener as an Example?

I picked URL shorteners because they're deceptively simple. Everyone has used short links, but building one involves interesting technical challenges around distributed systems, caching, and database design. Interviewers frequently use this problem because it covers core concepts without being overwhelming.

## The Framework: RUDE-CAT

The name is easy to remember. Here's what it stands for:

1. **R**equirements - What are we building?
2. **U**sage Estimates - Expected traffic and scale
3. **D**ata Model & API Design - Interface design
4. **E**ntity Relationships & Storage - Data storage strategy
5. **C**omponent Design - System architecture
6. **A**dvanced Topics - Performance and reliability
7. **T**rade-offs & Bottlenecks - What can fail

---

## Step 1: Requirements (~15% of interview time)

**Never jump straight into designing.** I've made this mistake before. Always start by clarifying requirements—it prevents you from solving the wrong problem.

### Functional Requirements

For a URL shortener, I clarify these features:

1. URL shortening: users provide a long URL and receive a short code
2. Redirect: short URLs redirect to the original long URL
3. Custom aliases: can users choose their own short codes?
4. Analytics: do we track click counts, locations, referrers?
5. Expiration: should links have a TTL?

Start with core features (1-2), then discuss optional ones based on remaining time.

### Non-Functional Requirements

For a URL shortener, I prioritize:
- **High availability** (99.9% uptime) - dead links damage user trust
- **Low latency** (under 100ms for redirects) - users expect instant redirects
- **Scalability** - must handle millions of URLs and billions of clicks
- **Durability** - links shouldn't disappear once created

For this system, availability and speed matter more than perfect consistency. Analytics can tolerate slight delays, but slow or failed redirects are unacceptable.

---

## Step 2: Usage Estimates (~10% of interview time)

Time for capacity planning. Rough estimates are fine—interviewers care about your approach, not precise arithmetic.

### Scale Assumptions

Starting assumptions:
- 100 million new URLs created per month
- 100:1 read-to-write ratio (way more redirects than new URLs)
- URLs are stored forever (we can discuss deletion later)

**Quick calculations:**

```
New URLs (writes):
- 100M URLs/month
- That's roughly 40 URLs/second
- At peak: maybe 120 URLs/second (I usually assume 3x)

Redirects (reads):
- 100:1 ratio means 10 billion redirects/month
- That's about 4,000 redirects/second
- Peak: around 12,000 redirects/second
```

### How Much Storage Do We Need?

```
Each URL entry needs:
- Short code: 7 bytes
- Original URL: ~500 bytes (being generous)
- Metadata: ~100 bytes (timestamps, user info, etc.)
- Total: roughly 600 bytes per URL

Storage over time:
- Year 1: 100M × 12 months × 600 bytes = 720 GB
- Year 5: about 3.6 TB
- With 3x replication: ~11 TB total

Cache size (80/20 rule - 20% of URLs drive 80% of traffic):
- Cache top 20%: ~200 GB per year
```

Round liberally and use powers of 10. The goal is demonstrating that you think about scale systematically.

---

## Step 3: Data Model & API Design (~15% of interview time)

I keep the API design simple and RESTful.

### API Design

```
1. Create Short URL
POST /api/v1/urls
{
  "long_url": "https://example.com/very/long/path",
  "custom_alias": "my-link",  // optional
  "expiry_date": "2026-12-31" // optional
}

Response:
{
  "short_url": "https://short.ly/abc123",
  "long_url": "https://example.com/very/long/path",
  "created_at": "2026-01-06T10:00:00Z"
}

2. Redirect
GET /:shortCode
→ Returns 302 redirect to long URL

3. Analytics
GET /api/v1/urls/:shortCode/stats
{
  "short_url": "https://short.ly/abc123",
  "total_clicks": 1523,
  "clicks_by_date": [...],
  "top_locations": [...]
}

4. Delete URL
DELETE /api/v1/urls/:shortCode
```

### Database Schema

```sql
-- URL mappings
CREATE TABLE urls (
  id BIGSERIAL PRIMARY KEY,
  short_code VARCHAR(10) UNIQUE NOT NULL,
  long_url TEXT NOT NULL,
  user_id BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,

  INDEX idx_short_code (short_code),
  INDEX idx_user_id (user_id)
);

-- Analytics tracking
CREATE TABLE clicks (
  id BIGSERIAL PRIMARY KEY,
  short_code VARCHAR(10) NOT NULL,
  clicked_at TIMESTAMP DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent TEXT,
  referrer TEXT,
  country VARCHAR(2),

  INDEX idx_short_code (short_code),
  INDEX idx_clicked_at (clicked_at)
);
```

Design rationale:
- `short_code` VARCHAR(10) provides 62^10 possible combinations
- Separate `clicks` table prevents analytics writes from blocking redirects
- Index on `short_code` enables fast lookups

---

## Step 4: Database Selection (~10% of interview time)

### Choosing the Database

**Start with PostgreSQL:**
- ACID guarantees prevent data loss
- Excellent indexing for fast lookups
- Supports joins for analytics queries
- Proven reliability at scale

**Consider NoSQL at 10K+ writes/second:**
- Cassandra or DynamoDB
- Better horizontal scaling
- Eventually consistent model works for this use case
- Optimized for key-value lookups

Start simple with Postgres. Migration to NoSQL is straightforward if needed later.

### Sharding Strategy

When a single database reaches capacity:

```
Option 1: Hash-based sharding
- shard_id = hash(short_code) % num_shards
- ✅ Even distribution
- ❌ Resharding is complex

Option 2: Range-based sharding
- Shard by creation date
- ✅ Easy to add shards
- ❌ Write hotspots on newest shard

Option 3: Geographic sharding
- Shard by user location
- ✅ Data locality
- ❌ Uneven distribution
```

Hash-based sharding on `short_code` provides the most even distribution.

---

## Step 5: Component Design (~30% of interview time)

This is where you design the architecture and explain how components interact.

### High-Level Architecture

```
                    Users
                      |
                      ↓
            ┌─────────────────┐
            │  Load Balancer  │
            │  (CloudFlare)   │
            └────────┬────────┘
                     |
        ┌────────────┼────────────┐
        ↓            ↓            ↓
    ┌────────┐  ┌────────┐  ┌────────┐
    │  Web   │  │  Web   │  │  Web   │
    │ Server │  │ Server │  │ Server │
    └───┬────┘  └───┬────┘  └───┬────┘
        └───────────┼───────────┘
                    ↓
            ┌───────────────┐
            │  App Servers  │
            │  (API Layer)  │
            └───────┬───────┘
                    |
        ┌───────────┼───────────┐
        ↓           ↓           ↓
    ┌────────┐  ┌─────────┐  ┌──────────┐
    │ Redis  │  │Postgres │  │ Analytics│
    │ Cache  │  │   DB    │  │  Queue   │
    └────────┘  └─────────┘  └──────────┘
```

### Component Responsibilities

**Load Balancer:**
- Distributes traffic across web servers
- Health checking
- SSL termination
- DDoS protection

**Web Servers (stateless):**
- Handle HTTP requests
- Route to API endpoints
- Serve static content

**App Servers:**
- Generate short codes
- Validate URLs
- Database operations
- Business logic

**Redis Cache:**
- Cache frequently accessed URLs
- 24-hour TTL
- Reduces database load by 80%+

**PostgreSQL:**
- Persistent storage
- Master handles writes
- Read replicas for queries

**Analytics Queue:**
- Asynchronous click processing
- Batch writes to analytics database
- Prevents blocking redirects

---

## Step 6: Advanced Topics (~15% of interview time)

Deep dive into critical implementation details.

### Short Code Generation

Three approaches to consider:

**Approach 1: Hashing**
```python
def generate_short_code(long_url):
    # Hash the URL
    hash_value = md5(long_url).hexdigest()

    # Take first 7 characters, convert to base62
    short_code = base62_encode(hash_value[:7])

    # Handle collisions if needed
    if exists_in_db(short_code):
        short_code = handle_collision(short_code)

    return short_code
```
✅ Same URL always gets same short code
❌ Requires collision handling

**Approach 2: Counter-based**
```python
def generate_short_code():
    # Get next counter from distributed service
    counter = get_next_counter()

    # Convert to base62
    short_code = base62_encode(counter)

    return short_code
```
✅ No collisions
❌ Predictable sequence

**Approach 3: Random**
```python
def generate_short_code():
    while True:
        short_code = random_base62(7)

        if not exists_in_db(short_code):
            return short_code
```
✅ Unpredictable and simple
❌ Multiple database checks possible

Counter-based generation with ZooKeeper or Redis for distributed counter management provides the best balance.

### Caching Strategy

Implementation:

```
When a redirect request comes in:

1. Check Redis first (key: short_code, value: long_url)
2. Cache HIT?
   - Return the URL immediately
   - Log analytics asynchronously
3. Cache MISS?
   - Query the database
   - Store in Redis with 24-hour TTL
   - Return the URL

Eviction: LRU (kick out least recently used)
Size: ~200 GB (stores about 300M URLs)
Expected hit rate: ~85%
```

This reduces database load significantly—most requests never touch the database.

### Analytics Processing

Asynchronous analytics to avoid blocking redirects:

```
Flow:

1. User visits short URL
2. Immediately redirect
3. Fire event to message queue (Kafka/RabbitMQ)
4. Worker processes batch events
5. Batch insert to analytics DB

Benefits:
- Redirect latency: <50ms
- Event aggregation before writes
- Replay capability if analytics DB fails
```

### Rate Limiting

Using Redis with token bucket algorithm:

```
if redis.get(ip + ':minute') > 100:
    return 429 Too Many Requests
else:
    redis.incr(ip + ':minute')
    redis.expire(ip + ':minute', 60)
```

---

## Step 7: Trade-offs & Bottlenecks (~5% of interview time)

Discuss potential failure modes and design trade-offs.

### Potential Bottlenecks

1. **Database writes at massive scale**
   → Shard database or migrate to NoSQL

2. **Counter service single point of failure**
   → Pre-allocate counter ranges to each server

3. **Hot URLs overwhelming cache**
   → Add CDN layer with multiple cache replicas

4. **High latency for global users**
   → Multi-region deployment with geo-routing

### Design Trade-offs

| Decision | Trade-off |
|----------|-----------|
| Eventually consistent analytics | Fast redirects vs. real-time accuracy |
| 7-character short codes | 3.5 trillion URLs vs. shorter codes |
| PostgreSQL over NoSQL | Simplicity vs. extreme write throughput |
| Cache-aside pattern | Some cache misses vs. complexity |

---

## Common Mistakes to Avoid

1. **Jumping to solutions** without clarifying requirements
2. **Over-engineering** for unnecessary scale
3. **Ignoring failure modes** and recovery strategies
4. **Skipping capacity estimates**
5. **Not explaining trade-offs** behind decisions
6. **Drawing boxes** without explaining their purpose

---

## Time Management

For a 45-minute interview:

- **0-7 min:** Requirements & clarifications
- **7-12 min:** Capacity estimates
- **12-20 min:** API design & data model
- **20-35 min:** Architecture & components
- **35-40 min:** Deep dive (caching, encoding, scaling)
- **40-45 min:** Trade-offs & Q&A

Reserve time for interviewer questions at the end.

---

## Applying RUDE-CAT to Other Problems

The framework adapts to any system design problem:

- **Instagram:** Image storage, feed generation, content delivery
- **Netflix:** Video encoding, CDN strategy, recommendation systems
- **Uber:** Geo-spatial indexing, driver matching, real-time updates
- **WhatsApp:** WebSocket connections, message queues, end-to-end encryption

The steps remain constant. Only the implementation details change.

---

## Final Thoughts

System design interviews don't have perfect answers. Interviewers evaluate your thinking process, how you handle trade-offs, and your ability to communicate complex technical concepts clearly.

This framework helps me stay organized under pressure. It provides structure when the problem feels overwhelming.

Practice this framework on various problems. Draw diagrams. Explain your reasoning out loud. Time yourself. With repetition, the process becomes natural.

Reach out on [LinkedIn](https://www.linkedin.com/in/rajat-tcp/) or [GitHub](https://github.com/rajat-np) if you want to discuss system design or interview preparation.

---

## Resources

**Books:**
- "Designing Data-Intensive Applications" by Martin Kleppmann
- "System Design Interview" by Alex Xu

**Online Resources:**
- [System Design Primer on GitHub](https://github.com/donnemartin/system-design-primer)
- [Grokking the System Design Interview](https://www.educative.io/courses/grokking-the-system-design-interview)

**Practice Platforms:**
- [LeetCode System Design](https://leetcode.com/discuss/interview-question/system-design)
- [Pramp](https://www.pramp.com/) - Mock interviews with peers
