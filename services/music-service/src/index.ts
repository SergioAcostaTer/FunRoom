import express, { Request, Response } from 'express';
import { createClient } from 'redis';
import cors from 'cors';

const app = express();
const redisClient = createClient({ url: 'redis://localhost:6379' });
redisClient.connect().catch(err => console.error('Redis connection error:', err));


app.use(cors());

app.use(express.json());

async function queueSongByTitle(roomId: string, songTitle: string): Promise<{ id: string; name: string }> {
  const trackData = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: songTitle };
  await redisClient.lPush(`room:${roomId}:queue`, JSON.stringify(trackData));
  await redisClient.publish(`room:${roomId}:updates`, JSON.stringify({
    event: 'song_added',
    data: trackData
  }));
  return trackData;
}

async function getQueue(roomId: string): Promise<any[]> {
  const queue = await redisClient.lRange(`room:${roomId}:queue`, 0, -1);
  return queue.map(item => JSON.parse(item));
}

async function clearQueue(roomId: string): Promise<void> {
  await redisClient.del(`room:${roomId}:queue`);
  await redisClient.publish(`room:${roomId}:updates`, JSON.stringify({ event: 'queue_cleared' }));
}

async function getActiveRooms(): Promise<{ roomId: string; users: number }[]> {
  const rooms = await redisClient.sMembers('active_rooms');
  const roomData = await Promise.all(rooms.map(async (roomId) => ({
    roomId,
    users: Number(await redisClient.hGet('room_users', roomId)) || 0
  })));
  return roomData.filter(room => room.users > 0);
}

app.post('/queue', async (req: Request, res: Response) => {
  const { roomId, title } = req.body;
  if (!roomId || !title) return res.status(400).json({ error: 'roomId and title are required' });
  try {
    const track = await queueSongByTitle(roomId, title);
    res.json({ message: `Queued: ${track.name}`, track });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/queue/:roomId', async (req: Request, res: Response) => {
  try {
    const queue = await getQueue(req.params.roomId);
    res.json({ queue });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.delete('/queue/:roomId', async (req: Request, res: Response) => {
  try {
    await clearQueue(req.params.roomId);
    res.json({ message: 'Queue cleared' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/rooms', async (req: Request, res: Response) => {
  try {
    const rooms = await getActiveRooms();
    res.json({ rooms });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.listen(3001, () => console.log('Music Service on 3001'));