import mongoose from "mongoose";

class TestDbManager {
  private isConnected: boolean = false;

  async connect(): Promise<void> {
    if (this.isConnected || mongoose.connection.readyState === 1) {
      return;
    }

    const uri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-test";
    await mongoose.connect(uri);
    this.isConnected = true;
  }

  async clearDatabase(): Promise<void> {
    if (!mongoose.connection.db) {
      return;
    }

    const collections = await mongoose.connection.db.collections();

    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }

  async disconnect(): Promise<void> {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      this.isConnected = false;
    }
  }
}
export const testDbManager = new TestDbManager();
