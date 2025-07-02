import { Request, response, Response } from "express";
import { RoomServiceClient, AccessToken } from "livekit-server-sdk";
import { Room, RoomToken, User } from "../config/database";
import { customErrorReponse, isCustomError } from "../config/helpers";

const livekitHost = "wss://test-tago-bits-hi4jwi9r.livekit.cloud";
const roomService = new RoomServiceClient(
  livekitHost,
  process.env.LIVEKIT_API_KEY || "",
  process.env.LIVEKIT_API_SECRET || ""
);

const getTokenLiveKit = async (
  participantName: string,
  roomName: string
): Promise<any> => {
  try {
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY || "",
      process.env.LIVEKIT_API_SECRET || "",
      {
        identity: participantName || "anonymous",
        ttl: "10m",
      }
    );

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    return {
      success: true,
      token: token,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
};

export const createRoom = async (req: Request, res: Response): Promise<any> => {
  try {
  const { roomName, goRoom } = req.body;

    if (!roomName) {
      res
        .status(403)
        .json({ success: "false", message: "The Room Name field is required" });
      return;
    }
    const userId = req.user.id;
    console.log('User ID from token:', userId); // Debug log

    // Check if user exists before proceeding
    const userExists = await User.findByPk(userId);
    if (!userExists) {
      console.error('User not found in DB:', userId); // Debug log
      return res.status(400).json({ success: false, message: "User does not exist. Cannot create room.", userId });
    }

    const opts = {
      name: roomName,
      emptyTimeout: 30 * 60,
      maxParticipants: 20,
      metadata: userId,
    };

    const room = await roomService.createRoom(opts);

    const roomData = await {
      sid: room.sid,
      name: room.name,
      emptyTimeout: room.emptyTimeout,
      maxParticipants: room.maxParticipants,
      creationTime: String(room.creationTime) || "",
      turnPassword: room.turnPassword || "",
      enableCodecs: JSON.stringify(room.enabledCodecs || []), // Convert array to JSON string
      metadata: room.metadata || "",
      numParticipants: room.numParticipants || 0,
      activeRecording: room.activeRecording || false,
      numPublishers: room.numPublishers || 0,
      version: JSON.stringify(room.version || {}), // Convert object to JSON string
      departureTimeout: room.departureTimeout || 20,
      creationTimeMs: String(room.creationTimeMs) || "",
      user_id: userId,
    };

    // console.log('room',roomData)
    await Room.validateRoom(roomData);
    console.log("validation passed");
    let roomId;
   try{
     const alreadyExistSid = await Room.findOne({
       where: { sid: roomData.sid },
     });
     if (!alreadyExistSid) {
       const roomNewRow = await Room.create(roomData);
       roomId = roomNewRow.id;
     } else {
       roomId = alreadyExistSid.id;
     }

   }catch(error:any){
    console.log("error", error);
   }
    if (goRoom) {
      try {

        const tokenData = await getTokenLiveKit(req.user.name, roomData.name); // Pass the same req and res to createToken
        // console.log("shahab", tokenData);
        if (!tokenData.success) {
          return res.status(400).json({
            success: false,
            tokenMessage: tokenData.message,
            token: false,
            roomCreate: true,
            roomMessage: "Room Create succefully",
          });
        } // Ensure the response is sent immediately after creating the token
        await RoomToken.create({
          token: tokenData.token,
          room_id: roomId || "",
          user_id: userId,
        });
        return res.status(200).json({ success: true, token: tokenData.token });
      } catch (error: any) {
        console.log("error", error);
        if (isCustomError(error)) {
          return customErrorReponse(error, res);
        }
        res.status(500).json({ success: false, message: error.message });
      }
    }
    res.status(201).json({ success: true, room });
  } catch (error: any) {
    if (isCustomError(error)) {
      return customErrorReponse(error, res);
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRooms = async (req: Request, res: Response): Promise<any> => {
  try {
    // console.log('Fetching rooms for user:', req.user.id); // Debug log
    const rooms = await Room.findAll({
      // where: { user_id: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    res.status(200).json({ success: true, rooms });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteRoom = async (req: Request, res: Response): Promise<any> => {
  try {
    const { roomName } = req.body;
    if (!roomName) {
      res
        .status(403)
        .json({ success: "false", message: "The Room Name field is required" });
      return;
    }
    console.log('room Name',roomName);

    const room = await Room.findOne({
      where: {
        name: roomName,
        user_id: req.user.id,
      },
      paranoid: false, // This will include soft-deleted rows in the result
    });
    
    await Room.destroy({
      where: {
        name: roomName,
        user_id: req.user.id,
      },
    });
    try{

      await roomService.deleteRoom(roomName);
    }catch(error:any){
      return res.status(500).json({ success: false, message: error.message,deleteDatabase:'Delete from our database succefully' });
    }
    console.log("room deleted both side our databas and livekit", room);
    
    res
      .status(200)
      .json({ success: true, message: "Room deleted successfully" });
  } catch (error: any) {
    if (isCustomError(error)) {
      return customErrorReponse(error, res);
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createToken = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { roomName, participantName } = req.body;

    console.log("req.user.name", req.user.name);

    const tokenData = await getTokenLiveKit(req.user.name, roomName);
    
    if (!tokenData.success) {
      return res
        .status(400)
        .json({ success: false, message: tokenData.message });
    }

    const findRoomInDB = await Room.findOne({
      where: { name: roomName },
    });
    const userId = req.user.id;
    if (findRoomInDB) {
      await RoomToken.create({
        token: tokenData.token,
        room_id: findRoomInDB.id,
        user_id: userId,
      });
    }
    res.status(200).json({ success: true, token: tokenData.token });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};


export const roomCreater = async (req: Request, res: Response): Promise<any> => {
  const { roomSid } = req.body;
  console.log('roomSid',roomSid);
  try {
    const room = await Room.findOne({
      where: {
        sid: roomSid,
        user_id: req.user.id,
      },
    });
    if (room) {
      res
        .status(200)
        .json({ success: true, message: "Room Creator", roomCreater: true });
    } else {
      res
        .status(200)
        .json({ success: true, message: "Not Room Creator", roomCreater: false });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add new function to get room details
export const getRoomDetails = async (req: Request, res: Response): Promise<any> => {
  const { roomSid } = req.body;
  
  if (!roomSid) {
    return res.status(400).json({ 
      success: false, 
      message: "Room SID is required" 
    });
  }
  
  try {
    // First check local database
    const roomFromDb = await Room.findOne({
      where: {
        sid: roomSid
      },
      attributes: [
        'id', 'sid', 'name', 'emptyTimeout', 'maxParticipants', 
        'creationTime', 'numParticipants', 'metadata', 'user_id'
      ]
    });
    
    if (!roomFromDb) {
      return res.status(404).json({ 
        success: false, 
        message: "Room not found" 
      });
    }
    
    // Get live data from LiveKit service if available
    let liveRoomData = null;
    try {
      // Try to get updated information from LiveKit
      const liveRooms = await roomService.listRooms();
      liveRoomData = liveRooms.find(r => r.sid === roomSid);
    } catch (liveKitError) {
      console.error("LiveKit service error:", liveKitError);
      // We continue with database data if LiveKit service is unavailable
    }
    
    // Combine database and live data, with live data taking precedence
    const roomData = {
      ...roomFromDb.get({ plain: true }),
      // Override with live data if available
      ...(liveRoomData ? {
        numParticipants: liveRoomData.numParticipants,
        emptyTimeout: liveRoomData.emptyTimeout,
        maxParticipants: liveRoomData.maxParticipants,
        activeRecording: liveRoomData.activeRecording
      } : {})
    };
    
    res.status(200).json({ 
      success: true, 
      room: roomData
    });
  } catch (error: any) {
    console.error("Error fetching room details:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to fetch room details" 
    });
  }
};

// export const deleteAllUserRooms = async (req: Request, res: Response): Promise<any> => {
//   try {
//     const userId = req.user.id;
//     // Delete all rooms for the current user
//     await Room.destroy({
//       where: { user_id: userId },
//       // paranoid: false // Uncomment if using soft deletes and want to hard delete
//     });
//     res.status(200).json({ success: true, message: "All rooms deleted for the current user." });
//   } catch (error: any) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };
