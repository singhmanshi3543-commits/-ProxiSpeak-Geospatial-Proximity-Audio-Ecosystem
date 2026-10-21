import express from 'express';
import OfficeRoom from '../models/OfficeRoom.js';

const router = express.Router();

// Default Infotact Headquarters Office Map Configuration
export const DEFAULT_OFFICE_LAYOUT = {
  roomId: 'infotact-hq',
  name: 'Infotact Solutions - Digital Headquarters',
  dimensions: { width: 1800, height: 1100 },
  earshotThresholdPx: 100,
  maxConcurrentUsers: 100,
  zones: [
    {
      id: 'boardroom',
      name: 'Executive Boardroom',
      boundingBox: [[50, 50], [550, 420]],
      color: 'rgba(59, 130, 246, 0.12)',
      isQuietZone: false,
    },
    {
      id: 'open-workspace',
      name: 'Engineering Hub',
      boundingBox: [[620, 50], [1300, 600]],
      color: 'rgba(16, 185, 129, 0.08)',
      isQuietZone: false,
    },
    {
      id: 'breakroom',
      name: 'Cafeteria & Watercooler',
      boundingBox: [[1350, 50], [1750, 500]],
      color: 'rgba(245, 158, 11, 0.10)',
      isQuietZone: false,
    },
    {
      id: 'quiet-pods',
      name: 'Quiet Focus Pods',
      boundingBox: [[50, 500], [550, 1050]],
      color: 'rgba(139, 92, 246, 0.12)',
      isQuietZone: true,
    },
    {
      id: 'all-hands-lounge',
      name: 'All-Hands Auditorium & Lounge',
      boundingBox: [[620, 680], [1750, 1050]],
      color: 'rgba(236, 72, 153, 0.08)',
      isQuietZone: false,
    },
  ],
  walls: [
    // Boardroom acoustic partition walls
    { id: 'w1', x1: 50, y1: 50, x2: 550, y2: 50, thickness: 10, acousticDamping: 0.85, label: 'North Boardroom Wall' },
    { id: 'w2', x1: 550, y1: 50, x2: 550, y2: 240, thickness: 10, acousticDamping: 0.85, label: 'East Boardroom Wall' },
    // Boardroom Door Opening between y=240 and y=300
    { id: 'w3', x1: 550, y1: 300, x2: 550, y2: 420, thickness: 10, acousticDamping: 0.85, label: 'East Boardroom Wall (South)' },
    { id: 'w4', x1: 50, y1: 420, x2: 550, y2: 420, thickness: 10, acousticDamping: 0.85, label: 'South Boardroom Wall' },

    // Breakroom walls
    { id: 'w5', x1: 1350, y1: 50, x2: 1350, y2: 280, thickness: 10, acousticDamping: 0.80, label: 'Breakroom West Wall' },
    { id: 'w6', x1: 1350, y1: 350, x2: 1350, y2: 500, thickness: 10, acousticDamping: 0.80, label: 'Breakroom West Wall (South)' },
    { id: 'w7', x1: 1350, y1: 500, x2: 1750, y2: 500, thickness: 10, acousticDamping: 0.80, label: 'Breakroom South Wall' },

    // Quiet Pods soundproof dividing walls
    { id: 'w8', x1: 50, y1: 500, x2: 550, y2: 500, thickness: 12, acousticDamping: 0.95, label: 'Soundproof Pod Divider' },
    { id: 'w9', x1: 300, y1: 500, x2: 300, y2: 1050, thickness: 12, acousticDamping: 0.95, label: 'Pod Internal Divider' },
    { id: 'w10', x1: 550, y1: 500, x2: 550, y2: 850, thickness: 10, acousticDamping: 0.90, label: 'Quiet Pod Outer Wall' },

    // Auditorium Dividing Wall
    { id: 'w11', x1: 620, y1: 650, x2: 1750, y2: 650, thickness: 8, acousticDamping: 0.70, label: 'Auditorium Partition' },
  ],
  furniture: [
    // Boardroom Conference Table
    { id: 'f1', type: 'desk', x: 220, y: 190, width: 220, height: 90, label: 'Executive Board Table', blocksSound: false },
    // Engineering Pods (Desks)
    { id: 'f2', type: 'desk', x: 700, y: 150, width: 140, height: 70, label: 'Frontend Team Pod', blocksSound: false },
    { id: 'f3', type: 'desk', x: 700, y: 280, width: 140, height: 70, label: 'Backend Team Pod', blocksSound: false },
    { id: 'f4', type: 'desk', x: 920, y: 150, width: 140, height: 70, label: 'AI/ML Team Pod', blocksSound: false },
    { id: 'f5', type: 'desk', x: 920, y: 280, width: 140, height: 70, label: 'DevOps & Cloud Pod', blocksSound: false },
    { id: 'f6', type: 'desk', x: 1140, y: 150, width: 120, height: 70, label: 'QA / Testing Pod', blocksSound: false },
    { id: 'f7', type: 'desk', x: 1140, y: 280, width: 120, height: 70, label: 'Product & Design Pod', blocksSound: false },
    // Watercooler & Lounge
    { id: 'f8', type: 'watercooler', x: 1400, y: 120, width: 40, height: 40, label: 'Watercooler Hub', blocksSound: false },
    { id: 'f9', type: 'sofa', x: 1520, y: 250, width: 160, height: 60, label: 'Cafeteria Lounge Sofa', blocksSound: false },
    // Quiet Pod Desks
    { id: 'f10', type: 'desk', x: 120, y: 650, width: 100, height: 60, label: 'Focus Desk A', blocksSound: false },
    { id: 'f11', type: 'desk', x: 380, y: 650, width: 100, height: 60, label: 'Focus Desk B', blocksSound: false },
    // Auditorium Stage & Seating
    { id: 'f12', type: 'sofa', x: 1100, y: 730, width: 260, height: 50, label: 'Presentation Stage', blocksSound: false },
    { id: 'f13', type: 'sofa', x: 950, y: 840, width: 560, height: 45, label: 'Auditorium Front Row', blocksSound: false },
    { id: 'f14', type: 'sofa', x: 920, y: 920, width: 620, height: 45, label: 'Auditorium Second Row', blocksSound: false },
    // Plants / Decorative items
    { id: 'f15', type: 'plant', x: 570, y: 70, width: 30, height: 30, label: 'Indoor Palm', blocksSound: false },
    { id: 'f16', type: 'plant', x: 1330, y: 70, width: 30, height: 30, label: 'Ficus Tree', blocksSound: false },
    { id: 'f17', type: 'plant', x: 600, y: 670, width: 30, height: 30, label: 'Monstera Plant', blocksSound: false },
  ],
};

/**
 * Seed or retrieve the default room layout
 */
export async function seedDefaultRoomLayout() {
  try {
    const existing = await OfficeRoom.findOne({ roomId: DEFAULT_OFFICE_LAYOUT.roomId });
    if (!existing) {
      const room = new OfficeRoom(DEFAULT_OFFICE_LAYOUT);
      await room.save();
      console.log('[Room] Default Infotact office layout created in MongoDB.');
    } else {
      console.log('[Room] Default Infotact office layout ready.');
    }
  } catch (error) {
    console.error('[Room] Error seeding room layout:', error);
  }
}

router.get('/default', async (req, res) => {
  try {
    let room = await OfficeRoom.findOne({ roomId: DEFAULT_OFFICE_LAYOUT.roomId }).lean();
    if (!room) {
      room = DEFAULT_OFFICE_LAYOUT;
    }
    res.json({ success: true, room });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/save', async (req, res) => {
  try {
    const { roomId = 'infotact-hq', name, dimensions, zones, walls, furniture } = req.body;
    const updated = await OfficeRoom.findOneAndUpdate(
      { roomId },
      {
        roomId,
        ...(name && { name }),
        ...(dimensions && { dimensions }),
        ...(zones && { zones }),
        ...(walls && { walls }),
        ...(furniture && { furniture }),
      },
      { upsert: true, new: true }
    );
    res.json({ success: true, room: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
