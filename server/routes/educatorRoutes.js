import express from 'express'
import { addCourse, educatorDashboardData, getEducatorCourses, getEnrolledStudentsData, updateRoleToEducator } from '../controllers/educatorController.js';
import upload from '../configs/multer.js';
import { protectEducator } from '../middlewares/authMiddleware.js';


const educatorRouter = express.Router()

// Add Educator Role 
educatorRouter.get('/update-role', updateRoleToEducator)
// Add Courses 
educatorRouter.post('/add-course', upload.single('image'), protectEducator, addCourse)
// Get Educator Dashboard Data
educatorRouter.get('/dashboard', protectEducator, educatorDashboardData)
// Get Educator Courses 
educatorRouter.get('/courses', protectEducator, getEducatorCourses)

export default educatorRouter

