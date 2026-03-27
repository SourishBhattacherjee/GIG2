import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly gameService: GameService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    const result = this.gameService.leaveRoom(client.id);
    if (result) {
      const { roomCode, room } = result;
      this.server.to(roomCode).emit('room-update', room);
    }
  }

  @SubscribeMessage('create-room')
  handleCreateRoom(client: Socket, payload: { username: string }) {
    const code = this.gameService.createRoom(client.id, payload.username);
    console.log(`Room created: ${code} by ${payload.username}`);
    client.join(code);
    const room = this.gameService.getRoom(code);
    client.emit('room-created', { code, room });
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(
    client: Socket,
    payload: { roomCode: string; username: string },
  ) {
    const room = this.gameService.joinRoom(
      payload.roomCode,
      client.id,
      payload.username,
    );
    if (room) {
      client.join(payload.roomCode);
      this.server.to(payload.roomCode).emit('room-update', room);
      client.emit('join-success', room);
    } else {
      client.emit('error', { message: 'Room not found' });
    }
  }

  @SubscribeMessage('start-game')
  handleStartGame(client: Socket, payload: { roomCode: string }) {
    const room = this.gameService.startGame(payload.roomCode);
    if (room) {
      this.broadcastRoomUpdate(payload.roomCode);
    } else {
      client.emit('error', { message: 'Cannot start game' });
    }
  }

  @SubscribeMessage('draw')
  handleDraw(client: Socket, payload: { roomCode: string; data: any }) {
    client.to(payload.roomCode).emit('draw', payload.data);
  }

  @SubscribeMessage('clear-canvas')
  handleClearCanvas(client: Socket, payload: { roomCode: string }) {
    this.server.to(payload.roomCode).emit('clear-canvas');
  }

  @SubscribeMessage('send-message')
  handleMessage(
    client: Socket,
    payload: { roomCode: string; message: string; username: string },
  ) {
    const isCorrect = this.gameService.checkGuess(
      payload.roomCode,
      client.id,
      payload.message,
    );

    if (isCorrect) {
      this.server.to(payload.roomCode).emit('new-message', {
        username: 'System',
        message: `${payload.username} guessed the word!`,
      });
      // Start new round after successful guess
      const room = this.gameService.getRoom(payload.roomCode);
      if (room) {
        this.gameService.startNewRound(room);
        this.broadcastRoomUpdate(payload.roomCode);
      }
    } else {
      this.server.to(payload.roomCode).emit('new-message', {
        username: payload.username,
        message: payload.message,
      });
    }
  }

  private broadcastRoomUpdate(roomCode: string) {
    const room = this.gameService.getRoom(roomCode);
    if (!room) return;

    room.players.forEach((player) => {
      const isDrawer = player.id === room.currentDrawerId;
      const sanitizedRoom = {
        ...room,
        currentWord: isDrawer ? room.currentWord : null,
        wordLength: room.currentWord?.length || 0,
      };
      this.server.to(player.id).emit('room-update', sanitizedRoom);
    });
  }
}
