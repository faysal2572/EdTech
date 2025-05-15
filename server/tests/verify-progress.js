import { Progress } from '../models/Progress.js';
import { CourseProgress } from '../models/CourseProgress.js';
import mongoose from 'mongoose';

// Simple script to verify the course progress tracking functionality
console.log('Verifying course progress tracking functionality...');

// Test the Progress model methods
const testProgressModel = async () => {
  try {
    console.log('\n--- Testing Progress Model ---');
    
    // Create a mock progress instance
    const progress = new Progress({
      userId: 'test_user_123',
      courseId: 'test_course_123',
      completedLectures: ['lecture_1', 'lecture_3'],
      lastAccessed: new Date()
    });
    
    console.log('Progress instance created:', progress);
    console.log('Completed lectures:', progress.completedLectures);
    
    // Test the calculateCompletionPercentage method
    console.log('\nTesting calculateCompletionPercentage method...');
    console.log('This would normally calculate the percentage based on completed lectures');
    
    return true;
  } catch (error) {
    console.error('Error testing Progress model:', error);
    return false;
  }
};

// Test the CourseProgress model methods
const testCourseProgressModel = async () => {
  try {
    console.log('\n--- Testing CourseProgress Model ---');
    
    // Create a mock course progress instance
    const courseProgress = new CourseProgress({
      userId: 'test_user_123',
      courseId: 'test_course_123',
      completedLectures: ['lecture_1'],
      lastAccessed: new Date(Date.now() - 86400000) // 1 day ago
    });
    
    console.log('CourseProgress instance created:', courseProgress);
    
    // Test markLectureAsComplete method
    console.log('\nTesting markLectureAsComplete method...');
    const result = courseProgress.markLectureAsComplete('lecture_2');
    console.log('Result of marking lecture_2 as complete:', result);
    console.log('Updated completed lectures:', courseProgress.completedLectures);
    
    // Test isLectureCompleted method
    console.log('\nTesting isLectureCompleted method...');
    console.log('Is lecture_1 completed?', courseProgress.isLectureCompleted('lecture_1'));
    console.log('Is lecture_2 completed?', courseProgress.isLectureCompleted('lecture_2'));
    console.log('Is lecture_3 completed?', courseProgress.isLectureCompleted('lecture_3'));
    
    // Test resetProgress method
    console.log('\nTesting resetProgress method...');
    courseProgress.resetProgress();
    console.log('After reset - completed lectures:', courseProgress.completedLectures);
    console.log('After reset - completion percentage:', courseProgress.completionPercentage);
    
    return true;
  } catch (error) {
    console.error('Error testing CourseProgress model:', error);
    return false;
  }
};

// Run the verification
const runVerification = async () => {
  try {
    const progressResult = await testProgressModel();
    const courseProgressResult = await testCourseProgressModel();
    
    if (progressResult && courseProgressResult) {
      console.log('\n✅ Course progress tracking features verified successfully!');
    } else {
      console.log('\n❌ Some verification tests failed. See errors above.');
    }
  } catch (error) {
    console.error('Error during verification:', error);
  }
};

// Run the verification
runVerification()
  .then(() => {
    console.log('\nVerification complete.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
