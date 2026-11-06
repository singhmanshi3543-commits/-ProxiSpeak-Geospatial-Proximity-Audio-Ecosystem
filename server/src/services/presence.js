import { User } from '../models/User.js';
import { leaveAllRooms } from './rooms.js';

// Makes the user invisible: removes stored location and leaves all rooms.
export async function clearPresence(userId, req) {
  await leaveAllRooms(userId, req);
  await User.updateOne(
    { _id: userId },
    { $unset: { location: '', locationAccuracy: '', locationUpdatedAt: '' } }
  );
}
