# Ticket Pricing Implementation

## Overview

The contract now enforces **fixed ticket pricing** at **0.01 SOL per ticket**, and users can only purchase **whole tickets** (no fractional amounts).

## Contract Changes

### Constants Added
```rust
// Fixed ticket price: 0.01 SOL = 10,000,000 lamports
pub const TICKET_PRICE_LAMPORTS: u64 = 10_000_000;
```

### Deposit Function Updated
The `deposit()` function now:
1. Validates amount is greater than 0
2. **Enforces amount is exact multiple of ticket price** (10,000,000 lamports)
3. Calculates number of tickets
4. Logs ticket purchase

```rust
pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    // Enforce fixed ticket price: amount must be exact multiple of TICKET_PRICE_LAMPORTS
    require!(
        amount % TICKET_PRICE_LAMPORTS == 0,
        ErrorCode::InvalidTicketAmount
    );

    // Calculate number of tickets
    let num_tickets = amount / TICKET_PRICE_LAMPORTS;
    require!(num_tickets > 0, ErrorCode::InvalidAmount);

    // ... rest of function
    msg!("Deposited {} tickets ({} lamports)", num_tickets, amount);
    Ok(())
}
```

### New Error Code
```rust
#[error_code]
pub enum ErrorCode {
    // ... other errors
    #[msg("Amount must be exact multiple of ticket price (0.01 SOL = 10,000,000 lamports)")]
    InvalidTicketAmount,
}
```

## Frontend Integration

### Utility Functions (`src/utils/tickets.ts`)

```typescript
export const TICKET_PRICE_SOL = 0.01;
export const TICKET_PRICE_LAMPORTS = 10_000_000;

// Convert SOL to tickets
solToTickets(solAmount: number): number

// Convert tickets to SOL
ticketsToSol(tickets: number): number

// Validate if amount is valid for ticket purchase
isValidTicketAmount(solAmount: number): boolean

// Get closest valid ticket amount (rounds down)
getValidTicketAmount(solAmount: number): number
```

### Transaction Hook Updated
`useRaffleTransactions.ts` now:
- Validates ticket amounts before submitting
- Provides clear error messages
- Shows number of tickets being purchased
- Handles `InvalidTicketAmount` error from contract

## Examples

### ✅ Valid Deposits:
- `0.01 SOL` → 1 ticket
- `0.05 SOL` → 5 tickets
- `0.10 SOL` → 10 tickets
- `1.00 SOL` → 100 tickets

### ❌ Invalid Deposits (will fail):
- `0.015 SOL` → Error: "Amount must be whole tickets only!"
- `0.025 SOL` → Error: "Amount must be whole tickets only!"
- `0.001 SOL` → Error: "Amount must be whole tickets only!"

## Testing

### Via Frontend:
1. Navigate to Staking Raffle
2. Try entering `0.015` SOL
3. Should see client-side validation error
4. Enter `0.01` SOL
5. Transaction should succeed

### Via CLI:
```bash
# This will work (1 ticket = 10,000,000 lamports)
anchor run test -- deposit 10000000

# This will fail (not exact multiple)
anchor run test -- deposit 15000000
```

## Program Upgrade Details

- **Upgraded on**: 2025-10-25
- **Transaction**: `3JijhXVEYJcf1noYbQQrfM5xgPK6kpBvXxU5ectx3Est16ivDxysmoxcvsxj8weUwSfxLVJaQvQCTTftyZvgh6oQ`
- **Network**: Devnet
- **Program ID**: `3u9hRUKw79MKPobpfiapPfJuUqWARW4YfEBHbxY14bs1`

## Benefits

1. **Fair Pricing**: Everyone pays the same price per ticket
2. **Clear Economics**: Easy to understand 1 ticket = 0.01 SOL
3. **No Confusion**: Can't accidentally buy fractional tickets
4. **Easier Accounting**: Whole numbers for tickets owned
5. **Better UX**: Display can show "You have 5 tickets" instead of "0.053 SOL staked"

## Future Enhancements

Possible improvements for production:
1. **Dynamic Pricing**: Allow admin to adjust ticket price per round
2. **Bulk Discounts**: Offer discounts for buying many tickets
3. **Min/Max Limits**: Set minimum and maximum tickets per user
4. **Ticket Cap**: Limit total tickets per round

## Migration Notes

For existing users who deposited before this upgrade:
- Their balances are still valid (stored in lamports)
- Will be treated as if they bought tickets at 0.01 SOL each
- Example: User with 50,000,000 lamports = 5 tickets
