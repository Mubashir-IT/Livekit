import {
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import { DataTypes, Model, Optional, Sequelize } from "sequelize";
import { validateDto } from "../config/helpers";

interface RoomTokenAttributes {
  id: string;
  room_id: string;
  user_id: string;
  token: string;

  token_expire?: Date;
  token_expire_data?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

interface RoomTokenCreateAttributes
  extends Optional<
    RoomTokenAttributes,
    "id" | "token_expire" | "token_expire_data" | "createdAt" | "updatedAt"
  > {}

class RoomToken extends Model<RoomTokenAttributes, RoomTokenCreateAttributes> {
  @IsUUID(4)
  public id!: string;

  @IsNotEmpty()
  public room_id!: string;
  @IsNotEmpty()
  public user_id!: string;

  @IsNotEmpty()
  @IsString()
  public token!: string;

  @IsOptional()
  @IsDate()
  public token_expire?: Date;
  @IsOptional()
  @IsString()
  public token_expire_data?: string;
  @IsOptional()
  @IsDate()
  public createdAt?: Date;
  @IsOptional()
  @IsDate()
  public updatedAt?: Date;
  @IsOptional()
  @IsDate()
  public deletedAt?: Date;

  public static async validateCreateRoomToken(
    createRoomData: Partial<RoomToken>
  ) {
    const roomTokenInstance = new RoomToken();
    Object.assign(roomTokenInstance, createRoomData);
    await validateDto(roomTokenInstance);
  }
}
export default function initRoomToken(sequelize: Sequelize): typeof RoomToken {
  RoomToken.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      room_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "rooms", // Correct reference to the rooms table
          key: "id",
        },
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "users", // Reference to the users table
          key: "id",
        },
      },
      token: {
        type: DataTypes.STRING(500), 
        allowNull: false,
      },
      token_expire: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      token_expire_data: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "RoomToken",
      tableName: "room_tokens", // table name in the database
      paranoid: true, // Enable soft deletes (adds deletedAt timestamp)
    }
  );
  RoomToken.addHook("beforeCreate", async (roomToken: RoomToken) => {
    await RoomToken.validateCreateRoomToken(roomToken);
  });

  RoomToken.addHook("beforeUpdate", async (roomToken: RoomToken) => {
    await RoomToken.validateCreateRoomToken(roomToken);
  });
  return RoomToken;
}
