import mongoose from 'mongoose';
import { config } from './config';

export async function connectMongo(uri: string = config.mongodbUri): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  return mongoose.connect(uri);
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
