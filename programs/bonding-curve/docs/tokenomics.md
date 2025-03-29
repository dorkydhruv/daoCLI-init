# Next-Gen Asset CLI: Bonding Curve Tokenomics

## Updated Bonding Curve Mathematics

Our bonding curve implementation uses a constant product formula similar to AMMs but with important adjustments to manage treasury allocations properly:

### Core Formula

- Constant product: `virtual_sol_reserves * virtual_token_reserves = k`
- This formula ensures price increases as tokens are purchased
- Pricing is fully deterministic based on reserves

### Treasury Allocation Management

- 20% of all incoming SOL is allocated to treasury
- **Critical Fix**: Treasury allocations are subtracted from virtual SOL reserves
- This maintains the constant product invariant and prevents pricing errors

### Reserves Management

- **Virtual Reserves**: Mathematical constructs used for pricing calculations
  - Virtual SOL Reserves: Total SOL minus treasury allocations
  - Virtual Token Reserves: Tokens available in the bonding curve
- **Real Reserves**: Actual assets held in accounts
  - Real SOL Reserves: Total SOL held by bonding curve
  - Real Token Reserves: Total tokens held by bonding curve

### Selling Tokens

- When users sell tokens, the treasury allocation is proportionally reduced
- This ensures the constant product formula remains valid
- Maximum withdrawal is capped to available (non-treasury) SOL

## Token Supply & Allocation

- **Total Supply**: 100,000,000 tokens
- **Allocation**:
  - Public Fair Launch (Bonding Curve): 50% (50M tokens) - immediately liquid & tradeable
  - Liquidity Provision: 20% (20M tokens) - locked after migration
  - DAO Treasury: 20% (20M tokens) - controlled by governance
  - Burned: 10% (10M tokens) - for deflationary effect

## Fair Launch Model

- **Public Fair Launch**: Instantly tradeable bonding curve for price discovery
- **Always Liquid**: Participants can buy and sell anytime on the curve
- **Fundraising Target**: Configurable SOL fundraising goal
- **Token Supply Management**:
  - When fundraising target is reached, remaining unsold tokens are burned
  - This increases token scarcity and value for early participants
- **Liquidity Migration**: Move to Raydium AMM with locked liquidity upon reaching target
- **Treasury Control**: Funds remain in DAO treasury controlled by governance
- **Custom Liquidity Locking**: Using our own bonding curve mechanism rather than external platforms

## Bonding Curve Implementation Details

### Technical Parameters

- Initial virtual SOL reserves: 30,000,000,000 lamports
- Initial virtual token reserves: 100,000,000,000,000 (adjusted for decimals)
- Real token reserves: 50,000,000,000,000 (50% of supply available for sale)
- Token decimals: 6

### Buy Operation

1. User sends SOL to bonding curve
2. 20% is allocated to treasury
3. Virtual SOL reserves increase by 80% of the SOL amount
4. Real SOL reserves increase by 100% of the SOL amount
5. Token price is calculated based on the virtual reserves formula
6. Tokens sent to user based on the calculated price

### Sell Operation

1. User sends tokens to bonding curve
2. System calculates SOL return based on constant product formula
3. Treasury allocation is reduced proportionally (20% of SOL returned)
4. Real token reserves increase by 100% of tokens sent
5. Virtual token reserves increase by 100% of tokens sent
6. Virtual SOL reserves decrease by the amount returned to user
7. Real SOL reserves decrease by the amount returned to user

### Migration Triggers

- Primary: SOL fundraising target reached (configurable)
- Secondary: Target market cap reached (configurable)
- Alternative: Fundraising time window expired (configurable, default 7 days)

### Migration Process

1. Calculate final bonding curve price
2. Allocate treasury portion (20% of total SOL raised)
3. Process remaining assets:
   - Move liquidity to Raydium AMM pool at the final price
   - Deploy custom liquidity locking mechanism
4. Burn all unsold tokens
5. Lock liquidity for predetermined period

## CLI Command Examples

```bash
# Configure bonding curve with updated parameters
assetCLI token setup-curve --type constant-product \
  --initial-virtual-sol 30000000000 \
  --initial-virtual-tokens 100000000000000 \
  --treasury-allocation 20 \
  --always-liquid true

# Check current bonding curve state
assetCLI token curve-status

# Set up migration parameters
assetCLI token setup-migration --treasury-pct 20 --liquidity-lock-duration 180d

# Force migration (if conditions met)
assetCLI token execute-migration --burn-unsold true --lock-liquidity true
```

## Technical Considerations

### Mathematical Integrity

- The constant product formula must be preserved throughout all operations
- Virtual reserves track the mathematically relevant amounts for pricing
- Real reserves track the actual asset holdings

### Security Measures

- Circuit breakers to pause trading if price moves >10% in 5 minutes
- Invariant checks ensuring virtual/real reserves remain consistent
- Treasury allocation tracking with underflow protection

### Advanced Curve Options

- Future support for sigmoid curve with linear price floor:
  `price = max(a / (1 + e^(-k * (supply - m))) + b, c + d * supply)`
- Configurable parameters via governance proposals
- Advanced price discovery mechanisms
