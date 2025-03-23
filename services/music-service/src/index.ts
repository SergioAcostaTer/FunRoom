import express, { Request, Response } from 'express';
import { createClient } from 'redis';

const app = express();
const redisClient = createClient({ url: 'redis://redis:6379' });
redisClient.connect().catch(err => console.error('Redis connection error:', err));

app.use(express.json());

async function queueSongByTitle(roomId: string, songTitle: string): Promise<{ id: string; name: string }> {
  const trackData = { id: `${songTitle}-id`, name: songTitle };
  await redisClient.lPush(`room:${roomId}:queue`, JSON.stringify(trackData));
  await redisClient.publish(`room:${roomId}:updates`, JSON.stringify({
    event: 'queue_updated',
    data: trackData
  }));
  return trackData;
}

app.post('/queue', async (req: Request, res: Response) => {
  const { roomId, title } = req.body as { roomId: string; title: string };
  try {
    const track = await queueSongByTitle(roomId, title);
    res.json({ message: `Queued: ${track.name}` });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.listen(3001, () => console.log('Music Service on 3001'));