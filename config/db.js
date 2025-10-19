import mongoose from "mongoose";
import colors from "colors";
import { MongoMemoryServer } from "mongodb-memory-server";
import { populate } from "./populateDb.js";

let mongoServer;

const connectDB = async () => {
    try {
        if (process.env.NODE_ENV === "test") {
            mongoServer = await MongoMemoryServer.create();
            console.log("CREATED MEMORty TSERyER")
            const uri = mongoServer.getUri();
            await mongoose.connect(uri);
            await populate();
            return;
        }
        const conn = await mongoose.connect(process.env.MONGO_URL);
        console.log(`Connected To Mongodb Database ${conn.connection.host}`.bgMagenta.white);
    } catch (error) {
        console.log(`Error in Mongodb ${error}`.bgRed.white);
    }
};

export const clearAndRepopulateDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
    await populate();
    console.log("🧹 Cleared and re-seeded in-memory MongoDB");
  }
};

export default connectDB;
