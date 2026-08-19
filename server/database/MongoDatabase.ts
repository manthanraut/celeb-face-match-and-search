import { type Db, MongoClient, type MongoClientOptions } from "mongodb";

const DATABASE_PING_TIMEOUT_MS = 5_000;

interface MongoDatabaseOptions {
  databaseName: string;
  mongoClientOptions?: MongoClientOptions;
  uri: string;
}

export class MongoDatabase {
  readonly #databaseName: string;
  readonly #mongoClientOptions: MongoClientOptions;
  readonly #uri: string;

  #client: MongoClient | null = null;
  #connectionPromise: Promise<Db> | null = null;
  #database: Db | null = null;

  constructor({ databaseName, mongoClientOptions, uri }: MongoDatabaseOptions) {
    this.#databaseName = databaseName;
    this.#mongoClientOptions = {
      serverSelectionTimeoutMS: 5_000,
      ...mongoClientOptions,
    };
    this.#uri = uri;
  }

  get db(): Db {
    if (!this.#database) {
      throw new Error("MongoDB has not been connected.");
    }

    return this.#database;
  }

  async connect(): Promise<Db> {
    if (this.#database) {
      return this.#database;
    }

    if (this.#connectionPromise) {
      return this.#connectionPromise;
    }

    const client = new MongoClient(this.#uri, this.#mongoClientOptions);
    this.#client = client;

    const connectionPromise = this.#connectClient(client);
    this.#connectionPromise = connectionPromise;

    try {
      return await connectionPromise;
    } catch (error) {
      if (this.#client === client) {
        this.#client = null;
        this.#database = null;
      }

      await client.close().catch(() => undefined);
      throw error;
    } finally {
      if (this.#connectionPromise === connectionPromise) {
        this.#connectionPromise = null;
      }
    }
  }

  async ping(): Promise<void> {
    await this.db.command({ ping: 1 }, { timeoutMS: DATABASE_PING_TIMEOUT_MS });
  }

  async close(): Promise<void> {
    const pendingConnection = this.#connectionPromise;
    if (pendingConnection) {
      await pendingConnection.catch(() => undefined);
    }

    const client = this.#client;
    this.#client = null;
    this.#connectionPromise = null;
    this.#database = null;

    if (client) {
      await client.close();
    }
  }

  async #connectClient(client: MongoClient): Promise<Db> {
    await client.connect();

    const database = client.db(this.#databaseName);
    await database.command({ ping: 1 }, { timeoutMS: DATABASE_PING_TIMEOUT_MS });
    this.#database = database;

    return database;
  }
}
