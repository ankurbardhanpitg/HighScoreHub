# HighScoreHub

A kids’ game arcade with high scores: React + Vite + Phaser 3 on the frontend, Express + MongoDB on the backend.

Games on the hub:

- Flappy Bird
- 2048 (slide tiles, merge matching numbers, chase a high score)
- Whack-a-Mole (tap moles as they pop up, 30-second reflex round)
- Pong (one player vs the computer, first to 5)
- Breakout (aim the ball, bounce it off the paddle, smash the bricks)
- Star Waves (move your ship, blast the star blobs, clear each wave)
- Bubble Shooter (aim the cannon, match 2+ bubbles, clear the cluster)
- Snake (steer, eat apples, grow — don’t hit a wall or your tail)
- Tic Tac Toe (you vs the computer, three in a row, first to 5)
- Connect Four (you vs the computer, four in a row, first to 5)

## Project structure

- `client/` — React app (Vite, Phaser 3, React Router)
- `server/` — Express API (Mongoose / MongoDB)

## Prerequisites

- Node.js 18+
- MongoDB running locally

This project uses the local database name `myGames` by default:

```
mongodb://127.0.0.1:27017/myGames
```

## Run the server

```bash
cd server
npm install
```

Optional: copy `.env.example` to `.env` and edit values.

```
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/myGames
CLIENT_ORIGIN=http://localhost:5173
JWT_SECRET=replace-with-a-long-random-string
```

If `MONGODB_URI` is not set, the server defaults to `mongodb://127.0.0.1:27017/myGames`.

```bash
npm run dev
```

The API listens on `http://localhost:3001`.

### API

Auth:

- `POST /api/auth/signup` — body `{ "username": "ada", "email": "ada@example.com", "password": "secret1" }`
- `POST /api/auth/signin` — body `{ "email": "ada@example.com", "password": "secret1" }`
- `GET /api/auth/me` — requires `Authorization: Bearer <token>`

Scores:

- `POST /api/scores` — body `{ "score": 12, "game": "flappy" }`, requires a signed-in user. The player name is taken from the account username. `game` can be `"flappy"`, `"2048"`, `"whack"`, `"pong"`, `"breakout"`, `"starwaves"`, `"bubble"`, `"snake"`, `"tictactoe"`, or `"connectfour"` and defaults to `"flappy"`.
- `GET /api/scores/top?page=1&limit=10&game=flappy` — paginated scores for one game, newest date first. Requires a signed-in user. Defaults to page 1, 10 records, and the Flappy Bird board.

## Run the client

In a second terminal:

```bash
cd client
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

Optional: set `VITE_API_URL` if the API is not at `http://localhost:3001`.

## Local flow

1. Start MongoDB.
2. Start `/server` with `npm run dev`.
3. Start `/client` with `npm run dev`.
4. Open Home → Sign up or Sign in.
5. Play a game. After Game Over, submit the score (saved under your username).
6. Open Leaderboard to see scores (10 per page).
