import { Server, WebSocket } from "ws";
import { createClient } from "redis";

const redisClient = createClient({ url: "redis://localhost:6379" });
const redisSubscriber = createClient({ url: "redis://localhost:6379" });

redisClient
  .connect()
  .catch((err) => console.error("Redis connection error:", err));
redisSubscriber
  .connect()
  .catch((err) => console.error("Redis subscriber connection error:", err));

const wss = new Server({ port: 8080 });
// Modified to store username with WebSocket
const clients = new Map<string, Map<string, WebSocket>>(); // roomId -> (username -> WebSocket)

wss.on("connection", async (ws: WebSocket, req: any) => {
  console.log(req.url);
  const params = new URLSearchParams(req.url?.split("?")[1]);
  console.log(params);
  const roomId = req.url?.split("/")[2].split("?")[0];
  const username = params.get("username");
  console.log(roomId, username);

  // Check for required parameters
  if (!roomId) {
    ws.close(4000, "Room ID required");
    return;
  }
  if (!username) {
    ws.close(4001, "Username required");
    return;
  }

  // Initialize room if it doesn't exist
  if (!clients.has(roomId)) {
    clients.set(roomId, new Map());
  }

  // Check if username is already connected in this room
  if (clients.get(roomId)!.has(username)) {
    ws.close(4002, "Username already connected in this room");
    return;
  }

  // Store roomId and username on the WebSocket object
  (ws as any).roomId = roomId;
  (ws as any).username = username;

  console.log(`Client ${username} joined room: ${roomId}`);

  // Add client to the room
  clients.get(roomId)!.set(username, ws);
  await redisClient.sAdd("active_rooms", roomId);
  await redisClient.hIncrBy("room_users", roomId, 1);

  const currentQueue = await redisClient.lRange(`room:${roomId}:queue`, 0, -1);
  ws.send(
    JSON.stringify({
      event: "initial_state",
      data: {
        queue: currentQueue.map((item) => JSON.parse(item)),
        users: clients.get(roomId)!.size,
        username: username,
      },
    })
  );

  await redisClient.publish(
    `room:${roomId}:updates`,
    JSON.stringify({
      event: "user_count",
      data: { roomId, users: clients.get(roomId)!.size },
    })
  );

  redisSubscriber.subscribe(`room:${roomId}:updates`, (msg: string) => {
    ws.send(msg);
  });

  ws.on("close", async () => {
    console.log(`Client ${username} left room: ${roomId}`);
    clients.get(roomId)!.delete(username);
    await redisClient.hIncrBy("room_users", roomId, -1);
    const userCount = Number(await redisClient.hGet("room_users", roomId));

    await redisClient.publish(
      `room:${roomId}:updates`,
      JSON.stringify({
        event: "user_count",
        data: { roomId, users: userCount },
      })
    );

    if (userCount <= 0) {
      clients.delete(roomId);
      await redisClient.sRem("active_rooms", roomId);
      await redisClient.hDel("room_users", roomId);
    }
  });
});

console.log("Room Service running on port 8080");
