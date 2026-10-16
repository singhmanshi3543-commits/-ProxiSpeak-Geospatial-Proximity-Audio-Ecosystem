import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/proxispeak';

export async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });
    
    // Ensure clean 2d index on coordinates
    const { UserLocation } = await import('../models/UserLocation.js');
    try {
      await UserLocation.syncIndexes();
    } catch (idxErr) {
      console.warn(`[Database] Index sync noticed incompatible index, re-building: ${idxErr.message}`);
      await UserLocation.collection.dropIndexes();
      await UserLocation.syncIndexes();
    }

    console.log(`[Database] MongoDB connected successfully to ${mongoose.connection.host}/${mongoose.connection.name} (2D Spatial Index Active)`);
    return mongoose.connection;
  } catch (error) {
    console.warn(`[Database] MongoDB connection warning: ${error.message}`);
    console.warn(`[Database] Operating in resilient mode. Ensure MongoDB service is running.`);
    throw error;
  }
}

export default connectDB;
