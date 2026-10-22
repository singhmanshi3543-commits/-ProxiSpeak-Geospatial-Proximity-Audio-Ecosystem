import express from 'express';
import UserLocation from '../models/UserLocation.js';

const router = express.Router();

const BOT_ROLES = [
  'Senior Architect',
  'Frontend Lead',
  'Backend Engineer',
  'DevOps Specialist',
  'AI Research Scientist',
  'UI/UX Designer',
  'Product Manager',
  'Security Engineer',
  'QA Automation Lead',
  'Scrum Master',
];

const BOT_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899',
  '#06b6d4', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

const BOT_NAMES = [
  'Aarav Sharma', 'Priya Patel', 'Rohan Verma', 'Ananya Iyer', 'Vikram Singh',
  'Neha Gupta', 'Kabir Das', 'Sneha Roy', 'Arjun Reddy', 'Kavya Nair',
  'Aditya Joshi', 'Pooja Mehta', 'Rahul Menon', 'Deepa Rao', 'Sameer Khan',
  'Tanvi Kulkarni', 'Karan Bhatia', 'Ritu Chopra', 'Manish Agarwal', 'Swati Deshmukh',
  'Nikhil Pillai', 'Divya Sen', 'Harsh Malhotra', 'Simran Kaur', 'Varun Kapoor',
  'Meera Krishnan', 'Gaurav Jain', 'Ishaan Bose', 'Pooja Tiwari', 'Siddharth Roy',
  'Anushka Paul', 'Yash Singhania', 'Nisha George', 'Devendra Saxena', 'Shreya Banerjee',
  'Alok Pandey', 'Isha Mittal', 'Akash Dutta', 'Monika Varma', 'Pranav Hegde',
  'Sonal Chawla', 'Vivek Mishra', 'Tara Raman', 'Rajesh Kulkarni', 'Richa Dewan',
  'Abhinav Sethi', 'Lavanya Sundar', 'Rohit Kaushik', 'Pallavi Shinde', 'Kartik Venkatesh',
];

router.get('/active', async (req, res) => {
  try {
    const users = await UserLocation.find().sort({ lastMovedAt: -1 }).lean();
    res.json({ success: true, count: users.length, users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/swarm/spawn', async (req, res) => {
  try {
    const count = parseInt(req.body.count || '50', 10);
    await UserLocation.deleteMany({ isBot: true });
    const clusterCenters = [
      { x: 300, y: 220, zone: 'Executive Boardroom' },
      { x: 770, y: 185, zone: 'Frontend Pod' },
      { x: 770, y: 315, zone: 'Backend Pod' },
      { x: 990, y: 185, zone: 'AI/ML Pod' },
      { x: 990, y: 315, zone: 'DevOps Pod' },
      { x: 1200, y: 185, zone: 'QA Pod' },
      { x: 1420, y: 150, zone: 'Watercooler Hub' },
      { x: 1600, y: 270, zone: 'Cafeteria Lounge' },
      { x: 1100, y: 880, zone: 'Auditorium' },
      { x: 200, y: 700, zone: 'Quiet Pods' },
    ];

    const bots = [];
    for (let i = 0; i < count; i++) {
      const cluster = clusterCenters[i % clusterCenters.length];
      const offsetX = (Math.random() - 0.5) * 110;
      const offsetY = (Math.random() - 0.5) * 90;
      const x = Math.min(1750, Math.max(70, Math.round(cluster.x + offsetX)));
      const y = Math.min(1050, Math.max(70, Math.round(cluster.y + offsetY)));

      const name = BOT_NAMES[i % BOT_NAMES.length] + (i >= BOT_NAMES.length ? ` #${i + 1}` : '');
      const role = BOT_ROLES[i % BOT_ROLES.length];
      const color = BOT_COLORS[i % BOT_COLORS.length];

      bots.push({
        userId: `bot-${i + 1}`,
        socketId: `socket-bot-${i + 1}`,
        username: name,
        role,
        avatarColor: color,
        coordinates: [x, y],
        facingAngle: Math.random() * Math.PI * 2,
        isSpeaking: i % 4 === 0, // Some bots actively talking
        isMuted: false,
        isDeafened: false,
        isBot: true,
        currentRoom: cluster.zone,
        lastMovedAt: new Date(),
      });
    }

    await UserLocation.insertMany(bots);

    res.json({
      success: true,
      message: `Successfully spawned ${bots.length} concurrent virtual colleagues across office clusters.`,
      count: bots.length,
      sampleBots: bots.slice(0, 5),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/swarm/clear', async (req, res) => {
  try {
    const result = await UserLocation.deleteMany({ isBot: true });
    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} bots from the world.`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
