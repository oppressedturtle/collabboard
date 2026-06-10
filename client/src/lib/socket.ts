import { io, type Socket } from 'socket.io-client';

let _socket: Socket | null = null;

/** Get (or lazily create) the singleton Socket.io client. */
export function getSocket(): Socket {
  if (!_socket) {
    // withCredentials sends the httpOnly access_token cookie on the WS
    // upgrade handshake — no need to pass the token manually.
    _socket = io({
      path: '/socket.io',
      withCredentials: true,
      autoConnect: false,
    });
  }
  return _socket;
}
