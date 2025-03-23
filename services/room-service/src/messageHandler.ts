import { WebSocket } from 'ws';

interface MessageData {
  event: string;
  data: {
    message?: string;
    [key: string]: any;
  };
}

export const handleMessage = (
  ws: WebSocket,
  roomId: string,
  username: string,
  message: string,
  clients: Map<string, Map<string, WebSocket>>
): void => {
  try {
    const msgData: MessageData = JSON.parse(message);

    switch (msgData.event) {
      case 'send_message':
        if (msgData.data.message) {
          sendMessageToRoom(roomId, username, msgData.data.message, clients);
        }
        break;
      case 'start_spotify_room':
        startSpotifyRoom(roomId, username, clients);
        break;
      default:
        console.log(`Unhandled event: ${msgData.event}`);
    }
  } catch (err) {
    console.error('Message handling error:', err);
    ws.send(JSON.stringify({ event: 'error', data: { message: 'Invalid message format' } }));
  }
};

const sendMessageToRoom = (
  roomId: string,
  username: string,
  message: string,
  clients: Map<string, Map<string, WebSocket>>
): void => {
  const chatMessage = {
    event: 'chat_message',
    data: { username, message },
  };

  const roomClients = clients.get(roomId);
  if (roomClients) {
    roomClients.forEach((clientWs: WebSocket) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(chatMessage));
      }
    });
  }
};

const startSpotifyRoom = (
  roomId: string,
  username: string,
  clients: Map<string, Map<string, WebSocket>>
): void => {
  const spotifyEvent = {
    event: 'spotify_room_started',
    data: { message: `Spotify group room started by ${username}` },
  };

  const roomClients = clients.get(roomId);
  if (roomClients) {
    roomClients.forEach((clientWs: WebSocket) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(spotifyEvent));
      }
    });
  }
};