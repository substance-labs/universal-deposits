import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createClient } from 'redis'
import { rateLimit } from 'express-rate-limit'
import { connectToMongoDB } from './db/mongodb.js'
import { connectToRedis } from './db/redis.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFoundHandler } from './middleware/notFoundHandler.js'
import { validateRequest } from './middleware/validateRequest.js'
import { logRequest } from './middleware/logRequest.js'
import { setupSwagger } from './utils/swagger.js'
import path from 'path'
import { fileURLToPath } from 'url'

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// Routes
import udRoutes from './routes/ud.routes.js'
import orderRoutes from './routes/order.routes.js'
import quoteRoutes from './routes/quote.routes.js'
import safeRoutes from './routes/safe.routes.js'
import addressRoutes from './routes/address.routes.js'

// Environment variables
const PORT = process.env.PORT || 3001
const NODE_ENV = process.env.NODE_ENV || 'development'

// Initialize Express app
const app = express()

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(logRequest)

// Apply general rate limiting
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 100, // 100 requests per minute
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})

app.use(generalLimiter)

// Set up Swagger documentation
setupSwagger(app)

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  })
})

// API Routes
app.use('/api', udRoutes)
app.use('/api', orderRoutes)
app.use('/api', quoteRoutes)
app.use('/api', safeRoutes)
app.use('/api', addressRoutes)

// Serve static files from the Vite app build directory
app.use(express.static(path.join(__dirname, '../../app/dist')))

// For any other GET request, send the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../app/dist/index.html'))
})

// Error Handling
app.use(notFoundHandler)
app.use(errorHandler)

// Start the server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectToMongoDB()

    // Connect to Redis
    await connectToRedis()

    // Start Express server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
