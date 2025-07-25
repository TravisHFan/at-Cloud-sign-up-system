import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import routes from "../../src/routes";
import errorHandler from "../../src/middleware/errorHandler";

const createTestApp = () => {
  const app = express();

  // Basic middleware for testing
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mount routes
  app.use(routes);

  // Error handling
  app.use(errorHandler);

  return app;
};

export default createTestApp;
