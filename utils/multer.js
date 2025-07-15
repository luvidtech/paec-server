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

// File filter function
const fileFilter = (req, file, cb) => {
    console.log('Multer processing file:', file.originalname, 'mimetype:', file.mimetype);
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
        cb(null, true)
    } else {
        console.log('File rejected:', file.originalname, 'mimetype:', file.mimetype);
        cb(new Error('Only image files are allowed!'), false)
    }
}

// Initialize multer upload with the storage configuration
const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 10 // Maximum 10 files
    }
})

// Export upload middleware for use in routes
export default upload
