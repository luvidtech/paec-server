import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Set storage engine
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../uploads')  // Absolute path for uploads
        // Ensure the uploads folder exists
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true })
        }
        cb(null, uploadPath)  // Path where the files will be stored
    },
    filename: function (req, file, cb) {
        // Ensure the filename is safe and unique
        const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`
        cb(null, uniqueName)
    }
})

// Initialize multer upload with the storage configuration
const upload = multer({ storage: storage })

// Export upload middleware for use in routes
export default upload
