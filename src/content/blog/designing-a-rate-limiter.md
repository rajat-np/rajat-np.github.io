---
title: "Designing a Distributed Rate Limiter"
description: "Building a production-ready rate limiter that scales across multiple servers using Redis and token bucket algorithm."
pubDate: 2026-01-07
tags: ["system-design", "rate-limiting", "redis", "distributed-systems", "backend"]
draft: true
---

Rate limiting is one of those systems that seems simple until you need to make it work across multiple servers. I've implemented rate limiters for several production systems, and I want to share the patterns and trade-offs I've learned.

## Why Rate Limiting Matters

Rate limiting protects your system from three main threats:

1. **Accidental overload** - A misconfigured client making thousands of requests
2. **Malicious attacks** - DDoS attempts or brute force attacks
3. **Resource exhaustion** - Preventing one user from consuming all available resources

Without rate limiting, a single misbehaving client can take down your entire service.

## Requirements

### Functional Requirements

- Limit requests per user/IP based on configurable thresholds
- Support multiple rate limit rules (per second, per minute, per hour)
- Return clear error messages when limits are exceeded
- Allow different limits for different API endpoints or user tiers

### Non-Functional Requirements

- **Low latency** - Adding <5ms to request processing time
- **Highly available** - Rate limiter failures shouldn't block requests
- **Distributed** - Work correctly across multiple application servers
- **Accurate** - Enforce limits precisely, minimal false positives

## Rate Limiting Algorithms

### 1. Token Bucket

This is my go-to algorithm. Each user gets a bucket that refills with tokens at a fixed rate. Each request consumes one token. When the bucket is empty, requests are rejected.

**Advantages:**
- Handles burst traffic naturally
- Simple to implement
- Memory efficient

**Implementation:**
```python
class TokenBucket:
    def __init__(self, capacity, refill_rate):
        self.capacity = capacity
        self.tokens = capacity
        self.refill_rate = refill_rate  # tokens per second
        self.last_refill = time.time()

    def allow_request(self):
        self._refill()
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False

    def _refill(self):
        now = time.time()
        elapsed = now - self.last_refill
        tokens_to_add = elapsed * self.refill_rate
        self.tokens = min(self.capacity, self.tokens + tokens_to_add)
        self.last_refill = now
```

### 2. Leaky Bucket

Similar to token bucket, but requests are processed at a fixed rate. Excess requests queue up (or are dropped if the queue is full).

**Advantages:**
- Smooth output rate
- Protects downstream services

**Disadvantages:**
- Queuing adds complexity
- Can create artificial delays

### 3. Fixed Window

Count requests in fixed time windows (e.g., 0-60 seconds, 60-120 seconds).

**Advantages:**
- Simple implementation
- Low memory usage

**Disadvantages:**
- Burst problem at window boundaries
- User can make 2x requests by splitting across windows

### 4. Sliding Window Log

Track timestamp of each request and count requests in a sliding window.

**Advantages:**
- Most accurate
- No boundary issues

**Disadvantages:**
- Memory intensive (stores all timestamps)
- Slower at high request rates

### 5. Sliding Window Counter

Combines fixed window's efficiency with sliding window's accuracy. Uses weighted count from current and previous windows.

**Formula:**
```
requests_in_window =
    requests_in_current_window +
    requests_in_previous_window * overlap_percentage
```

**This is what I recommend for production:** Good balance of accuracy and performance.

## Architecture Design

### Single-Server Rate Limiting

For a single application server, an in-memory implementation works fine:

```python
from collections import defaultdict
import time

class RateLimiter:
    def __init__(self):
        self.buckets = defaultdict(dict)

    def is_allowed(self, user_id, limit, window):
        key = f"{user_id}:{window}"
        now = time.time()

        if key not in self.buckets:
            self.buckets[key] = {
                'count': 1,
                'reset_time': now + window
            }
            return True

        bucket = self.buckets[key]

        if now >= bucket['reset_time']:
            bucket['count'] = 1
            bucket['reset_time'] = now + window
            return True

        if bucket['count'] < limit:
            bucket['count'] += 1
            return True

        return False
```

### Distributed Rate Limiting with Redis

Production systems typically run multiple application servers. We need a centralized rate limiting solution.

**Redis is perfect for this:**
- Atomic operations
- Built-in expiration
- Sub-millisecond latency
- Easy to scale

**Implementation using Redis:**

```python
import redis
import time

class DistributedRateLimiter:
    def __init__(self, redis_client):
        self.redis = redis_client

    def is_allowed(self, user_id, limit, window):
        """Token bucket implementation using Redis"""
        key = f"rate_limit:{user_id}"
        now = time.time()

        # Lua script for atomic operations
        lua_script = """
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local rate = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])

        local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
        local tokens = tonumber(bucket[1])
        local last_refill = tonumber(bucket[2])

        if tokens == nil then
            tokens = capacity
            last_refill = now
        end

        -- Refill tokens
        local elapsed = now - last_refill
        local tokens_to_add = elapsed * rate
        tokens = math.min(capacity, tokens + tokens_to_add)

        -- Try to consume a token
        local allowed = 0
        if tokens >= 1 then
            tokens = tokens - 1
            allowed = 1
        end

        -- Update bucket
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
        redis.call('EXPIRE', key, 3600)

        return allowed
        """

        result = self.redis.eval(
            lua_script,
            1,  # number of keys
            key,  # KEYS[1]
            limit,  # ARGV[1] - capacity
            limit / window,  # ARGV[2] - refill rate
            now  # ARGV[3] - current time
        )

        return result == 1
```

**Why Lua scripts?**
- All operations execute atomically
- Reduces network round trips
- Prevents race conditions

### Rate Limiter Architecture

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    └────────┬────────┘
                             │
               ┌─────────────┼─────────────┐
               │             │             │
          ┌────▼───┐    ┌────▼───┐   ┌────▼───┐
          │  App   │    │  App   │   │  App   │
          │ Server │    │ Server │   │ Server │
          └────┬───┘    └────┬───┘   └────┬───┘
               │             │             │
               └─────────────┼─────────────┘
                             │
                      ┌──────▼──────┐
                      │    Redis    │
                      │   Cluster   │
                      └─────────────┘
```

## Advanced Features

### 1. Multiple Rate Limit Rules

Different limits for different endpoints:

```python
RATE_LIMITS = {
    '/api/login': {'limit': 5, 'window': 60},  # 5 requests per minute
    '/api/search': {'limit': 100, 'window': 60},  # 100 requests per minute
    '/api/upload': {'limit': 10, 'window': 3600},  # 10 requests per hour
}

def check_rate_limit(user_id, endpoint):
    config = RATE_LIMITS.get(endpoint, {'limit': 1000, 'window': 60})
    return rate_limiter.is_allowed(
        f"{user_id}:{endpoint}",
        config['limit'],
        config['window']
    )
```

### 2. User Tiers

Different limits for free vs. paid users:

```python
USER_TIERS = {
    'free': {'requests_per_minute': 60},
    'basic': {'requests_per_minute': 1000},
    'premium': {'requests_per_minute': 10000},
}

def get_rate_limit(user):
    tier = user.subscription_tier
    return USER_TIERS[tier]['requests_per_minute']
```

### 3. Response Headers

Inform clients about their rate limit status:

```python
response.headers['X-RateLimit-Limit'] = str(limit)
response.headers['X-RateLimit-Remaining'] = str(remaining)
response.headers['X-RateLimit-Reset'] = str(reset_time)
```

### 4. Graceful Degradation

If Redis is unavailable, allow requests through (fail open) rather than blocking everything:

```python
def is_allowed_with_fallback(user_id, limit, window):
    try:
        return rate_limiter.is_allowed(user_id, limit, window)
    except redis.RedisError:
        # Log error and allow request
        logger.error("Rate limiter unavailable, allowing request")
        return True
```

## Handling Edge Cases

### Race Conditions

Use Redis transactions or Lua scripts to prevent race conditions between checking and updating counters.

### Clock Skew

In distributed systems, server clocks can drift. Use Redis's time command to get a consistent timestamp:

```python
redis_time = redis.time()
now = redis_time[0] + redis_time[1] / 1000000.0
```

### Memory Management

Set TTL on all keys to prevent memory leaks:

```python
redis.expire(key, ttl)
```

For Redis Cluster, use consistent hashing to distribute rate limit data evenly across nodes.

## Monitoring and Alerting

Track these metrics:

```python
# Rate limiter performance
- rate_limit_check_latency_ms
- rate_limit_redis_errors
- rate_limit_fallback_count

# Rate limiting effectiveness
- requests_rate_limited_per_endpoint
- top_rate_limited_users
- rate_limit_rule_hits

# System health
- redis_connection_pool_size
- redis_memory_usage
- rate_limit_config_changes
```

## Testing Strategy

### Unit Tests

Test the algorithm logic:

```python
def test_token_bucket_refill():
    bucket = TokenBucket(capacity=10, refill_rate=1)

    # Consume all tokens
    for _ in range(10):
        assert bucket.allow_request() == True

    # Bucket empty
    assert bucket.allow_request() == False

    # Wait for refill
    time.sleep(5)

    # Should have 5 tokens now
    for _ in range(5):
        assert bucket.allow_request() == True
```

### Load Tests

Verify behavior under high concurrency:

```python
# Locust load test
class RateLimitTest(HttpUser):
    wait_time = between(0.1, 0.5)

    @task
    def test_rate_limit(self):
        response = self.client.get("/api/test")
        if response.status_code == 429:
            # Rate limited
            assert 'Retry-After' in response.headers
```

## Trade-offs and Decisions

| Choice | Trade-off |
|--------|-----------|
| Token bucket | Allows bursts vs. Strict rate enforcement |
| Redis Lua scripts | Atomic operations vs. Increased complexity |
| Fail open on errors | Availability vs. Protection |
| Per-endpoint limits | Fine control vs. Configuration complexity |

## Production Considerations

1. **Start conservative**: Begin with generous limits and tighten based on metrics
2. **Document clearly**: Users need to know their limits and how to request increases
3. **Provide bypass tokens**: Allow trusted partners to skip rate limiting
4. **Monitor false positives**: Track legitimate requests being blocked
5. **Plan for scaling**: Redis Cluster handles millions of rate limit checks per second

## When to Use What

**Use in-memory rate limiting when:**
- Single application server
- Low traffic (<1000 requests/second)
- Rate limiting is not critical for security

**Use Redis rate limiting when:**
- Multiple application servers
- Need accurate distributed rate limiting
- High traffic volumes
- Rate limiting is security-critical

**Use edge rate limiting (CloudFlare, AWS WAF) when:**
- Protecting against DDoS
- Global traffic distribution
- Need rate limiting before requests hit your infrastructure

## Conclusion

Rate limiting is essential for production systems. Start with a simple token bucket algorithm, use Redis for distributed coordination, and monitor your limits carefully. The goal isn't to block legitimate users—it's to protect your system while maintaining a good user experience.

I've found that the sliding window counter with Redis provides the best balance of accuracy, performance, and simplicity for most production use cases.

Feel free to reach out on [LinkedIn](https://www.linkedin.com/in/rajat-tcp/) or [GitHub](https://github.com/rajat-np) if you'd like to discuss rate limiting strategies or implementation details.
