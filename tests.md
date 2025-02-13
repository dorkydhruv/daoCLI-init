## DAO contract test

```
anchor test
```

Output

```
dao-contract
- ✔ creates an SPL token (945ms)
- ✔ creates a DAO proposal (422ms)
- ✔ contributes to a DAO proposal (393ms)
- ✔ executes a DAO proposal once target amount is reached (818ms)
```

## DAO CLI tests

```
cd cli
```

#### Add devent-keypair.json here or change the path in dao-config.json

```
yarn build && yarn test
```

Output

```
CLI Integration Tests (using devnet)
- ✔ should switch to devnet (198ms)
- ✔ should create a proposal on devnet (5820ms)
- ✔ should contribute to a proposal on devnet (7232ms)
- ✔ should execute a proposal on devnet (6123ms)
```
