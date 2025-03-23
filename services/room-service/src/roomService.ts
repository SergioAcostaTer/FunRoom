import { Server, WebSocket } from 'ws';
import { connectRedis } from './redisClient';
import { handleUserJoin, handleUserLeave } from './eventHandler';
import { handleMessage } from './messageHandler';

const wss = new Server({ port: 8080 });
const clients = new Map<string, Map<string, WebSocket>>();

wss.on('connection', async (ws: WebSocket, req: any) => {
  try {
    const urlParts = req.url?.split('?') || [];
    const roomId = urlParts[0]?.split('/')[2];
    const params = new URLSearchParams(urlParts[1]);
    const username = params.get('username');

    if (!roomId || !username) {
      ws.close(4000, 'Room ID and Username required');
      return;
    }

    await handleUserJoin(ws, roomId, username, clients);

    ws.on('message', (message: string) => {
      handleMessage(ws, roomId, username, message.toString(), clients);
    });

    ws.on('close', () => {
      handleUserLeave(roomId, username, clients);
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
      handleUserLeave(roomId, username, clients);
    });
    
  } catch (err) {
    console.error('Connection error:', err);
    ws.close(4001, 'Internal server error');
  }
});

const startService = async (): Promise<void> => {
  try {
    await connectRedis();
    console.log('Room Service running on port 8080');
  } catch (err) {
    console.error('Service startup error:', err);
    process.exit(1);
  }
};

console.log('Service is starting...');
startService();