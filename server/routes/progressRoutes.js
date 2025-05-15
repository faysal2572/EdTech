import express from 'express';
import { requireSignIn } from '../middlewares/authMiddleware.js';
import { progressController } from '../controllers/progressController.js';

const router = express.Router();

// Mark a lecture as complete
router.post('/mark-complete/:courseId/:lectureId', requireSignIn, progressController.markLectureAsComplete);

// Get user progress for a specific course
router.get('/user-progress/:courseId', requireSignIn, progressController.getUserCourseProgress);

// Reset progress for a course
router.post('/reset-progress/:courseId', requireSignIn, progressController.resetCourseProgress);

// Get all user progress (for dashboard)
router.get('/all-progress', requireSignIn, progressController.getAllUserProgress);

// Get lecture completion status
router.get('/lecture-status/:courseId/:lectureId', requireSignIn, progressController.getLectureCompletionStatus);

export default router;
