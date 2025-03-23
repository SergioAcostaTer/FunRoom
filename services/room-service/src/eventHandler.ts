import { WebSocket } from 'ws';
import { 
  publish, 
  getRoomQueue, 
  incrementUserCount, 
  getUserCount, 
  addRoomToActive, 
  removeRoomFromActive, 
  removeRoomFromUsers 
} from './redisClient';

export const handleUserJoin = async (
  ws: WebSocket,
  roomId: string,
  username: string,
  clients: Map<string, Map<string, WebSocket>>
): Promise<void> => {
  try {
    if (!clients.has(roomId)) {
      clients.set(roomId, new Map());
    }

    const roomClients = clients.get(roomId)!;
    if (roomClients.has(username)) {
      ws.close(4002, 'Username already connected in this room');
      return;
    }

    (ws as any).roomId = roomId;
    (ws as any).username = username;

    console.log(`Client ${username} joined room: ${roomId}`);
    roomClients.set(username, ws);
    await addRoomToActive(roomId);
    await incrementUserCount(roomId, 1);

    const [currentQueue] = await Promise.all([getRoomQueue(roomId)]);
    const initialState = {
      event: 'initial_state',
      data: {
        queue: currentQueue.map((item) => JSON.parse(item)),
        users: roomClients.size,
        username,
      },
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(initialState));
    }

    await publish(
      `room:${roomId}:updates`,
      JSON.stringify({
        event: 'user_count',
        data: { roomId, users: roomClients.size },
      })
    );
  } catch (err) {
    console.error('User join error:', err);
    ws.close(4001, 'Internal server error');
  }
};

export const handleUserLeave = async (
  roomId: string,
  username: string,
  clients: Map<string, Map<string, WebSocket>>
): Promise<void> => {
  try {
    const roomClients = clients.get(roomId);
    if (!roomClients) return;

    console.log(`Client ${username} left room: ${roomId}`);
    roomClients.delete(username);
    await incrementUserCount(roomId, -1);
    const userCount = Number(await getUserCount(roomId)) || 0;

    await publish(
      `room:${roomId}:updates`,
      JSON.stringify({
        event: 'user_count',
        data: { roomId, users: userCount },
      })
    );

    if (userCount <= 0) {
      clients.delete(roomId);
      await Promise.all([
        removeRoomFromActive(roomId),
        removeRoomFromUsers(roomId)
      ]);
    }
  } catch (err) {
    console.error('User leave error:', err);
  }
};