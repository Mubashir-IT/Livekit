import sequelize from "./database";

const syncDatabase = async () => {
  try {
    await sequelize.sync({ logging: false, alter: true });
    console.log("All models were synchronized successfully.");
  } catch (error) {
    console.error("Error syncing database:", error);
  }
};

export default syncDatabase;
