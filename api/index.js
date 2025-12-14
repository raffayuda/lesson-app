const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api', (req, res) => {
  res.json({ message: 'API is running!', timestamp: new Date().toISOString() });
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create new user
app.post('/api/users', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    const user = await prisma.user.create({
      data: { name, email }
    });
    
    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;
    
    const user = await prisma.user.update({
      where: { id },
      data: { name, email }
    });
    
    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.user.delete({
      where: { id }
    });
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless
module.exports = app;
