import dotenv from "dotenv";
import { Sequelize } from "sequelize";
import initUserModel from "../models/user";
import initRoomModel from "../models/room";
import initRoomToken from "../models/roomToken";

dotenv.config();

// Create a new Sequelize instance with database configurations
const sequelize = new Sequelize(
  process.env.DB_NAME || "default_db_name",
  process.env.DB_USER || "default_db_user",
  process.env.DB_PASSWORD || "",
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    logging: false,
    define: {
      timestamps: true,
    },
  }
);

// Initialize models

const User = initUserModel(sequelize);
const Room = initRoomModel(sequelize);
const RoomToken = initRoomToken(sequelize);

Room.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

User.hasMany(Room, {
  foreignKey: "user_id",
  as: "rooms",
});

// room relationship
RoomToken.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

User.hasMany(RoomToken, {
  foreignKey: "user_id",
  as: "room_tokens",
});
Room.hasMany(RoomToken, {
  foreignKey: "room_id",
  as: "room_tokens",
});

RoomToken.belongsTo(Room, {
  foreignKey: "room_id",
  as: "room",
});

// Export models and sequelize instance
export { sequelize, User, Room, RoomToken };
export default sequelize;
