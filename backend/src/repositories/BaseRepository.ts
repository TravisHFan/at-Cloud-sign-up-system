/**
 * Base Repository Interface
 * Implements Repository Pattern for data access abstraction
 * Follows Dependency Inversion Principle
 */

import mongoose, { Document, Model, FilterQuery, UpdateQuery } from "mongoose";

export interface IRepository<T extends Document> {
  create(data: Partial<T>): Promise<T>;
  findById(id: string): Promise<T | null>;
  findOne(filter: FilterQuery<T>): Promise<T | null>;
  findMany(filter: FilterQuery<T>, options?: QueryOptions): Promise<T[]>;
  update(id: string, data: UpdateQuery<T>): Promise<T | null>;
  updateMany(filter: FilterQuery<T>, data: UpdateQuery<T>): Promise<number>;
  delete(id: string): Promise<boolean>;
  deleteMany(filter: FilterQuery<T>): Promise<number>;
  count(filter: FilterQuery<T>): Promise<number>;
  exists(filter: FilterQuery<T>): Promise<boolean>;
}

export interface QueryOptions {
  sort?: Record<string, 1 | -1>;
  limit?: number;
  skip?: number;
  populate?: string | string[];
  select?: string;
}

export class BaseRepository<T extends Document> implements IRepository<T> {
  protected model: Model<T>;

  constructor(model: Model<T>) {
    this.model = model;
  }

  async create(data: Partial<T>): Promise<T> {
    const document = new this.model(data);
    return await document.save();
  }

  async findById(id: string): Promise<T | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return await this.model.findById(id).exec();
  }

  async findOne(filter: FilterQuery<T>): Promise<T | null> {
    return await this.model.findOne(filter).exec();
  }

  async findMany(
    filter: FilterQuery<T> = {},
    options: QueryOptions = {}
  ): Promise<T[]> {
    let query = this.model.find(filter);

    if (options.sort) {
      query = query.sort(options.sort);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.skip) {
      query = query.skip(options.skip);
    }

    if (options.populate) {
      if (Array.isArray(options.populate)) {
        options.populate.forEach((path) => {
          query = query.populate(path);
        });
      } else {
        query = query.populate(options.populate);
      }
    }

    if (options.select) {
      query = query.select(options.select);
    }

    return (await query.exec()) as T[];
  }

  async update(id: string, data: UpdateQuery<T>): Promise<T | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async updateMany(
    filter: FilterQuery<T>,
    data: UpdateQuery<T>
  ): Promise<number> {
    const result = await this.model.updateMany(filter, data).exec();
    return result.modifiedCount;
  }

  async delete(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return false;
    }
    const result = await this.model.findByIdAndDelete(id).exec();
    return !!result;
  }

  async deleteMany(filter: FilterQuery<T>): Promise<number> {
    const result = await this.model.deleteMany(filter).exec();
    return result.deletedCount;
  }

  async count(filter: FilterQuery<T> = {}): Promise<number> {
    return await this.model.countDocuments(filter).exec();
  }

  async exists(filter: FilterQuery<T>): Promise<boolean> {
    const count = await this.model.countDocuments(filter).limit(1).exec();
    return count > 0;
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  async executeTransaction<TResult>(
    operations: (session: mongoose.ClientSession) => Promise<TResult>
  ): Promise<TResult> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();
      const result = await operations(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Find with pagination support
   */
  async findWithPagination(
    filter: FilterQuery<T> = {},
    page: number = 1,
    limit: number = 10,
    options: Omit<QueryOptions, "limit" | "skip"> = {}
  ): Promise<{
    documents: T[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const skip = (page - 1) * limit;

    const [documents, totalCount] = await Promise.all([
      this.findMany(filter, { ...options, limit, skip }),
      this.count(filter),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      documents,
      totalCount,
      currentPage: page,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * Bulk operations for better performance
   */
  async bulkWrite(operations: any[]): Promise<any> {
    return await this.model.bulkWrite(operations);
  }

  /**
   * Aggregation pipeline support
   */
  async aggregate(pipeline: any[]): Promise<any[]> {
    return await this.model.aggregate(pipeline).exec();
  }
}
