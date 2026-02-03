--[[
  ATOMIC BALANCE UPDATE SCRIPT
  ============================
  
  This Lua script runs atomically on Redis, ensuring no race conditions
  can occur during balance updates. Redis is single-threaded, so this
  script executes without interruption.
  
  KEYS:
    [1] = Balance key (e.g., "wallet:user-uuid:USDT:balance")
    [2] = Processed transactions set (e.g., "wallet:user-uuid:processed")
  
  ARGV:
    [1] = Amount (negative for deduction/bet, positive for credit/win)
    [2] = Transaction ID (for idempotency check)
    [3] = Transaction type ("BET", "WIN", "DEPOSIT", "WITHDRAWAL", etc.)
  
  RETURNS:
    On success: { "OK", new_balance, transaction_id }
    On error:   { "ERROR", error_code, current_balance }
    
  ERROR CODES:
    "INSUFFICIENT_FUNDS" - Not enough balance for deduction
    "DUPLICATE_TRANSACTION" - Transaction already processed (idempotency)
    "INVALID_AMOUNT" - Amount is not a valid number
--]]

-- Parse arguments
local balance_key = KEYS[1]
local processed_key = KEYS[2]
local amount = tonumber(ARGV[1])
local transaction_id = ARGV[2]
local transaction_type = ARGV[3]

-- Validate amount
if amount == nil then
  return { "ERROR", "INVALID_AMOUNT", "0" }
end

-- IDEMPOTENCY CHECK: Prevent duplicate transaction processing
-- This is crucial for preventing double-credits or double-debits
-- if a request is retried due to network issues
local already_processed = redis.call('SISMEMBER', processed_key, transaction_id)
if already_processed == 1 then
  -- Transaction was already processed, return current balance
  local current_balance = redis.call('GET', balance_key) or '0'
  return { "ERROR", "DUPLICATE_TRANSACTION", current_balance }
end

-- Get current balance (default to 0 if key doesn't exist)
local current_balance = tonumber(redis.call('GET', balance_key) or '0')

-- DEDUCTION CHECK: If amount is negative (bet/withdrawal), verify sufficient funds
if amount < 0 then
  local deduction = math.abs(amount)
  
  if current_balance < deduction then
    -- Insufficient funds - reject the transaction
    return { "ERROR", "INSUFFICIENT_FUNDS", tostring(current_balance) }
  end
end

-- ATOMIC UPDATE: Perform the balance update
-- Using INCRBYFLOAT for precise decimal handling
local new_balance = redis.call('INCRBYFLOAT', balance_key, amount)

-- MARK AS PROCESSED: Add transaction to processed set for idempotency
-- Set expiration to 24 hours to prevent memory bloat
redis.call('SADD', processed_key, transaction_id)
redis.call('EXPIRE', processed_key, 86400) -- 24 hours TTL

-- LOG: Store transaction details in a list for audit trail
local log_key = balance_key .. ':log'
local log_entry = string.format(
  '{"tx":"%s","type":"%s","amount":%s,"before":%s,"after":%s,"ts":%d}',
  transaction_id,
  transaction_type,
  tostring(amount),
  tostring(current_balance),
  tostring(new_balance),
  redis.call('TIME')[1]
)
redis.call('LPUSH', log_key, log_entry)
redis.call('LTRIM', log_key, 0, 999) -- Keep last 1000 transactions

-- SUCCESS: Return new balance
return { "OK", tostring(new_balance), transaction_id }
