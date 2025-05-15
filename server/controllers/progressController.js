import { Progress } from '../models/Progress.js';
import { CourseProgress } from '../models/CourseProgress.js';

export const progressController = {
    // Mark lecture as complete
    markLectureAsComplete: async (req, res) => {
        try {
            const { courseId, lectureId } = req.params;
            const userId = req.auth.userId;

            // Find existing progress document
            let progress = await Progress.findOne({ 
                userId, 
                courseId 
            });

            // If no progress document exists, create one
            if (!progress) {
                progress = await Progress.create({
                    userId,
                    courseId,
                    completedLectures: [lectureId],
                    lastAccessed: new Date()
                });
            } else {
                // If lecture not already marked as complete, add it
                if (!progress.completedLectures.includes(lectureId)) {
                    progress = await Progress.findOneAndUpdate(
                        { userId, courseId },
                        { 
                            $push: { completedLectures: lectureId },
                            $set: { lastAccessed: new Date() }
                        },
                        { new: true }
                    );
                }
            }

            // Calculate completion percentage
            const completionPercentage = await progress.calculateCompletionPercentage(courseId);
            
            // Update the completion percentage
            progress = await Progress.findOneAndUpdate(
                { userId, courseId },
                { $set: { completionPercentage } },
                { new: true }
            );

            res.json({ 
                success: true, 
                message: 'Lecture marked as complete',
                completedLectures: progress.completedLectures,
                completionPercentage
            });
        } catch (error) {
            res.json({ success: false, message: error.message });
        }
    },

    // Get user progress for a course
    getUserCourseProgress: async (req, res) => {
        try {
            const { courseId } = req.params;
            const userId = req.auth.userId;

            // Find progress document
            const progress = await Progress.findOne({ userId, courseId });
            
            if (!progress) {
                return res.json({ 
                    success: true, 
                    completedLectures: [],
                    completionPercentage: 0,
                    lastAccessed: null
                });
            }

            // Calculate completion percentage
            const completionPercentage = await progress.calculateCompletionPercentage(courseId);

            res.json({ 
                success: true, 
                completedLectures: progress.completedLectures,
                completionPercentage,
                lastAccessed: progress.lastAccessed
            });
        } catch (error) {
            res.json({ success: false, message: error.message });
        }
    },

    // Reset progress for a course
    resetCourseProgress: async (req, res) => {
        try {
            const { courseId } = req.params;
            const userId = req.auth.userId;

            // Update progress document to reset completed lectures
            await Progress.findOneAndUpdate(
                { userId, courseId },
                { 
                    $set: { 
                        completedLectures: [],
                        lastAccessed: new Date(),
                        completionPercentage: 0
                    }
                }
            );

            res.json({ 
                success: true, 
                message: 'Progress reset successfully',
                completedLectures: [],
                completionPercentage: 0
            });
        } catch (error) {
            res.json({ success: false, message: error.message });
        }
    },

    // Get all user progress (for dashboard)
    getAllUserProgress: async (req, res) => {
        try {
            const userId = req.auth.userId;

            // Find all progress documents for the user
            const allProgress = await Progress.find({ userId })
                .populate('courseId', 'courseTitle courseThumbnail');

            // Format response data
            const progressData = allProgress.map(progress => {
                return {
                    courseId: progress.courseId._id,
                    courseTitle: progress.courseId.courseTitle,
                    courseThumbnail: progress.courseId.courseThumbnail,
                    completedLectures: progress.completedLectures,
                    lastAccessed: progress.lastAccessed,
                    completionPercentage: progress.completionPercentage
                };
            });

            res.json({ 
                success: true, 
                progressData
            });
        } catch (error) {
            res.json({ success: false, message: error.message });
        }
    },

    // Get lecture completion status
    getLectureCompletionStatus: async (req, res) => {
        try {
            const { courseId, lectureId } = req.params;
            const userId = req.auth.userId;

            // Find progress document
            const progress = await Progress.findOne({ userId, courseId });
            
            if (!progress) {
                return res.json({ 
                    success: true, 
                    isCompleted: false
                });
            }

            const isCompleted = progress.completedLectures.includes(lectureId);

            res.json({ 
                success: true, 
                isCompleted
            });
        } catch (error) {
            res.json({ success: false, message: error.message });
        }
    }
};
