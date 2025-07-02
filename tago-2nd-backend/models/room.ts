import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";
import { DataTypes, Model, Optional, Sequelize } from "sequelize";
import { validateDto } from "../config/helpers";
import { RoomStatus } from "../config/type";



interface enabledCodecsAttributes {
    mime:string;
    fmtpLine:string;
}

  
interface RoomAttributes {
    id: string;
    sid:string;
    name: string;
    emptyTimeout:number;
    maxParticipants:number;
    creationTime:string | Date;
    turnPassword: string;
    enableCodecs: enabledCodecsAttributes[] | string;
    metadata: string;
    numParticipants: number;
    activeRecording: boolean;
    numPublishers: number;
    version:string | {
        unixMicro:string;
        ticks:number;
    }
    departureTimeout:number;
    creationTimeMs: Date | string;
    user_id:string;
    status:RoomStatus;

}


interface RoomCreationAttributes extends Optional<RoomAttributes ,"id"|"status">{}

class Room extends Model <RoomAttributes,RoomCreationAttributes> {
    @IsUUID('4')
    public id!: string;
    @IsString()
    @IsNotEmpty()
    public name!:string;
    
    @IsInt()
    @IsNotEmpty()
    public emptyTimeout!:number;
    
    @IsInt()
    @IsNotEmpty()
    public maxParticipants !:number;
    
    @IsString()
    @IsNotEmpty()
    public creationTime !: string | Date;

    @IsOptional()
    @IsString()
    public turnPassword ?: string;
    
    @IsString()
    @IsNotEmpty()
    public enableCodecs !: string;

    @IsOptional()
    @IsString()
    public metadata ?: string;

    @IsInt()
    @IsNotEmpty()
    public numParticipants !:number;

    @IsBoolean()
    public activeRecording !:boolean;

    @IsInt()
    @IsNotEmpty()
    public numPublishers !:number;

    @IsNotEmpty()
    public version !: string | object;

    @IsInt()
    @IsNotEmpty()
    public departureTimeout !: number;
    
    @IsString()
    @IsNotEmpty()
    public creationTimeMs !: string | Date;

    @IsNotEmpty()
    public user_id !: string;

    @IsEnum(RoomStatus)
    status?: RoomStatus; 

    public static async validateRoom(roomData:Partial<Room>) {
        const roomInstance = new Room();
        Object.assign(roomInstance,roomData);
        await validateDto(roomInstance)
    }
}

export default function initRoomModel(sequelize:Sequelize):typeof Room{
    Room.init(
        {
        id:{
            type:DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        sid: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        emptyTimeout: {
            type: DataTypes.INTEGER,
            defaultValue: 600,
        },
        maxParticipants: {
            type: DataTypes.INTEGER,
            defaultValue: 20,
        },
        
        creationTime: {
            type: DataTypes.STRING, // Unix timestamp as string
            allowNull: false,
        },
        turnPassword: {
            type: DataTypes.STRING,
            defaultValue: '',
        },
        enableCodecs: {
            type: DataTypes.STRING,
            defaultValue: '',
        },
        metadata: {
            type: DataTypes.STRING,
            defaultValue: '',
        },
        numParticipants: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        activeRecording: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        numPublishers: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        version: {
            type: DataTypes.JSON, // Storing version as a JSON object
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users', // name of the user table
                key: 'id', // the primary key column in the user table
            },
        },
        status:{
            type:DataTypes.ENUM(...Object.values(RoomStatus)),
            allowNull:false,
            defaultValue:RoomStatus.ACTIVE
        },
        departureTimeout: {
            type: DataTypes.INTEGER,
            defaultValue: 20,
        },
        creationTimeMs: {
            type: DataTypes.STRING, // Unix timestamp in milliseconds
            allowNull: false,
        },
        
    }, 
    {
        sequelize,
        modelName: 'Room',
        tableName: 'rooms', // table name in the database
        paranoid: true, // Enable soft deletes (adds deletedAt timestamp)
    });
    Room.addHook('beforeCreate', async (user: Room) => {
        await Room.validateRoom(user);
      });
    
      Room.addHook('beforeUpdate', async (user: Room) => {
        await Room.validateRoom(user);
      });
    return Room;
}