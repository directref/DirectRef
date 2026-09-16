# DirectRef — Frontend

> Referral-first job network. Your CV, straight to a friend inside the company.

## Prerequisites

- [Node.js 20+](https://nodejs.org)
- Backend running — see [backend](https://github.com/directref/backend)

## Setup

### 1. Clone the repo
```bash
git clone https://github.com/directref/frontend.git
cd frontend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env.local
```

`.env.local` needs one variable — the backend URL:
```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 4. Start the dev server
```bash
npm run dev -- -p 3001
```

App is now running at **http://localhost:3001**

---

## Start Order

Always start the **backend first**, then the frontend:

```bash
# Terminal 1 — backend
cd backend
npm run docker:up   # first time only
npm run dev

# Terminal 2 — frontend
cd frontend
npm run dev -- -p 3001
```

---

## Test Accounts

| Name | Email | Password |
|---|---|---|
| Sarah Alon | sarah@example.com | Password1 |
| Jonathan Katz | jonathan@example.com | Password1 |
| Maya Ron | maya@example.com | Password1 |

---

## Key Pages

| URL | What |
|---|---|
| /feed | Home — jobs from your connections |
| /jobs | Browse all jobs with filters |
| /network | Your connections |
| /applications | CVs you've sent |
| /applications/inbox | CVs you've received |
| /notifications | In-app notifications |
| /jobs/post | Post a job (paste any URL) |
| /join/[token] | Invite landing page |

---

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS v4
- **Server state:** SWR
- **UI primitives:** Radix UI
- **Language:** TypeScript 5

## Related

👉 Backend repo: https://github.com/directref/backend
