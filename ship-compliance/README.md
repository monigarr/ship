# ship-compliance

Federal compliance CLI for the Ship monorepo.

## Requirements

- Python 3.11
- Node.js and pnpm installed for wrapped commands

## Install

```bash
pip install -e ship-compliance/
```

## Commands

```bash
ship-compliance --help
ship-compliance scan
ship-compliance attest --check
ship-compliance audit
ship-compliance export fedramp
ship-compliance ci
```

## Exit codes

- `0`: pass
- `1`: policy failure
- `2`: runtime/tooling error
