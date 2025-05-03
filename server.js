import express from 'express'
import dotenv from 'dotenv'
dotenv.config()
import cookieParser from 'cookie-parser'
import cors from 'cors'
import connectDB from './config/db.js'
import { errorHandler, notFound } from './utils/errorMiddleware.js'
import path from 'path'
import { fileURLToPath } from 'url'
import passport from 'passport'

import userRoutes from './routes/auth/userRoutes.js'
import centerRoutes from './routes/center/centerRoutes.js'
import baselineFormRoutes from './routes/baselineForm/baselineFormRoutes.js'
import followupFormRoutes from './routes/followupForm/followupFormRoutes.js'


import User from './models/userModel.js'

connectDB()

const port = process.env.PORT || 5000

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()

app.use(cookieParser())
const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:3000',
  'http://localhost:5173',
]

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// Handle OPTIONS (preflight) requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.sendStatus(204)
})

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(new URL(import.meta.url).pathname, './uploads')))
const publicPath = path.join(__dirname, './uploads')
app.use(express.static(publicPath))


app.use(passport.initialize())


const createAdminIfNotExists = async () => {
  const adminExists = await User.findOne({ email: process.env.ADMIN_EMAIL })
  if (!adminExists) {
    const adminData = {
      adminName: process.env.ADMIN_USERNAME,
      email: process.env.ADMIN_EMAIL,
      phone: process.env.ADMIN_PHONE,
      password: process.env.ADMIN_PASSWORD,
      userName: process.env.ADMIN_USERNAME,
      role: process.env.ADMIN_ROLE || 'admin',
      accessTo: process.env.ADMIN_ACCESS || 'all'
    }
    await User.create(adminData)
  }
}

// Call this function on server startup
createAdminIfNotExists()

app.use('/api/auth', userRoutes)
app.use('/api/center', centerRoutes)
app.use('/api/baseline', baselineFormRoutes)
app.use('/api/followup', followupFormRoutes)


// Serve static files
if (process.env.NODE_ENV === 'production') {
  //set static folder
  app.use(express.static(path.join(__dirname, '../frontend/build')))

  //any route that is not api will be redirected to index.html
  app.get('*', (req, res) => res.sendFile(path.resolve(__dirname, '../frontend', 'build', 'index.html')))
} else {
  app.get('/', (req, res) => {
    res.send('API IS RUNNING..!')
  })
}

app.use(notFound)
app.use(errorHandler)

app.listen(port, () => console.log(`Server running on port ${port}`))