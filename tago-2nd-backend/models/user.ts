import { DataTypes, Model, Sequelize, Optional } from "sequelize";
import bcrypt from "bcrypt";
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsUUID,
  MinLength,
  validate,
} from "class-validator";
import { validateDto } from "../config/helpers";

// Define the attributes for the User model
interface UserAttributes {
  id: string;
  name: string;
  email: string;
  password: string;
  isAdmin: boolean;
  phoneNo: string;
  language: string;
  status: string; // online, offline, etc.
  otp?: string | null; // Optional field
  verifiedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null; // For soft deletes
  imageUrl?: string | null;

}

// Define the creation attributes for the User model
interface UserCreationAttributes
  extends Optional<
    UserAttributes,
    | "id"
    | "isAdmin"
    | "language"
    | "otp"
    | "createdAt"
    | "updatedAt"
    | "deletedAt"
    | "verifiedAt"
    | "imageUrl"
  > {}

// Extend the Sequelize Model class
class User extends Model<UserAttributes, UserCreationAttributes> {
  @IsUUID("4", { message: "Invalid UUID format" })
  public id!: string;
  @IsString({ message: "Name field must be string" })
  @IsNotEmpty({ message: "Name is required" })
  public name!: string;
  @IsString({ message: "Email field must be string" })
  @IsNotEmpty({ message: "Email is required" })
  @IsEmail({}, { message: "Invalid email format" })
  public email!: string;
  @IsString({ message: "password field must be string" })
  @IsNotEmpty({ message: "password is required" })
  @MinLength(6, { message: "Password must be at least 6 characters long" })
  public password!: string;
  @IsBoolean()
  public isAdmin!: boolean;
  @IsOptional()
  @IsString()
  public otp!: string | null;

  @IsString()
  @IsNotEmpty()
  public phoneNo!: string;
  @IsOptional()
  @IsString()
  public language!: string;
  @IsOptional()
  @IsDate()
  public verifiedAt!: Date | null;
  @IsEnum(["online", "offline"])
  status!: "online" | "offline";
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date | null;
  @IsOptional()
  @IsString()
  public imageUrl?: string | null;

  // Method to check password validity
  public async isValidPassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.getDataValue("password"));
  }

  // Hook to hash the password before saving
  public static async hashPassword(user: User): Promise<void> {
    if (user.changed("password")) {
      user.setDataValue(
        "password",
        await bcrypt.hash(user.getDataValue("password"), 10)
      );
    }
  }

  public static async validateUser(userData: Partial<User>) {
    // Convert the data to a plain instance of User
    const userInstance = new User();
    Object.assign(userInstance, userData);

    await validateDto(userInstance);
  }
}

// Initialize the User model
export default function initUserModel(sequelize: Sequelize): typeof User {
  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      isAdmin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      phoneNo: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      language: {
        type: DataTypes.STRING,
        defaultValue: "en-US",
        allowNull: false,
      },
      otp: {
        type: DataTypes.STRING,
        defaultValue: null,
        allowNull: true, // Can be null if not yet verified
      },
      verifiedAt: {
        type: DataTypes.DATE,
        defaultValue: null,
        allowNull: true, // Can be null if not yet verified
      },
      status: {
        type: DataTypes.ENUM("online", "offline"),
        defaultValue: "offline",
        allowNull: false,
      },
      imageUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      sequelize,
      modelName: "User",
      tableName: "users",
      hooks: {
        beforeSave: User.hashPassword, // Hook to hash password before saving
      },
      paranoid: true, // Enable soft deletes (adds deletedAt timestamp)
    }
  );
  User.addHook("beforeCreate", async (user: User) => {
    await User.validateUser(user);
  });

  User.addHook("beforeUpdate", async (user: User) => {
    await User.validateUser(user);
  });

  return User;
}
