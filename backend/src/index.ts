import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { config } from 'dotenv';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Load environment variables
config();

// Import routes (will be created in next steps)
// import authRoutes from './routes/auth';
// import userRoutes from './routes/users';
// import eventRoutes from './routes/events';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Port configuration
const PORT = process.env.PORT || 5000;

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(helmet()); // Security headers
app.use(compression()); // Gzip compression
app.use(limiter); // Rate limiting
app.use(morgan('combined')); // Logging
app.use(express.json({ limit: '10mb' })); // Body parser
app.use(express.urlencoded({ extended: true })); // URL encoded parser

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: '@Cloud Sign-up System API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes (will be uncommented as we create them)
// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/events', eventRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist.`
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', error);
  
  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map((err: any) => err.message);
    return res.status(400).json({
      error: 'Validation Error',
      details: errors
    });
  }
  
  // Mongoose duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(409).json({
      error: 'Duplicate Error',
      message: `${field} already exists`
    });
  }
  
  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token'
    });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired'
    });
  }
  
  // Default error
  return res.status(error.status || 500).json({
    error: error.message || 'Internal Server Error'
  });
});

// Database connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/atcloud-signup-system';
    
    await mongoose.connect(mongoURI, {
      // Remove deprecated options
    });
    
    console.log('✅ MongoDB Connected Successfully');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};

// Socket.IO connection handling (for real-time features)
io.on('connection', (socket) => {
  console.log('👤 User connected:', socket.id);
  
  // Join user to their personal room for notifications
  socket.on('join-user-room', (userId: string) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their room`);
  });
  
  // Handle chat messages (will be implemented later)
  socket.on('send-message', (data) => {
    // Broadcast message to recipient
    socket.to(`user-${data.recipientId}`).emit('new-message', data);
  });
  
  socket.on('disconnect', () => {
    console.log('👤 User disconnected:', socket.id);
  });
});

// Make io available throughout the app
app.set('io', io);

// Start server
const startServer = async () => {
  await connectDB();
  
  server.listen(PORT, () => {
    console.log('🚀 Server started successfully!');
    console.log(`📍 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log('📡 Socket.IO ready for real-time connections');
    console.log('---');
  });
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export default app;
