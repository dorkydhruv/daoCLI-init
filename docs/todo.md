# Next-Gen DAO CLI Architecture: Bonding Curve & Token Governance

## 1. Overall Architecture

### Core Components

- **Token Issuance Module**: Custom bonding curve contract for token sales
- **Governance System**: Enhanced SPL Governance with token-weighted voting
- **Treasury Management**: Config-authority based multisig control
- **AI Agent Framework**: On-chain parameters with off-chain execution
- **Liquidity Management**: Migration from curve to Raydium AMM

### Module Structure

```
/services
  /token
    - bonding-curve-service.ts
    - vesting-service.ts
    - token-utilities.ts
    - index.ts
  /governance
    - proposal-service.ts
    - voting-service.ts
    - authority-service.ts
    - index.ts
  /treasury
    - multisig-service.ts
    - treasury-service.ts
    - index.ts
  /ai-agent
    - agent-registry-service.ts
    - parameter-service.ts
    - execution-service.ts
    - index.ts
  /liquidity
    - curve-management-service.ts
    - amm-migration-service.ts
    - index.ts
```

## 2. Tokenomics Model

### Token Supply & Allocation

- **Total Supply**: 100,000,000 tokens
- **Allocation**:
  - Public Fair Launch (Bonding Curve): 50% (50M tokens) - immediately liquid & tradeable
  - Liquidity Provision: 20% (20M tokens) - locked after migration
  - DAO Treasury: 20% (20M tokens) - controlled by governance
  - Burned: 10% (10M tokens) - for deflationary effect

### DAOS.FUN-Inspired Fair Launch Model

- **Public Fair Launch**: Instantly tradeable bonding curve for price discovery
- **Always Liquid**: Participants can buy and sell anytime on the curve before migration
- **Fundraising Target**: Configurable SOL fundraising goal (like DAOS.FUN)
- **Token Supply Management**:
  - When fundraising target is reached, remaining unsold tokens are burned
  - This increases token scarcity and value for early participants
- **Dual-Pool Migration**: 50% to Raydium + 50% to DAOS.FUN pool upon reaching target
- **Treasury Control**: Unlike DAOS.FUN, funds remain in DAO treasury controlled by governance
- **Party Round Invitations**: Ability to create exclusive invite links for early participants

### Bonding Curve Implementation

- Initial MVP: Linear curve function `price = m * supply + b` for simplicity and stability
- Advanced version: Sigmoid curve with linear price floor: `price = max(a / (1 + e^(-k * (supply - m))) + b, c + d * supply)`
- Circuit breakers to pause trading if price moves >10% in 5 minutes
- Parameters configurable via CLI
- All funds flow to DAO treasury, accessible only through governance proposals
- **Migration Triggers**:
  - Primary: SOL fundraising target reached (configurable)
  - Secondary: Target market cap reached (configurable)
  - Alternative: Fundraising time window expired (configurable, default 7 days)
- **Token Supply Adjustment**: Burn all unsold tokens when fundraising target is reached
- **Dual Migration**: 50% liquidity to Raydium, 50% to DAOS.FUN pool
- 10% token burn during migration for deflationary effect

## 3. Governance Structure

### Token Roles

- **Community Tokens**: Main governance tokens with voting power
- **Council Tokens**: Special role tokens for oversight (optional)

### Proposal Tiers

1. **Micro Proposals** (lesser of 1% treasury or $10K USD equivalent)

   - Only community token vote required
   - Config authority auto-execution
   - Maximum 5 micro proposals per week

2. **Standard Proposals** (lesser of 10% treasury or $100K USD equivalent)

   - Community vote + config authority approval
   - Reduced multisig requirement (dynamic: 2/5 for <$1M treasury, 3/5 for $1-5M)

3. **Major Proposals** (>10% treasury or >$100K USD equivalent)
   - Community vote + full multisig requirement (4/5)
   - No config authority override
   - 72-hour timelock with emergency veto capability

### Config Authority Implementation

- Config authority PDA derived from DAO address
- Authority checks proposal size and vote outcome
- For micro/standard proposals, executes transaction directly
- Removes need for manual signatures on smaller proposals
- Major proposals still require full multisig authorization

## 4. User Flow

### Bonding Curve Phase (Fair Launch)

1. Creator initializes a "Guardian DAO" with configurable parameters
2. Deploys AI agent immediately, providing Twitter/X username during setup
3. Configures bonding curve parameters and target market cap
4. Optionally creates invite links for "Party Round" participants
5. Launches token sale on bonding curve
6. Users can buy AND SELL tokens at algorithmically determined price
7. All funds flow to DAO treasury
8. Creator and team members govern the AI agent during this phase

### Migration Phase

1. When target market cap reached OR fundraise window expires:
   - 50% of liquidity migrates to Raydium
   - 50% of liquidity migrates to DAOS.FUN pool
   - Both pools are locked for predetermined period
2. Guardian DAO converts to full community governance

### DAO Governance Phase

1. When threshold reached, migrate to Raydium liquidity pool
2. Convert Guardian DAO to full community governance
3. **Transfer AI agent governance from creators to community token holders**
4. Token holders can create/vote on proposals
5. Config authority handles execution for smaller proposals
6. Larger proposals require manual multisig signatures

### AI Agent Interaction

1. Governance votes to deploy AI agents
2. Parameters stored on-chain, execution happens off-chain
3. Treasury pays for AI services based on proposal approvals
4. Agents submit proof of work for verification

## 5. Implementation Phases

### Phase 1: Infrastructure (1-2 months)

- Reorganize service code structure
- Implement linear bonding curve contract first, then sigmoid
- Create Guardian DAO setup
- **Build initial AI agent deployment system with basic verification**
- Implement circuit breakers and safety controls

## 6. CLI Command Examples

```bash
# Create Guardian DAO
daocli guardian-dao init --name "AI_DAO" --members <PUBKEY1,PUBKEY2> --threshold 2

# Deploy AI agent immediately
daocli agent deploy --name "TradingBot" --params "frequency=2,max-trade=5" --executor <PUBKEY> --social-handle "@AIBot_Trading" --verification basic

# Configure bonding curve (simplified linear option)
daocli token setup-curve --type linear --params "m=0.0000001,b=0.1" --circuit-breaker true --always-liquid true

# Configure fundraising target (DAOS.FUN style)
daocli token setup-fundraise --target 1000 --burn-unsold true --min-raise 100

# Configure fair launch
daocli token setup-launch --target-cap 10000000 --fundraise-window 7d

# Create party round invite
daocli token create-invite --amount-cap 100000 --expires 48h --max-participants 50

# Launch token sale with dry-run simulation
daocli token launch-sale --min-purchase 0.1 --max-purchase 100 --agent-handle "@AIBot_Trading" --simulate

# Check fundraising status
daocli token fundraise-status

# Force fundraise completion (if conditions met)
daocli token complete-fundraise --burn-unsold true --timelock 48h

# Configure dual pool migration
daocli token setup-migration --raydium-pct 50 --daosfun-pct 50 --lock-duration 180d

# Check migration status
daocli token migration-status

# Force migrate (with enhanced security)
daocli token force-migration --timelock 7d --council-approval 3 --community-approval 30

# Transfer AI governance to community
daocli agent transfer-governance --agent-id <AGENT_ID> --to-community

# Create proposal with tier
daocli proposal create --type treasury-spending --amount 50 --recipient <PUBKEY> --tier micro

# Update AI agent parameters
daocli agent update --name "TradingBot" --params "frequency=4,max-trade=10" --tier standard
```

## 7. Technical Considerations

### On-chain Storage Optimization

- Use compact data structures to reduce storage costs
- Implement off-chain metadata storage when appropriate
- Carefully manage account size growth

### Security Measures

- Implement timelock delays for major proposals
- Rate limiting for proposal creation
- Multi-stage approval for high-value transactions
- Regular security audits

### AI Agent Verification

- **MVP Verification**: Signed API callbacks from agent execution
- **Advanced Verification**: ZK-proofs for computational integrity
- **Economic Security**: Require executors to stake tokens as collateral
- **Delegated Monitoring**: Community-elected watchers verify AI outputs

### Multisig Integration

- **Dynamic Thresholds**: Scale based on treasury size
  - <$1M: 2/5 signatures
  - $1M-$5M: 3/5 signatures
  - > $5M: 4/5 signatures
- For micro/standard proposals: Config authority acts as proxy
- For major proposals: Full multisig requirement
- Emergency override capability with supermajority vote (90%+)

### Future Extensions

- Token staking and reward distribution
- Quadratic voting implementation
- NFT-gated governance areas
- Cross-chain asset management
