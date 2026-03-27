---
title: "Building a URL Shortener That Scales"
description: "Designing and implementing a production-ready URL shortener with custom domains, analytics, and high availability."
pubDate: 2026-01-07
tags: ["system-design", "url-shortener", "distributed-systems", "backend", "architecture"]
draft: true
---

URL shorteners like bit.ly and TinyURL handle billions of redirects per month. Behind their simple interface lies interesting engineering challenges around generating unique IDs, handling massive read traffic, and tracking analytics without impacting performance.

I've built URL shortening services for two different companies. This post covers the architecture decisions, implementation details, and production lessons I've learned.

## Core Requirements

### Functional

- **URL shortening**: Convert long URLs to short codes
- **URL redirection**: Redirect short codes to original URLs
- **Custom aliases**: Allow users to choose their own short codes
- **Analytics**: Track clicks, locations, devices, referrers
- **Expiration**: Support TTL for temporary links
- **User management**: Associate URLs with user accounts

### Non-Functional

- **High availability**: 99.99% uptime (52 minutes downtime per year)
- **Low latency**: <100ms redirect time globally
- **High throughput**: Handle 10,000+ redirects per second
- **Scalability**: Support billions of URLs
- **Durability**: Zero data loss

## Capacity Planning

### Traffic Estimation

Starting assumptions:
- 100 million URLs created per month
- 100:1 read-to-write ratio
- Average URL lifetime: 5 years

**Calculations:**

```
Writes:
- 100M URLs/month = 40 URLs/second
- Peak (3x average): 120 URLs/second

Reads:
- 100:1 ratio = 10B redirects/month
- 4,000 redirects/second average
- Peak: 12,000 redirects/second
```

### Storage Requirements

```
Per URL:
- Short code: 7 bytes
- Original URL: 500 bytes (average)
- Metadata: 100 bytes
- Total: ~600 bytes

Storage over 5 years:
- 100M × 12 × 5 = 6 billion URLs
- 6B × 600 bytes = 3.6 TB
- With 3x replication: ~11 TB

Cache:
- Cache top 20% hot URLs
- ~1.5 TB compressed
```

## Generating Short Codes

This is the most interesting part. We need short codes that are:
- Unique (no collisions)
- Short (6-7 characters)
- Unpredictable (for security)
- Fast to generate

### Base62 Encoding

Use 62 characters: [a-z, A-Z, 0-9]

```python
BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

def base62_encode(num):
    if num == 0:
        return BASE62[0]

    result = []
    while num > 0:
        remainder = num % 62
        result.append(BASE62[remainder])
        num = num // 62

    return ''.join(reversed(result))

def base62_decode(string):
    num = 0
    for char in string:
        num = num * 62 + BASE62.index(char)
    return num
```

With 7 characters: 62^7 = 3.5 trillion possible codes

### Approach 1: Hash-Based Generation

```python
import hashlib

def generate_short_code_hash(long_url):
    """
    Generate short code by hashing URL
    """
    # Create hash
    hash_value = hashlib.md5(long_url.encode()).hexdigest()

    # Take first 7 characters
    short_code = base62_encode(int(hash_value[:8], 16))[:7]

    # Handle collisions
    attempt = 0
    while exists_in_database(short_code):
        # Append attempt counter and rehash
        new_input = f"{long_url}_{attempt}"
        hash_value = hashlib.md5(new_input.encode()).hexdigest()
        short_code = base62_encode(int(hash_value[:8], 16))[:7]
        attempt += 1

    return short_code
```

**Pros:**
- Same URL always gets same short code (deduplication)
- No coordination between servers needed

**Cons:**
- Collision handling adds complexity
- Extra database checks slow down writes

### Approach 2: Counter-Based Generation

```python
class CounterService:
    """
    Distributed counter using Redis
    """
    def __init__(self, redis_client):
        self.redis = redis_client
        self.counter_key = "url_counter"

    def get_next_id(self):
        # Atomically increment and get counter
        counter = self.redis.incr(self.counter_key)
        return counter

def generate_short_code_counter():
    counter = counter_service.get_next_id()
    short_code = base62_encode(counter)

    # Pad to 7 characters
    return short_code.rjust(7, '0')
```

**Pros:**
- Zero collisions
- Fast generation
- Simple implementation

**Cons:**
- Sequential codes (predictable)
- Single point of failure (Redis)

**Solution for SPOF**: Pre-allocate ranges to each server

```python
class RangeAllocator:
    def __init__(self, redis_client, range_size=10000):
        self.redis = redis_client
        self.range_size = range_size
        self.current = None
        self.max = None

    def get_next_id(self):
        if self.current is None or self.current >= self.max:
            self._allocate_range()

        self.current += 1
        return self.current

    def _allocate_range(self):
        # Atomically allocate a range
        start = self.redis.incrby("range_counter", self.range_size)
        self.current = start - self.range_size
        self.max = start
```

Each server pre-allocates 10,000 IDs. If server crashes, we lose at most 10,000 IDs (acceptable).

### Approach 3: UUID-Based Generation

```python
import uuid

def generate_short_code_uuid():
    """
    Generate short code from UUID
    """
    # Generate UUID
    unique_id = uuid.uuid4()

    # Convert to integer and encode
    num = unique_id.int
    short_code = base62_encode(num)[:7]

    # Check for collision (extremely rare with UUIDs)
    if exists_in_database(short_code):
        return generate_short_code_uuid()  # Regenerate

    return short_code
```

**Pros:**
- No coordination needed
- Unpredictable codes

**Cons:**
- Still need collision checks (rare but possible)
- Slightly slower than counter

### My Recommendation

For production, I use **counter-based with range allocation**:
1. Fast and collision-free
2. Can add randomization to counter for unpredictability
3. Range allocation solves single point of failure

```python
def generate_short_code():
    counter = range_allocator.get_next_id()

    # Add randomization
    randomized = (counter << 8) | random.randint(0, 255)

    return base62_encode(randomized)[:7]
```

## Database Design

### Schema

```sql
-- URLs table
CREATE TABLE urls (
    id BIGSERIAL PRIMARY KEY,
    short_code VARCHAR(10) UNIQUE NOT NULL,
    long_url TEXT NOT NULL,
    user_id BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    click_count BIGINT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,

    INDEX idx_short_code (short_code),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

-- Analytics table
CREATE TABLE clicks (
    id BIGSERIAL PRIMARY KEY,
    short_code VARCHAR(10) NOT NULL,
    clicked_at TIMESTAMP DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT,
    referrer TEXT,
    country_code VARCHAR(2),
    city VARCHAR(100),
    device_type VARCHAR(20),

    INDEX idx_short_code (short_code),
    INDEX idx_clicked_at (clicked_at)
);

-- Users table
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    api_key VARCHAR(64) UNIQUE,
    tier VARCHAR(20) DEFAULT 'free',
    created_at TIMESTAMP DEFAULT NOW(),

    INDEX idx_email (email),
    INDEX idx_api_key (api_key)
);
```

### Database Choice

**PostgreSQL for URLs table:**
- ACID guarantees
- Excellent indexing
- Can handle 10K+ writes/second on good hardware
- Easy to shard when needed

**Time-series database for analytics:**
- ClickHouse or TimescaleDB
- Optimized for append-only workloads
- Better compression for historical data
- Fast aggregation queries

### Sharding Strategy

When a single database can't handle the load:

```python
def get_shard(short_code):
    """
    Hash-based sharding
    """
    shard_count = 16
    shard_id = hash(short_code) % shard_count
    return f"shard_{shard_id}"
```

This distributes URLs evenly across shards.

## System Architecture

```
                        Users
                          |
                          ▼
                   ┌─────────────┐
                   │     CDN     │
                   │ (CloudFlare)│
                   └──────┬──────┘
                          │
                          ▼
                  ┌───────────────┐
                  │ Load Balancer │
                  └───────┬───────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
         ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
         │   App   │ │   App   │ │   App   │
         │ Server  │ │ Server  │ │ Server  │
         └────┬────┘ └────┬────┘ └────┬────┘
              │           │           │
              └───────────┼───────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
     ┌────▼────┐   ┌──────▼──────┐  ┌────▼─────┐
     │  Redis  │   │  PostgreSQL │  │  Kafka   │
     │  Cache  │   │   Cluster   │  │  Queue   │
     └─────────┘   └─────────────┘  └──────────┘
                                          │
                                     ┌────▼────┐
                                     │Analytics│
                                     │ Workers │
                                     └─────────┘
```

### Request Flow

**URL Creation:**
1. Client sends POST /api/urls with long URL
2. App server generates short code
3. Check if short code exists in Redis cache
4. If not in cache, check database
5. Insert into database
6. Cache in Redis with 24-hour TTL
7. Return short code to client

**URL Redirection:**
1. Client accesses short URL (GET /:shortCode)
2. Check Redis cache first
3. If cache hit:
   - Immediately redirect (302)
   - Fire analytics event to Kafka asynchronously
4. If cache miss:
   - Query database
   - Cache result in Redis
   - Redirect and fire analytics event
5. Analytics workers consume Kafka events and batch write to analytics DB

## Caching Strategy

### Redis Cache Configuration

```python
# Cache configuration
CACHE_TTL = 86400  # 24 hours
CACHE_SIZE = "100GB"  # Can hold ~150M URLs

# Cache structure
cache_key = f"url:{short_code}"
cache_value = {
    'long_url': 'https://example.com/...',
    'expires_at': 1735689600,
    'user_id': 12345
}
```

### Cache Eviction

Use LRU (Least Recently Used):
- Hot URLs stay in cache
- Cold URLs get evicted automatically
- Cache hit rate: 85-90%

### Cache Warming

Pre-populate cache with trending URLs:

```python
def warm_cache():
    """
    Cache top URLs from last 24 hours
    """
    top_urls = db.query("""
        SELECT short_code, long_url, COUNT(*) as clicks
        FROM clicks
        WHERE clicked_at > NOW() - INTERVAL '24 hours'
        GROUP BY short_code, long_url
        ORDER BY clicks DESC
        LIMIT 100000
    """)

    for url in top_urls:
        redis.setex(
            f"url:{url.short_code}",
            CACHE_TTL,
            url.long_url
        )
```

## Analytics Pipeline

### Asynchronous Processing

Never block redirects for analytics:

```python
async def handle_redirect(short_code):
    # Get URL from cache/DB
    long_url = await get_url(short_code)

    if not long_url:
        return HTTP_404

    # Fire analytics event (non-blocking)
    asyncio.create_task(track_click(short_code, request))

    # Immediately redirect
    return redirect(long_url, status_code=302)

async def track_click(short_code, request):
    event = {
        'short_code': short_code,
        'timestamp': time.time(),
        'ip': request.client.host,
        'user_agent': request.headers.get('user-agent'),
        'referrer': request.headers.get('referer'),
    }

    # Send to Kafka
    await kafka_producer.send('clicks', value=event)
```

### Batch Processing

Analytics workers batch write to database:

```python
class AnalyticsWorker:
    def __init__(self, batch_size=1000, flush_interval=5):
        self.batch = []
        self.batch_size = batch_size
        self.flush_interval = flush_interval

    async def process_events(self):
        async for event in kafka_consumer:
            self.batch.append(event)

            if len(self.batch) >= self.batch_size:
                await self.flush()

    async def flush(self):
        if not self.batch:
            return

        # Batch insert
        await db.execute_many(
            "INSERT INTO clicks VALUES (...)",
            self.batch
        )

        self.batch = []
```

This reduces database load by 1000x.

## Advanced Features

### Custom Domains

Allow users to use their own domains:

```python
# Domain mapping table
CREATE TABLE custom_domains (
    domain VARCHAR(255) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

def get_url_by_domain(domain, short_code):
    # Check custom domain
    custom = db.query("""
        SELECT u.long_url
        FROM urls u
        JOIN custom_domains d ON u.user_id = d.user_id
        WHERE d.domain = %s AND u.short_code = %s
    """, domain, short_code)

    return custom.long_url if custom else None
```

### Link Expiration

Automatically expire old links:

```python
# Cron job runs every hour
def expire_old_urls():
    db.execute("""
        UPDATE urls
        SET is_active = FALSE
        WHERE expires_at < NOW()
        AND is_active = TRUE
    """)

    # Clear from cache
    expired = db.query("""
        SELECT short_code
        FROM urls
        WHERE expires_at < NOW()
        AND is_active = TRUE
    """)

    for url in expired:
        redis.delete(f"url:{url.short_code}")
```

### QR Code Generation

Generate QR codes for short URLs:

```python
import qrcode

def generate_qr_code(short_url):
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(short_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    return img
```

## Security Considerations

### Prevent Abuse

1. **Rate limiting**: Limit URL creation per IP/user
2. **URL validation**: Block malicious URLs (phishing, malware)
3. **Custom alias restrictions**: Reserve keywords, prevent profanity
4. **Link scanning**: Integrate with Google Safe Browsing API

```python
RESERVED_CODES = {'admin', 'api', 'www', 'app', 'help'}

def is_valid_custom_alias(alias):
    if alias in RESERVED_CODES:
        return False

    if len(alias) < 4 or len(alias) > 20:
        return False

    if not re.match(r'^[a-zA-Z0-9-_]+$', alias):
        return False

    return True
```

### URL Validation

```python
import requests

def is_safe_url(url):
    # Check against Google Safe Browsing
    response = requests.post(
        'https://safebrowsing.googleapis.com/v4/threatMatches:find',
        params={'key': GOOGLE_API_KEY},
        json={
            'threatInfo': {
                'threatTypes': ['MALWARE', 'SOCIAL_ENGINEERING'],
                'platformTypes': ['ANY_PLATFORM'],
                'threatEntries': [{'url': url}]
            }
        }
    )

    return len(response.json().get('matches', [])) == 0
```

## Monitoring

Key metrics to track:

```python
# Performance metrics
- redirect_latency_p50, p95, p99
- url_creation_latency
- cache_hit_rate
- database_query_time

# Business metrics
- urls_created_per_minute
- redirects_per_minute
- top_referrers
- geographic_distribution
- device_breakdown

# System health
- redis_memory_usage
- database_connection_pool
- kafka_lag
- error_rate_4xx, 5xx
```

## Production Lessons

1. **Cache everything**: 90% of traffic hits 10% of URLs
2. **Fail open**: If analytics fails, don't block redirects
3. **Pre-allocate IDs**: Avoid single point of failure
4. **Use CDN**: Reduce latency globally with edge caching
5. **Batch writes**: Analytics can be eventual consistent
6. **Monitor abuse**: Bad actors will try to exploit your service
7. **Plan for scale**: Database sharding is easier to plan upfront

## Conclusion

Building a production URL shortener involves more than generating short codes. The challenge is handling massive traffic, maintaining low latency globally, and tracking analytics without impacting performance.

The architecture I've outlined handles billions of URLs and tens of thousands of requests per second. Start simple with a single database and Redis cache, then scale horizontally as traffic grows.

Reach out on [LinkedIn](https://www.linkedin.com/in/rajat-tcp/) or [GitHub](https://github.com/rajat-np) if you want to discuss URL shortener implementations or system design patterns.
