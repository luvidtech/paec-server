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
import { exec } from 'child_process'
import fs from 'fs'
import archiver from 'archiver'

import userRoutes from './routes/auth/userRoutes.js'
import centerRoutes from './routes/center/centerRoutes.js'
import baselineFormRoutes from './routes/baselineForm/baselineFormRoutes.js'
import followupFormRoutes from './routes/followupForm/followupFormRoutes.js'
import dumpRoutes from './routes/dump/dumpRoutes.js'
import logsRoutes from './routes/logs/logsRoutes.js'
import importRoutes from './routes/import/importRoutes.js'
import exportRoutes from './routes/export/exportRoutes.js'
import dashboardRoutes from './routes/dashboard/dashboardRoutes.js'

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
  'http://192.168.2.115:3000',
  'http://paec.saasa.shop',
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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))


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
app.use('/api/dump', dumpRoutes)
app.use('/api/logs', logsRoutes)
app.use('/api/import', importRoutes)
app.use('/api/export', exportRoutes)
app.use('/api/dashboard', dashboardRoutes)

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

app.post('/dump', (req, res) => {
  const uploadsDir = path.join(__dirname, 'uploads')
  const dumpDir = path.join(uploadsDir, 'db-dump')
  const ghdDir = path.join(dumpDir, 'ghd')

  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir)
  if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir)

  const now = new Date()
  const timestamp = now.toISOString().replace(/[:T]/g, '-').slice(0, 16)
  const zipFileName = `ghd-dump-${timestamp}.zip`
  const zipFilePath = path.join(uploadsDir, zipFileName)

  const dumpCommand = `"C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongodump.exe" --uri="mongodb://127.0.0.1:27017/ghd" --out="${dumpDir}"`

  // Step 1: Run mongodump
  exec(dumpCommand, (error, stdout, stderr) => {
    if (error) {
      console.error('Dump error:', stderr)
      return res.status(500).json({ message: 'Failed to create database dump', error: stderr })
    }

    console.log('mongodump complete, starting zip...')

    // Step 2: Create ZIP after dump completes
    const output = fs.createWriteStream(zipFilePath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => {
      console.log(`ZIP created: ${zipFileName} (${archive.pointer()} total bytes)`)

      // Step 3: Delete ghd folder only after successful zip
      fs.rm(ghdDir, { recursive: true, force: true }, err => {
        if (err) {
          console.error('Error deleting ghd folder:', err)
        } else {
          console.log('ghd folder deleted successfully')
        }

        res.json({
          message: 'Database dumped, zipped, and cleaned up',
          zipPath: `/uploads/${zipFileName}`
        })
      })
    })

    archive.on('error', err => {
      console.error('Archive error:', err)
      return res.status(500).json({ message: 'Failed to zip ghd folder', error: err.message })
    })

    archive.pipe(output)
    archive.directory(ghdDir, 'ghd')  // only zip the ghd folder
    archive.finalize()  // this finalizes only after everything is added
  })
})






app.use(notFound)
app.use(errorHandler)





app.listen(port, () => console.log(`Server running on port ${port}`))