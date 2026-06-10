import { config as loadDotenv } from 'dotenv';
loadDotenv();

import mongoose from 'mongoose';
import { hashPassword } from './lib/password.js';
import { BoardModel } from './models/Board.js';
import { CardModel } from './models/Card.js';
import { ListModel } from './models/List.js';
import { UserModel } from './models/User.js';

const SEED_DOMAIN = '@seed.collabboard.dev';
const MONGO_URI = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/collabboard';

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Clean up existing seed data.
  const existingUsers = await UserModel.find({ email: { $regex: `${SEED_DOMAIN}$` } });
  const userIds = existingUsers.map((u) => u._id);
  await CardModel.deleteMany({ board: { $in: await BoardModel.find({ owner: { $in: userIds } }).distinct('_id') } });
  await ListModel.deleteMany({ board: { $in: await BoardModel.find({ owner: { $in: userIds } }).distinct('_id') } });
  await BoardModel.deleteMany({ owner: { $in: userIds } });
  await UserModel.deleteMany({ email: { $regex: `${SEED_DOMAIN}$` } });
  console.log('Cleared previous seed data');

  // Create demo users.
  const users = await UserModel.insertMany([
    { email: `alice${SEED_DOMAIN}`, passwordHash: await hashPassword('demo1234'), name: 'Alice (Demo)' },
    { email: `bob${SEED_DOMAIN}`, passwordHash: await hashPassword('demo1234'), name: 'Bob (Demo)' },
  ]);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const alice = users[0]!;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const bob = users[1]!;
  console.log(`Created users: ${alice.email}, ${bob.email}`);

  // Create a board owned by alice with bob as editor.
  const board = await BoardModel.create({
    name: 'Demo Board',
    description: 'A sample Kanban board with pre-loaded cards.',
    owner: alice._id,
    members: [
      { user: alice._id, role: 'owner' },
      { user: bob._id, role: 'editor' },
    ],
  });
  console.log(`Created board: "${board.name}" (id: ${board._id.toString()})`);

  // Create 3 lists.
  const lists = await ListModel.insertMany([
    { board: board._id, title: 'Backlog', position: 0 },
    { board: board._id, title: 'In Progress', position: 1 },
    { board: board._id, title: 'Done', position: 2 },
  ]);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const backlog = lists[0]!;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const inProgress = lists[1]!;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const done = lists[2]!;
  console.log('Created lists: Backlog, In Progress, Done');

  // Create 6 cards distributed across lists.
  const tomorrow = new Date(Date.now() + 86400_000).toISOString();
  const nextWeek = new Date(Date.now() + 7 * 86400_000).toISOString();

  await CardModel.insertMany([
    {
      board: board._id, list: backlog._id,
      title: 'Set up CI pipeline', description: 'Configure GitHub Actions for lint + test + build.',
      labels: ['devops'], assignees: [alice._id], dueDate: nextWeek, position: 0, version: 0,
    },
    {
      board: board._id, list: backlog._id,
      title: 'Write onboarding docs', description: 'Document the local development setup.',
      labels: ['docs'], assignees: [], dueDate: null, position: 1, version: 0,
    },
    {
      board: board._id, list: inProgress._id,
      title: 'Implement search', description: 'Add full-text search across card titles and descriptions.',
      labels: ['feature', 'frontend'], assignees: [bob._id], dueDate: tomorrow, position: 0, version: 0,
    },
    {
      board: board._id, list: inProgress._id,
      title: 'Fix drag-and-drop on mobile', description: 'Touch events do not trigger drag correctly on iOS.',
      labels: ['bug', 'mobile'], assignees: [alice._id, bob._id], dueDate: tomorrow, position: 1, version: 0,
    },
    {
      board: board._id, list: done._id,
      title: 'Add JWT refresh rotation', description: 'Both tokens are now rotated on every /auth/refresh call.',
      labels: ['security'], assignees: [alice._id], dueDate: null, position: 0, version: 2,
    },
    {
      board: board._id, list: done._id,
      title: 'Set up Mailhog for dev email', description: 'SMTP routes to Mailhog in docker-compose; set SMTP_HOST=disabled in CI.',
      labels: ['devops'], assignees: [], dueDate: null, position: 1, version: 1,
    },
  ]);
  console.log('Created 6 cards across lists');

  console.log('\nSeed complete!');
  console.log(`  alice${SEED_DOMAIN} / demo1234`);
  console.log(`  bob${SEED_DOMAIN}   / demo1234`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
