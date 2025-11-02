import express from 'express';
import dotenv from 'dotenv';
import { connectDB, sequelize } from './config/db.js';
import { connectRabbitMQ } from './config/rabbitmq.js';
import ordersRoutes from './routes/orders.routes.js';
import { errorHandler } from './middlewares/error.middleware.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/orders', ordersRoutes);
app.use(errorHandler);

const start = async () => {
  await connectDB();
  await sequelize.sync({ alter: true });
  await connectRabbitMQ();

  app.listen(process.env.PORT, () => console.log(`🚀 Order Service corriendo en puerto ${process.env.PORT}`));
};

start();
