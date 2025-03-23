import { Server, WebSocket } from 'ws';
import { createClient } from 'redis';

// Redis client setup
const redisClient = createClient({ url: 'redis://redis:6379' });
redisClient.connect().catch(err => console.error('Redis connection error:', err));

// WebSocket server
const wss = new Server({ port: 8080 });

wss.on('connection', async (ws: WebSocket, req: any) => {
  const roomId = req.url?.split('/')[2];
  if (!roomId) {
    ws.close(4000, 'Room ID required');
    return;
  }

  (ws as any).roomId = roomId;
  console.log(`Client joined room: ${roomId}`);

  // Send current queue state when client connects
  const currentQueue = await redisClient.lRange(`room:${roomId}:queue`, 0, -1);
  ws.send(JSON.stringify({
    event: 'initial_state',
    data: currentQueue.map(item => JSON.parse(item))
  }));

  // Subscribe to room updates
  redisClient.subscribe(`room:${roomId}:updates`, (msg: string) => {
    ws.send(msg);
  });

  ws.on('close', () => {
    console.log(`Client left room: ${roomId}`);
  });
});

console.log('Room Service running on port 8080');