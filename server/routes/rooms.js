import express from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/rooms/create - Create a new game room
router.post('/create', async (req, res) => {
  try {
    const roomId = `ROOM-${Math.floor(1000 + Math.random() * 9000)}`;
    const hostKey = crypto.randomBytes(32).toString('hex');

    const defaultTableState = {
      deck: [],
      players: [],
      status: 'waiting'
    };

    const newRoom = await prisma.room.create({
      data: {
        roomId,
        hostKey,
        tableState: defaultTableState,
      },
    });

    return res.status(201).json({
      success: true,
      roomId: newRoom.roomId,
      hostKey: newRoom.hostKey,
      createdAt: newRoom.createdAt
    });
  } catch (error) {
    console.error('Error creating room:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;