# Install summary

Following README installation instructions.

## Setup commands

```bash
# 1) Clone the repository
git clone https://github.com/US-Department-of-the-Treasury/ship.git
cd ship

# 2) Install dependencies
pnpm install

# 3) Configure environment
cp api/.env.example api/.env.local
cp web/.env.example web/.env

# 4) Start the database
docker-compose up -d

# 5) Create sample data
pnpm db:seed

# 6) Run database migrations
pnpm db:migrate

# 7) Start the application
pnpm dev
```

ACTION: pnpm install
RESULT: 
Scope: all 4 workspace projects
Update available: 10.27.0 -> 11.1.3.

ACTION: pnpm add -g pnpm  (update)
RESULT:
SHELL=/usr/bin/bash
PNPM_HOME=C:\Users\monig\AppData\Local\pnpm
/c/Users/monig/AppData/Local/pnpm/bin
-rw-r--r-- 1 monig 197609      200 Nov 19  2022 .bash_profile
/c/nvm4w/nodejs/pnpm
pnpm -v
10.27.0
PNPM_HOME:$PATH"\n' >> ~/.bashrc

PROMPT:
I’m installing this repo based on the README file and have this new message in my CLI: [pasted Git Bash error here]

--- Windows PC ---
Everything up through `pnpm dev` worked on a PC.
The failure is specific to `package.json` mapping `dev` to a Bash script (`./scripts/dev.sh`), but on Windows, `pnpm run` invokes `cmd.exe`, which cannot execute `./...` syntax.

Instead of `pnpm dev`, use:
pnpm dev:raw

Set pnpm to use Git Bash for scripts:
pnpm config set script-shell "C:\\Program Files\\Git\\bin\\bash.exe"
pnpm dev
