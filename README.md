# @Cloud Event Sign-up System

A comprehensive event management and user sign-up system built for @Cloud Ministry.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue)](https://www.typescriptlang.org/)

## 🌟 Features

- **Multi-role Authentication**: Super Admin, Administrator, Leader, Participant
- **Event Management**: Create, edit, and manage church events with role-based permissions
- **User Management**: Comprehensive user directory with church-specific fields
- **System Messages**: Announcements and notifications system
- **Analytics Dashboard**: User engagement, event statistics, and ministry analytics
- **File Uploads**: Avatar and event image management with compression
- **Responsive Design**: Modern UI optimized for all devices
- **API Documentation**: Comprehensive OpenAPI/Swagger documentation

## 🛠 Tech Stack

### Frontend

- **React 19** + **TypeScript** for modern UI development
- **Vite** for fast development and building
- **Tailwind CSS** for responsive styling
- **React Router DOM** for navigation
- **React Hook Form** + **Yup** for form validation
- **Vitest** + **React Testing Library** for testing

### Backend

- **Node.js** + **Express** + **TypeScript** for server-side development
- **MongoDB** with **Mongoose** ODM for data persistence
- **JWT** authentication with refresh token support
- **Vitest** + **Supertest** for API testing
- **Swagger/OpenAPI** for API documentation

### Security & Performance

- **Helmet** for security headers
- **Rate limiting** with different strategies per endpoint
- **CORS** configuration for cross-origin requests
- **Image compression** for optimized file uploads
- **Input validation** with Joi schemas
- **bcryptjs** for password hashing

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **MongoDB** 7.0+ ([Installation Guide](https://docs.mongodb.com/manual/installation/))
- **Git** ([Download](https://git-scm.com/))

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/TravisHFan/at-Cloud-sign-up-system.git
   cd at-Cloud-sign-up-system
   ```

2. **Install dependencies**

   ```bash
   # Install root dependencies
   npm install

   # Install all project dependencies
   npm run install-all
   ```

3. **Environment Setup**

   ```bash
   # Backend environment
   cd backend
   cp .env.example .env
   # Edit .env with your configuration

   # Frontend environment (if needed)
   cd ../frontend
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database Setup**

   ```bash
   # Make sure MongoDB is running
   # Create sample data (optional)
   cd backend
   npm run create-sample-data
   ```

5. **Start the application**

   ```bash
   # Start both frontend and backend
   npm start

   # Or start individually
   # Backend (Terminal 1)
   cd backend && npm run dev

   # Frontend (Terminal 2)
   cd frontend && npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5001
   - API Documentation: http://localhost:5001/api-docs

## 🐳 Docker Development

For a consistent development environment using Docker:

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up

# Start in background
docker-compose -f docker-compose.dev.yml up -d

# Stop services
docker-compose -f docker-compose.dev.yml down

# Rebuild services
docker-compose -f docker-compose.dev.yml up --build
```

## 🧪 Testing

### Backend Testing

```bash
cd backend

# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Linting
npm run lint
npm run lint:fix
```

### Frontend Testing

```bash
cd frontend

# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# UI testing interface
npm run test:ui
```

## 📚 API Documentation

The API documentation is automatically generated and available at:

- **Development**: http://localhost:5001/api-docs
- **JSON Schema**: http://localhost:5001/api-docs.json

### Key API Endpoints

| Method | Endpoint                  | Description         |
| ------ | ------------------------- | ------------------- |
| POST   | `/api/v1/auth/register`   | Register new user   |
| POST   | `/api/v1/auth/login`      | User login          |
| GET    | `/api/v1/auth/profile`    | Get user profile    |
| GET    | `/api/v1/events`          | List events         |
| POST   | `/api/v1/events`          | Create event        |
| GET    | `/api/v1/system-messages` | Get system messages |
| GET    | `/api/v1/analytics`       | Get analytics data  |

## 🏗 Project Structure

```
├── backend/                 # Node.js backend API
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── middleware/      # Express middleware
│   │   ├── models/          # MongoDB models
│   │   ├── repositories/    # Data access layer
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── types/           # TypeScript types
│   │   ├── utils/           # Utility functions
│   │   └── config/          # Configuration files
│   ├── tests/               # Test files
│   └── uploads/             # File upload storage
├── frontend/                # React frontend application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── contexts/        # React contexts
│   │   ├── hooks/           # Custom React hooks
│   │   ├── pages/           # Page components
│   │   ├── services/        # API services
│   │   ├── types/           # TypeScript types
│   │   ├── utils/           # Utility functions
│   │   └── test/            # Test utilities
│   └── public/              # Static assets
├── docs/                    # Additional documentation
└── docker-compose.dev.yml   # Docker development setup
```

## 🔧 Configuration

### Environment Variables

#### Backend (.env)

```env
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/atcloud-signup
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
PORT=5001
FRONTEND_URL=http://localhost:5173
```

#### Frontend (.env)

```env
VITE_API_URL=http://localhost:5001/api/v1
```

### Available Scripts

| Command               | Description                     |
| --------------------- | ------------------------------- |
| `npm start`           | Start both frontend and backend |
| `npm run build`       | Build for production            |
| `npm run install-all` | Install all dependencies        |
| `npm test`            | Run backend tests               |
| `npm run test-system` | Test system health              |

## 🚀 Deployment

### Production Build

```bash
# Build backend
cd backend && npm run build

# Build frontend
cd frontend && npm run build
```

### Environment Setup

1. Copy `.env.production` and configure for your production environment
2. Set up production MongoDB instance
3. Configure email service for notifications
4. Set up file storage (AWS S3, etc.)
5. Configure domain and SSL certificates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **Travis Fan** - Lead Developer - @Cloud IT Team

## 📞 Support

For support and questions:

- Create an issue in this repository
- Contact the @Cloud IT Team
- Email: support@cloud-ministry.com

---

Built with ❤️ for @Cloud Ministry

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

3. Environment Setup

```bash
# Backend - create .env file
cp .env.example .env
# Configure your MongoDB URI and JWT secrets
```

4. Start the application

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173` and backend at `http://localhost:5001`.

## Project Structure

```
├── frontend/          # React frontend application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── contexts/     # React contexts
│   │   ├── hooks/        # Custom React hooks
│   │   ├── pages/        # Page components
│   │   ├── types/        # TypeScript type definitions
│   │   └── utils/        # Utility functions
│   └── public/           # Static assets
└── backend/           # Node.js backend API
    ├── src/
    │   ├── controllers/  # Route controllers
    │   ├── middleware/   # Express middleware
    │   ├── models/       # MongoDB models
    │   ├── routes/       # API routes
    │   ├── services/     # Business logic
    │   ├── types/        # TypeScript types
    │   └── utils/        # Utility functions
    └── uploads/          # File upload storage
```

## License

MIT License - see LICENSE file for details.
