# StakePro - Architecture Stress Test & Failure Scenarios

**ACTING AS:** QA & Security Lead

**MISSION:** To prove the robustness of the StakePro architecture by providing concrete, technical solutions to three critical failure scenarios.

---

## Scenario 1: The "Double Spend" Attack

> **The Risk:** A user with a **$10 balance** sends 5 simultaneous API requests to bet $10 each. The system must prevent them from betting a total of $50.

### The Solution: Atomic Operations with Redis & Lua

Direct database transactions are too slow and prone to deadlocks at our target scale (10,000+ bets/sec). The solution is to handle all critical balance operations in-memory using Redis, which is single-threaded and guarantees the atomicity of its commands. We enforce this atomicity using a Lua script.

**The Logic:**
1.  Every bet request triggers a call to a Redis Lua script.
2.  This script executes **atomically** on the Redis server. No other command can run in the middle of it.
3.  The script reads the user's balance, checks for sufficiency, and deducts the amount in a single, uninterruptible operation.
4.  The first request to arrive will succeed. The subsequent four will fail instantly because the balance is no longer sufficient.

#### The Lua Script (`bet_atomic.lua`)

This script is loaded into Redis and called by the NestJS backend. It is the core of our defense.

```lua
-- Atomically checks and deducts a user's balance for a bet.

-- KEYS[1]: The key for the user's wallet balance (e.g., "wallet:user-uuid:USDT:balance")
-- ARGV[1]: The amount to bet (as a string)

-- 1. Get the current balance. Redis commands are atomic.
local current_balance = tonumber(redis.call('GET', KEYS[1]) or '0')
local bet_amount = tonumber(ARGV[1])

-- 2. Check for sufficient funds.
if current_balance < bet_amount then
  -- Not enough money. Return an error and the current balance.
  return {err = 'INSUFFICIENT_FUNDS', balance = tostring(current_balance)}
end

-- 3. Deduct the balance. DECRBY is also an atomic operation.
local new_balance = redis.call('DECRBYFLOAT', KEYS[1], bet_amount)

-- 4. Return success and the new balance.
return {ok = true, balance = tostring(new_balance)}
```

#### Backend Implementation (NestJS `WalletService`)

```typescript
// Simplified example in our WalletService

async function placeBet(userId: string, amount: Decimal): Promise<boolean> {
  const balanceKey = `wallet:${userId}:USDT:balance`;

  try {
    // Execute the Lua script atomically.
    const result = await this.redis.eval(
      LUA_BET_SCRIPT, // The script content from above
      [balanceKey],   // KEYS array
      [amount.toString()] // ARGV array
    );

    if (result.err) {
      console.error(`Bet failed for user ${userId}: ${result.err}`);
      return false; // The bet is rejected
    }

    // SUCCESS! The balance was atomically updated in Redis.
    // Now, we can asynchronously write the transaction to PostgreSQL for persistence.
    this.transactionQueue.add('log_bet', { userId, amount });

    return true;

  } catch (error) {
    // Handle Redis connection errors, etc.
    return false;
  }
}
```

**Conclusion:** The first request will execute the Lua script, decrease the balance from $10 to $0, and succeed. The next four simultaneous requests will execute the same script, but the `if current_balance < bet_amount` check will fail, instantly rejecting the bets. **Double spending is impossible.**

---

## Scenario 2: The "Commission Storm"

> **The Risk:** A Super Master has 10,000 users. 500 of them place a winning bet at the exact same second. The system must distribute commissions up the chain for all 500 bets, which could mean 500+ wallet updates for the Super Master, crashing the database.

### The Solution: Asynchronous Processing with a Job Queue (BullMQ)

Directly updating the database in a tight loop during a high-traffic event is a recipe for disaster. We decouple the commission distribution from the main bet settlement flow using a robust job queue.

**The Logic:**
1.  When a bet is settled, the main application's only job is to credit the *player's* wallet.
2.  It then pushes a single `distribute-commission` job into a **BullMQ queue** running on Redis.
3.  A separate, dedicated **Worker process** consumes jobs from this queue.
4.  This worker calculates the commission for each level of the hierarchy and, instead of updating the DB immediately, it uses a **batching strategy**.

#### The Flow Diagram

```
Bet Settlement (API Server)
       │
       ├─ 1. Credit Player's Wallet (Redis - Fast)
       │
       └─ 2. Push Job to BullMQ Queue
              - { betId: '...', userId: '...' }

              BullMQ (Redis)
              [ Job1, Job2, Job3, ... Job500 ]
                     │
                     │
       Commission Worker (Separate Process)
       │
       ├─ 1. Consume Job
       │
       ├─ 2. Get User's Ancestors (e.g., Agent, Master, Super Master)
       │
       └─ 3. For each Ancestor:
              - Calculate Commission Amount
              - DO NOT write to DB. Instead, add to a Redis Hash:
                -> HINCRBYFLOAT "commissions:pending:super-master-id" "USDT" "0.05"


       Scheduled Batch Processor (Runs every 2 seconds)
       │
       ├─ 1. Get all keys matching "commissions:pending:*"
       │
       └─ 2. For each key:
              - Get all currency amounts from the Hash
              - Perform ONE database update:
                -> UPDATE wallets SET balance = balance + total_amount WHERE ...
              - Delete the Redis Hash
```

#### Why This Works:

*   **Decoupling:** The main betting application remains incredibly fast because it offloads the slow, complex commission logic to a background worker.
*   **Resilience:** If the commission worker fails, jobs remain in the queue and can be retried without affecting the user's betting experience.
*   **Batching:** The key to handling the "storm" is that we don't perform 500 individual database updates. The worker aggregates all commissions for a specific user (e.g., the Super Master) in Redis over a short time window. Then, a final process performs a **single, batched `UPDATE`** to the database, drastically reducing database load.

**Conclusion:** The database never sees 500 concurrent requests. It sees one or a few batched requests every couple of seconds, keeping it stable and responsive while ensuring every cent of commission is accurately tracked and eventually paid.

---

## Scenario 3: Provably Fair Verification

> **The Risk:** A user loses a bet and claims the site manipulated the outcome. We must provide mathematical proof that the result was fair and pre-determined.

### The Solution: The Holy Trinity of Provably Fair

The system relies on three key pieces of data, all of which are stored per-bet in the `Bet` table:

1.  **Server Seed:** A secret, random string generated by our server.
2.  **Client Seed:** A string provided by the user's browser, which they can change at any time.
3.  **Nonce:** A simple counter that increments for every bet made with the current seed pair.

#### The Mathematical Proof (Walkthrough)

Let's say the user wants to verify **Bet #5**. The database contains the following for that bet:

*   `server_seed`: `s_...` (This is only revealed *after* the user rotates their seed pair)
*   `client_seed`: `c_...` (The user chose this)
*   `nonce`: `5`

**Step 1: The Commitment (Hashing)**
Before the user even places Bet #1, we show them the **SHA-256 hash** of our `server_seed`. This is our commitment. It's like putting our prediction in a sealed envelope. We can't change the seed later without the hash changing, which would expose us.

**Step 2: Combining the Inputs**
The core of the algorithm is to combine all three inputs into a single string. The order is critical.

```
// The input string for the HMAC function
const input = `${client_seed}:${nonce}`;
// Example: "user-chosen-string:5"
```

**Step 3: The HMAC-SHA256 Function**
We don't just hash the inputs; we use **HMAC (Hash-based Message Authentication Code)**. This is a standard cryptographic function that uses a secret key (our `server_seed`) to create a deterministic hash of the `input` string. It's impossible to predict the output without knowing the server seed.

```typescript
import * as crypto from 'crypto';

const serverSeed = 's_...'; // From the database
const input = 'user-chosen-string:5'; // From the database

const hmac = crypto.createHmac('sha256', serverSeed);
hmac.update(input);
const hexHash = hmac.digest('hex');

// Result: e.g., "a1b2c3d4e5f6..."
```

**Step 4: Converting the Hash to a Game Outcome**
This `hexHash` is a long, unpredictable, but completely deterministic string. We now convert it into a game result. For a "Dice" game (0-100), the process is as follows:

```typescript
// Take the first 5 characters of the hash
const subHash = hexHash.substring(0, 5); // e.g., "a1b2c"

// Convert from hexadecimal to a decimal number
const decimalValue = parseInt(subHash, 16); // e.g., 662316

// Use the modulo operator to get a number within the desired range (0-10000)
const rollNumber = decimalValue % 10001;

// Divide by 100 to get the final dice roll with two decimal places
const diceResult = rollNumber / 100; // e.g., 66.23
```

**Conclusion:** The user can take the `server_seed` (which we reveal after they change it), their own `client_seed`, and the `nonce` from the bet history, and perform this exact calculation themselves using any online HMAC-SHA256 tool. The result will **always** match the `diceResult` shown in their bet history. This provides undeniable mathematical proof that the outcome was determined by the combination of their input and our pre-committed seed, and was not manipulated in real-time. 
