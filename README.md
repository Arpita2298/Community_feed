# Community Feed Prototype

## Stack

- Backend: Django + Django REST Framework
- Frontend: React (Vite) + Tailwind CSS
- DB: SQLite (default)

## Run the project

### 1) Backend (Django)

In one terminal:

```bash
python manage.py migrate
python manage.py runserver 8000
```

Run in:

- `Community_feed/backend`

Backend will be available at:

- `http://127.0.0.1:8000/`

API base:

- `http://127.0.0.1:8000/api/`

### 2) Frontend (React)

In a second terminal:

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Run in:

- `Community_feed/frontend`

Open:

- `http://127.0.0.1:5173/`

## Prototype Authentication

This prototype uses a simple header-based auth:

- Every request must include `X-User: <username>`
- If the user doesn’t exist, the backend auto-creates it.

The frontend UI has a username field that sets this header automatically.

## API Endpoints

- `GET /api/posts/` List posts
- `POST /api/posts/` Create post (`{ "body": "..." }`)
- `GET /api/posts/:id/` Post detail + full comment tree
- `POST /api/posts/:id/comments/` Create comment (`{ "body": "...", "parent_id": null|<commentId> }`)
- `POST /api/posts/:id/like/` Like post
- `DELETE /api/posts/:id/like/` Unlike post
- `POST /api/comments/:id/like/` Like comment
- `DELETE /api/comments/:id/like/` Unlike comment
- `GET /api/leaderboard/` Top 5 users by karma earned in last 24h

## Requirements Mapping

### Feed

- Posts include `author`, `like_count` and `liked_by_me`.

### Threaded comments (no N+1)

- Post detail loads the **entire comment tree** in a single comments query:
  - `Comment.objects.filter(post=post).select_related('author')...`
- Nested JSON is built in memory from that single result set.

### Concurrency / no double-like

- `PostLike` and `CommentLike` enforce uniqueness via DB constraints:
  - `(post, user)` unique
  - `(comment, user)` unique
- Like endpoints are **idempotent**:
  - `POST` always means "ensure liked"
  - `DELETE` always means "ensure unliked"
- Race conditions are handled via `transaction.atomic()` + catching `IntegrityError`.

### Leaderboard (24h, dynamic)

- Karma is stored as an **append-only** `KarmaEvent` ledger.
- Leaderboard is computed dynamically:
  - `SUM(delta)` for events in the last 24 hours.
- Karma rules:
  - Post like = `+5`
  - Comment like = `+1`
  - Unlike generates a compensating negative event (`-5` / `-1`).

## Notes

- The CSS linter may warn about `@tailwind` directives depending on editor setup; Tailwind works at build-time via PostCSS.
