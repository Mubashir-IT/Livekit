import { Router } from 'express';
import { createRoom, getRooms, deleteRoom, createToken, roomCreater, getRoomDetails } from '../controllers/roomController';
import authMiddleware from '../middlewares/authMiddleware';

const router = Router();
router.use(authMiddleware);

// get room creater
router.post('/getRoomCreater', roomCreater);

// Get room details
router.post('/getRoomDetails', getRoomDetails);

// Create a new room
router.post('/', createRoom);

// Get all rooms
router.get('/', getRooms);

// Delete a room
router.delete('/', deleteRoom);

// Create a token
router.post('/createToken', createToken);


export default router;