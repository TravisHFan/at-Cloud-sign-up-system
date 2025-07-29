import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

class TestDbManager {
  private mongod?: MongoMemoryServer;

  async connect(): Promise<void> {
    if (this.mongod) {
      return;
    }

    this.mongod = await MongoMemoryServer.create();
    const uri = this.mongod.getUri();

    await mongoose.connect(uri);
  }

  async clearDatabase(): Promise<void> {
    if (!mongoose.connection.db) {
      return;
    }

    const collections = mongoose.connection.db.collections();

    for (const collection of await collections) {
      await collection.deleteMany({});
    }
  }

  async disconnect(): Promise<void> {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    if (this.mongod) {
      await this.mongod.stop();
      this.mongod = undefined;
    }
  }
}

export const testDbManager = new TestDbManager();
