import { Injectable } from '@nestjs/common';

export interface Player {
  id: string;
  username: string;
  score: number;
}

export interface Room {
  code: string;
  players: Player[];
  currentDrawerId: string | null;
  currentWord: string | null;
  isStarted: boolean;
}

@Injectable()
export class GameService {
  private rooms: Map<string, Room> = new Map();

  createRoom(creatorId: string, username: string): string {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room: Room = {
      code,
      players: [{ id: creatorId, username, score: 0 }],
      currentDrawerId: null,
      currentWord: null,
      isStarted: false,
    };
    this.rooms.set(code, room);
    return code;
  }

  joinRoom(code: string, playerId: string, username: string): Room | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    if (room.players.find((p) => p.id === playerId)) return room;

    room.players.push({ id: playerId, username, score: 0 });
    return room;
  }

  private words = [
    'apple',
    'banana',
    'car',
    'dog',
    'elephant',
    'fish',
    'guitar',
    'house',
    'island',
    'jacket',
  ];

  getRoom(code: string): Room | null {
    return this.rooms.get(code) || null;
  }

  leaveRoom(playerId: string): { roomCode: string; room: Room } | null {
    for (const [code, room] of this.rooms.entries()) {
      const playerIndex = room.players.findIndex((p) => p.id === playerId);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        if (room.players.length === 0) {
          this.rooms.delete(code);
          return null;
        }
        // If drawer leaves, reset round or pick new drawer
        if (room.currentDrawerId === playerId) {
          this.startNewRound(room);
        }
        return { roomCode: code, room };
      }
    }
    return null;
  }

  startGame(code: string): Room | null {
    const room = this.rooms.get(code);
    if (!room || room.players.length < 2) return null;

    room.isStarted = true;
    this.startNewRound(room);
    return room;
  }

  startNewRound(room: Room) {
    if (room.players.length === 0) return;
    const drawerIndex = Math.floor(Math.random() * room.players.length);
    room.currentDrawerId = room.players[drawerIndex].id;
    room.currentWord = this.words[Math.floor(Math.random() * this.words.length)];
  }

  checkGuess(code: string, playerId: string, guess: string): boolean {
    const room = this.rooms.get(code);
    if (!room || !room.currentWord || !room.isStarted) return false;
    if (room.currentDrawerId === playerId) return false;

    if (guess.toLowerCase().trim() === room.currentWord.toLowerCase()) {
      const player = room.players.find((p) => p.id === playerId);
      if (player) {
        player.score += 10;
        return true;
      }
    }
    return false;
  }
}
