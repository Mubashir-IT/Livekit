import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import roomRoutes from "./routes/roomRoutes";
import authRoutes from "./routes/authRoutes";
import sequelize from "./config/database";
import sync from "./config/sync";
import audioRoutes from "./routes/audioRoutes";
import translateRoutes from "./routes/translateRoutes";
import multer from "multer"; // Import multer for handling multipart/form-data
import bodyParser from "body-parser";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { DataTypes } from "sequelize";
import initUserModel from "./models/user";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
// LiveKit server SDK
import { RoomServiceClient, AccessToken } from "livekit-server-sdk";
import userRoutes from "./routes/userRoutes";

// Get current file path and directory using import.meta for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Add reference to custom types
/// <reference path="./types/express.d.ts" />

dotenv.config();

const port = process.env.PORT || 3000;

const app = express();
app.use(cors()); // Enable CORS for cross-origin requests

// Configure body parser with increased limits
app.use(
  bodyParser.json({
    limit: "50mb",
    verify: (req: express.Request, res: Response, buf: Buffer) => {
      req.rawBody = buf;
    },
  })
);

app.use(
  bodyParser.urlencoded({
    limit: "50mb",
    extended: true,
    parameterLimit: 100000,
  })
);

// Increase all relevant timeouts
app.use((req, res, next) => {
  req.socket.setKeepAlive(true);
  req.setTimeout(600000); // 10 minutes
  res.setTimeout(600000); // 10 minutes
  next();
});

// Middleware to handle file uploads (multipart/form-data)
const upload = multer(); // You can specify storage settings here if needed
// app.use(upload.any()); // Allows any form data to be parsed

// Custom middleware to handle `Accept` header
app.use((req, res, next) => {
  // console.log(req);

  // If the client accepts JSON response, set the response content type
  // if (req.headers['accept'] === 'application/json') {
  //   res.setHeader('Content-Type', 'application/json');
  //   console.log('Handling JSON response:', req.headers);
  // }

  next();
});

// Add error handling for aborted requests
app.use(((
  err: any,
  req: Request,
  res: Response,
  next: express.NextFunction
) => {
  if (err.name === "BadRequestError" && err.message === "request aborted") {
    return res.status(408).json({
      success: false,
      message: "Request timeout - please try with a smaller audio chunk",
    });
  }
  next(err);
}) as express.ErrorRequestHandler);

// Routes
const prefixApi = "/api/v1/";
app.use(`${prefixApi}room`, roomRoutes);
app.use(`${prefixApi}auth`, authRoutes);
app.use(`${prefixApi}audio`, audioRoutes);
app.use(`${prefixApi}translate`, translateRoutes);
app.use(`${prefixApi}user`, userRoutes);
//

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World from shahab");
});

// Create audio storage directory if it doesn't exist
const audioStoragePath = path.join(__dirname, "audio_storage");
if (!fs.existsSync(audioStoragePath)) {
  fs.mkdirSync(audioStoragePath);
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

// Serve static files from uploads folder
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Socket.IO server for WebRTC signaling
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// WebRTC signaling logic
// io.on("connection", (socket) => {
//   console.log(`[SOCKET] New connection: ${socket.id}`);
//   socket.on("join-room", ({ roomId, role }) => {
//     console.log(
//       `[SOCKET] join-room: socket=${socket.id}, roomId=${roomId}, role=${role}`
//     );
//     socket.join(roomId);
//     socket.data.role = role;
//     socket.data.roomId = roomId;
//     if (role === "listener") {
//       // Notify creator that a listener joined
//       const creatorSocket = Array.from(io.sockets.sockets.values()).find(
//         (s) => s.data.roomId === roomId && s.data.role === "creator"
//       );
//       if (creatorSocket) {
//         console.log(
//           `[SOCKET] Notifying creator ${creatorSocket.id} of new listener ${socket.id}`
//         );
//         creatorSocket.emit("listener-joined", { listenerId: socket.id });
//       }
//     }
//   });

//   socket.on("offer", ({ to, offer }) => {
//     console.log(`[SOCKET] offer: from=${socket.id}, to=${to}`);
//     io.to(to).emit("offer", { from: socket.id, offer });
//   });

//   socket.on("answer", ({ to, answer }) => {
//     console.log(`[SOCKET] answer: from=${socket.id}, to=${to}`);
//     io.to(to).emit("answer", { from: socket.id, answer });
//   });

//   socket.on("ice-candidate", ({ to, candidate }) => {
//     if (to) {
//       console.log(`[SOCKET] ice-candidate: from=${socket.id}, to=${to}`);
//       io.to(to).emit("ice-candidate", { from: socket.id, candidate });
//     } else {
//       // If no 'to', broadcast to room except sender
//       console.log(
//         `[SOCKET] ice-candidate: from=${socket.id}, broadcast to room ${socket.data.roomId}`
//       );
//       socket
//         .to(socket.data.roomId)
//         .emit("ice-candidate", { from: socket.id, candidate });
//     }
//   });

//   socket.on("disconnect", () => {
//     console.log(`[SOCKET] disconnect: ${socket.id}`);
//     // Optionally notify room of disconnect
//   });
// });

// LiveKit config (replace with your actual keys and URL)
const LIVEKIT_HOST = process.env.LIVEKIT_HOST || 'wss://test-tago-bits-hi4jwi9r.livekit.cloud';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'APIP4LSThjgmLnt';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '79V1j69hGbR2qcZpnEmMOjA5ePA9aJcgu29Zi7EVKkL';

// LiveKit RoomServiceClient instance
const livekitRoomService = new RoomServiceClient(
  LIVEKIT_HOST,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET
);

// Example endpoint: create a LiveKit room
app.post(
  "/api/v1/livekit/create-room",
  async (req: Request, res: Response) => {
    const { name, emptyTimeout = 600, maxParticipants = 20 } = req.body;
    try {
      const room = await livekitRoomService.createRoom({
        name,
        emptyTimeout,
        maxParticipants,
      });
      res.json({ success: true, room });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || "Failed to create room",
      });
    }
  }
);

// Example endpoint: list LiveKit rooms
app.get("/api/v1/livekit/rooms", async (req: Request, res: Response) => {
  try {
    const rooms = await livekitRoomService.listRooms();
    res.json({ success: true, rooms });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err?.message || "Failed to list rooms",
    });
  }
});

// LiveKit token endpoint for frontend (no auth required)
app.post('/api/v1/livekit/token', async (req, res) => {
  const { roomId, userId } = req.body;
  if (!roomId || !userId) {
    return res.status(400).json({ success: false, message: 'Missing roomId or userId' });
  }
  try {
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY || "",
      process.env.LIVEKIT_API_SECRET || "",
      {
        identity: userId,
        ttl: "10m",
      }
    );
    at.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canSubscribe: true,
    });
    const token = await at.toJwt();
    res.json({
      success: true,
      token,
      wsUrl: process.env.LIVEKIT_HOST || 'wss://test-tago-bits-hi4jwi9r.livekit.cloud'
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ success: false, message: 'Unknown error' });
    }
  }
});

// Start the server
async function startServer() {
  try {
    // Authenticate database connection first
    await sequelize.authenticate();
    console.log("Database connection established");

    // Run migrations manually instead of using Umzug
    // We'll check if the language column exists, and if not, add it
    const queryInterface = sequelize.getQueryInterface();
    try {
      // Check if the language column already exists to avoid errors
      const tableInfo = await queryInterface.describeTable("users");
      if (!tableInfo.status) {
        console.log("Adding language column to users table...");
        await queryInterface.addColumn("users", "status", {
          type: DataTypes.STRING,
          defaultValue: "offline",
          allowNull: false,
        });
        console.log("Language column added successfully");
      } else {
        console.log("Language column already exists in users table");
      }
      if (!tableInfo.language) {
        console.log("Adding language column to users table...");
        await queryInterface.addColumn("users", "language", {
          type: DataTypes.STRING,
          defaultValue: "en-US",
          allowNull: false,
        });
        console.log("Language column added successfully");
      } else {
        console.log("Language column already exists in users table");
      }
    } catch (migrationError) {
      console.error("Migration error:", migrationError);
      // If the users table doesn't exist yet, sequelize.sync will create it below
    }

    // Sync database models
    await sequelize.sync({ alter: false });
    console.log("Database synchronized");

    initUserModel(sequelize); //------------
    // io.on("connection", (socket) => {
    //   socket.on("joinRoom", (roomId) => {
    //     socket.join(roomId);
    //   });

    //   socket.on("caption", ({ roomId, caption }) => {
    //     // Broadcast to everyone in the room except sender
    //     socket.to(roomId).emit("caption", caption);
    //   });
    // });

    httpServer.listen(+port, "0.0.0.0", () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
