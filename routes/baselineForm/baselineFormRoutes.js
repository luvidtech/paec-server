import express from 'express'
import multer from 'multer'
import {
    createBaselineForm,
    getBaselineForm,
    deleteBaselineForm,
    getBaselineFormById,
    updateBaselineForm,
    searchBaselineForm
} from '../../controllers/baselineForm/baselineFormController.js'
import upload from "../../utils/multer.js"


import { validateBaselineForm } from '../../validators/baselineFormValidator.js'
import { authenticateUser } from '../../utils/authMiddleware.js'


const router = express.Router()

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  console.log('Multer error:', err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: 'File too large. Maximum size is 5MB per file.' 
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        message: 'Too many files. Maximum 10 files allowed.' 
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        message: 'Unexpected file field name. Only "mriImages" is allowed.' 
      });
    }
    return res.status(400).json({ 
      message: `Upload error: ${err.message}` 
    });
  }
  
  if (err.message === 'Only image files are allowed!') {
    return res.status(400).json({ 
      message: 'Only image files (JPEG, PNG, GIF, WebP) are allowed.' 
    });
  }
  
  next(err);
};

router.post('/', authenticateUser, upload.fields([
    { name: "mriImages", maxCount: 10 },
]), handleMulterError, createBaselineForm)
router.get('/', authenticateUser, getBaselineForm)
router.get('/search', authenticateUser, searchBaselineForm)
router.get('/:id', authenticateUser, getBaselineFormById)
router.patch('/:id', authenticateUser, upload.fields([
    { name: "mriImages", maxCount: 10 },
]), handleMulterError, updateBaselineForm)
router.delete('/:id', authenticateUser, deleteBaselineForm)

export default router