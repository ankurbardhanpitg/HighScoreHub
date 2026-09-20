import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { connectDb } from './db.js';
import { attachChessSockets } from './chessRooms.js';
import { attachLudoSockets } from './ludoRooms.js';
import authRouter from './routes/auth.js';
import chessRouter from './routes/chess.js';
import ludoRouter from './routes/ludo.js';
import scoresRouter from './routes/scores.js';

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  return next(err);
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/chess', chessRouter);
app.use('/api/ludo', ludoRouter);
app.use('/api/scores', scoresRouter);

async function start() {
  await connectDb();
  const server = http.createServer(app);
  const chessWss = attachChessSockets(CLIENT_ORIGIN);
  const ludoWss = attachLudoSockets(CLIENT_ORIGIN);

  server.on('upgrade', (req, socket, head) => {
    const pathname = String(req.url || '').split('?')[0];
    if (pathname === '/ws/chess') {
      chessWss.handleUpgrade(req, socket, head, (ws) => {
        chessWss.emit('connection', ws, req);
      });
      return;
    }
    if (pathname === '/ws/ludo') {
      ludoWss.handleUpgrade(req, socket, head, (ws) => {
        ludoWss.emit('connection', ws, req);
      });
      return;
    }
    socket.destroy();
  });

  server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
