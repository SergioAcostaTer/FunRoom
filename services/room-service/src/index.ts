import { Server, WebSocket } from 'ws';
import { createClient } from 'redis';

const redisClient = createClient({ url: 'redis://redis:6379' });
redisClient.connect().catch(err => console.error('Redis connection error:', err));

const wss = new Server({ port: 8080 });

wss.on('connection', (ws: WebSocket, req: any) => {
  const roomId = req.url.split('/')[2];
  (ws as any).roomId = roomId; // Type hack for simplicity
  console.log(`Client joined room: ${roomId}`);

  redisClient.subscribe(`room:${roomId}:updates`, (msg: string) => {
    ws.send(msg);
  });
});

console.log('Room Service running on port 8080');