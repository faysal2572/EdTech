import mongoose from 'mongoose';

const progressSchema = new mongoose.Schema({
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
progressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

// Method to calculate completion percentage
progressSchema.methods.calculateCompletionPercentage = async function(courseId) {
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
        
        return Math.round((this.completedLectures.length / totalLectures) * 100);
    } catch (error) {
        console.error('Error calculating completion percentage:', error);
        return 0;
    }
};

export const Progress = mongoose.model('Progress', progressSchema);
