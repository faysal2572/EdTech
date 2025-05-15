import mongoose from 'mongoose';

const courseProgressSchema = new mongoose.Schema({
    userId: { 
        type: String, 
        required: true 
    },
    courseId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Course',
        required: true 
    },
    completedLectures: [{
        type: String, // lectureId
        required: false
    }],
    lastAccessed: {
        type: Date,
        default: Date.now
    },
    completionPercentage: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Create compound index for faster queries
courseProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

// Method to calculate completion percentage
courseProgressSchema.methods.calculateCompletionPercentage = async function(courseId) {
    try {
        const Course = mongoose.model('Course');
        const course = await Course.findById(courseId);
        
        if (!course) {
            return 0;
        }
        
        let totalLectures = 0;
        
        course.courseContent.forEach(chapter => {
            totalLectures += chapter.chapterContent.length;
        });
        
        if (totalLectures === 0) {
            return 0;
        }
        
        this.completionPercentage = Math.round((this.completedLectures.length / totalLectures) * 100);
        return this.completionPercentage;
    } catch (error) {
        console.error('Error calculating completion percentage:', error);
        return 0;
    }
};

// Method to mark a lecture as complete
courseProgressSchema.methods.markLectureAsComplete = function(lectureId) {
    if (!this.completedLectures.includes(lectureId)) {
        this.completedLectures.push(lectureId);
        this.lastAccessed = new Date();
        return true; // Lecture was added
    }
    return false; // Lecture was already completed
};

// Method to check if a lecture is completed
courseProgressSchema.methods.isLectureCompleted = function(lectureId) {
    return this.completedLectures.includes(lectureId);
};

// Method to reset progress
courseProgressSchema.methods.resetProgress = function() {
    this.completedLectures = [];
    this.completionPercentage = 0;
    this.lastAccessed = new Date();
};

export const CourseProgress = mongoose.model('CourseProgress', courseProgressSchema);
