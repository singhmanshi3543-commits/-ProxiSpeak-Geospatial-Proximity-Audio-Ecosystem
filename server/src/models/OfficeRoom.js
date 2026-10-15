import mongoose from 'mongoose';

const WallObstacleSchema = new mongoose.Schema({
  id: { type: String, required: true },
  x1: { type: Number, required: true },
  y1: { type: Number, required: true },
  x2: { type: Number, required: true },
  y2: { type: Number, required: true },
  thickness: { type: Number, default: 8 },
  material: { type: String, default: 'acoustic_drywall' },
  acousticDamping: { type: Number, default: 0.75 },
  label: { type: String, default: 'Partition Wall' }
}, { _id: false });

const FurnitureItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: ['desk', 'chair', 'plant', 'watercooler', 'whiteboard', 'sofa', 'server_rack'],
    default: 'desk'
  },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  rotation: { type: Number, default: 0 },
  label: { type: String, default: '' },
  blocksSound: { type: Boolean, default: false }
}, { _id: false });

const ZoneAreaSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  boundingBox: {
    type: [[Number]],
    required: true,
  },
  color: { type: String, default: 'rgba(59, 130, 246, 0.08)' },
  isQuietZone: { type: Boolean, default: false },
}, { _id: false });

const OfficeRoomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  dimensions: {
    width: { type: Number, default: 1600 },
    height: { type: Number, default: 1000 },
  },
  zones: [ZoneAreaSchema],
  walls: [WallObstacleSchema],
  furniture: [FurnitureItemSchema],
  earshotThresholdPx: {
    type: Number,
    default: 100, 
  },
  maxConcurrentUsers: {
    type: Number,
    default: 100,
  }
}, {
  timestamps: true,
});

export const OfficeRoom = mongoose.model('OfficeRoom', OfficeRoomSchema);
export default OfficeRoom;
