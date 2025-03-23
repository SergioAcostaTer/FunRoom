import { createClient } from "redis";

const redisClient = createClient({ url: "redis://localhost:6379" });
const redisSubscriber = createClient({ url: "redis://localhost:6379" });

redisClient.on("error", (err) => console.error("Redis Client Error:", err));
redisSubscriber.on("error", (err) =>
  console.error("Redis Subscriber Error:", err)
);

export const connectRedis = async (): Promise<void> => {
  try {
    await Promise.all([redisClient.connect(), redisSubscriber.connect()]);
    console.log("Connected to Redis");
  } catch (err) {
    console.error("Redis connection error:", err);
    throw err;
  }
};

export const publish = async (
  channel: string,
  message: string
): Promise<number> => {
  return redisClient.publish(channel, message);
};

export const subscribe = async (
  channel: string,
  callback: (msg: string) => void
): Promise<void> => {
  await redisSubscriber.subscribe(channel, callback);
};

export const getRoomQueue = async (roomId: string): Promise<string[]> => {
  return redisClient.lRange(`room:${roomId}:queue`, 0, -1);
};

export const incrementUserCount = async (
  roomId: string,
  delta: number
): Promise<number> => {
  return redisClient.hIncrBy("room_users", roomId, delta);
};

export const getUserCount = async (roomId: string): Promise<string | null> => {
  return (await redisClient.hGet("room_users", roomId)) || "0";
};

export const addRoomToActive = async (roomId: string): Promise<number> => {
  return redisClient.sAdd("active_rooms", roomId);
};

export const removeRoomFromActive = async (roomId: string): Promise<number> => {
  return redisClient.sRem("active_rooms", roomId);
};

export const removeRoomFromUsers = async (roomId: string): Promise<number> => {
  return redisClient.hDel("room_users", roomId);
};
