import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GameService } from './game.service';

@ApiTags('game')
@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post('create-room')
  @ApiOperation({ summary: 'Create a new game room' })
  createRoom(@Body() body: { username: string }) {
    const code = this.gameService.createRoom('rest-user', body.username);
    console.log(`Room created via REST: ${code} by ${body.username}`);
    return { code, room: this.gameService.getRoom(code) };
  }

  @Get('room/:code')
  @ApiOperation({ summary: 'Get room details' })
  getRoom(@Param('code') code: string) {
    const room = this.gameService.getRoom(code);
    return room || { message: 'Room not found' };
  }
}
