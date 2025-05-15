import { expect } from 'chai';
import sinon from 'sinon';

describe('User Management Tests', () => {
  // Setup sandbox for stubs and mocks
  let sandbox;
  
  beforeEach(() => {
    // Create a sandbox for each test
    sandbox = sinon.createSandbox();
  });
  
  afterEach(() => {
    // Restore all stubs and mocks
    sandbox.restore();
  });

  // Mock models
  const User = {
    findById: () => {},
    create: () => {}
  };

  const Course = {
    findById: () => {}
  };

  const CourseProgress = {
    findOne: () => {},
    create: () => {}
  };

  // Mock clerkClient
  const clerkClient = {
    users: {
      updateUserMetadata: () => {},
      getUser: () => {}
    }
  };

  // Mock controller functions
  const userController = {
    // Get user profile data
    getUserData: async (req, res) => {
      try {
        const userId = req.auth.userId;
        const user = await User.findById(userId);

        if (!user) {
          return res.json({ success: false, message: 'User Not Found' });
        }

        res.json({ success: true, user });
      } catch (error) {
        res.json({ success: false, message: error.message });
      }
    },

    // Update course progress
    updateUserCourseProgress: async (req, res) => {
      try {
        const userId = req.auth.userId;
        const { courseId, lectureId } = req.body;

        const progressData = await CourseProgress.findOne({ userId, courseId });

        if (progressData) {
          if (progressData.lectureCompleted.includes(lectureId)) {
            return res.json({ success: true, message: 'Lecture Already Completed' });
          }

          progressData.lectureCompleted.push(lectureId);
          await progressData.save();
        } else {
          await CourseProgress.create({
            userId,
            courseId,
            lectureCompleted: [lectureId]
          });
        }

        res.json({ success: true, message: 'Progress Updated' });
      } catch (error) {
        res.json({ success: false, message: error.message });
      }
    },

    // Get course progress
    getUserCourseProgress: async (req, res) => {
      try {
        const userId = req.auth.userId;
        const { courseId } = req.body;

        const progressData = await CourseProgress.findOne({ userId, courseId });

        res.json({ success: true, progressData });
      } catch (error) {
        res.json({ success: false, message: error.message });
      }
    },

    // Add course rating
    addUserRating: async (req, res) => {
      const userId = req.auth.userId;
      const { courseId, rating } = req.body;

      // Validate inputs
      if (!courseId || !userId || !rating || rating < 1 || rating > 5) {
        return res.json({ success: false, message: 'InValid Details' });
      }

      try {
        // Find the course by ID
        const course = await Course.findById(courseId);

        if (!course) {
          return res.json({ success: false, message: 'Course not found.' });
        }

        const user = await User.findById(userId);

        if (!user || !user.enrolledCourses.includes(courseId)) {
          return res.json({ success: false, message: 'User has not purchased this course.' });
        }

        // Check is user already rated
        const existingRatingIndex = course.courseRatings.findIndex(r => r.userId === userId);

        if (existingRatingIndex > -1) {
          // Update the existing rating
          course.courseRatings[existingRatingIndex].rating = rating;
        } else {
          // Add a new rating
          course.courseRatings.push({ userId, rating });
        }

        await course.save();

        return res.json({ success: true, message: 'Rating added' });
      } catch (error) {
        return res.json({ success: false, message: error.message });
      }
    }
  };

  // Mock educator controller
  const educatorController = {
    updateRoleToEducator: async (req, res) => {
      try {
        const userId = req.auth.userId;

        await clerkClient.users.updateUserMetadata(userId, {
          publicMetadata: {
            role: 'educator',
          },
        });

        res.json({ success: true, message: 'You can publish a course now' });
      } catch (error) {
        res.json({ success: false, message: error.message });
      }
    }
  };

  // Mock auth middleware
  const authMiddleware = {
    protectEducator: async (req, res, next) => {
      try {
        const userId = req.auth.userId;
        
        const response = await clerkClient.users.getUser(userId);

        if (response.publicMetadata.role !== 'educator') {
          return res.json({ success: false, message: 'Unauthorized Access' });
        }
        
        next();
      } catch (error) {
        res.json({ success: false, message: error.message });
      }
    }
  };

  describe('User Profiles with Personal Information', () => {
    it('should retrieve user profile data correctly', async () => {
      // Mock user data
      const mockUser = {
        _id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        imageUrl: 'https://example.com/image.jpg',
        enrolledCourses: []
      };
      
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'user_123'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Stub User.findById to return mock user
      sandbox.stub(User, 'findById').resolves(mockUser);
      
      // Call the controller method
      await userController.getUserData(req, res);
      
      // Verify that User.findById was called with the correct ID
      expect(User.findById.calledOnce).to.be.true;
      expect(User.findById.firstCall.args[0]).to.equal('user_123');
      
      // Verify that the response contains the user's personal information
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: true,
        user: mockUser
      });
      expect(res.json.firstCall.args[0].user.name).to.equal('Test User');
      expect(res.json.firstCall.args[0].user.email).to.equal('test@example.com');
      expect(res.json.firstCall.args[0].user.imageUrl).to.equal('https://example.com/image.jpg');
    });

    it('should handle non-existent users appropriately', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'nonexistent_user'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Stub User.findById to return null (user not found)
      sandbox.stub(User, 'findById').resolves(null);
      
      // Call the controller method
      await userController.getUserData(req, res);
      
      // Verify that the response indicates user not found
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: false,
        message: 'User Not Found'
      });
    });
  });

  describe('Role-based Access Control', () => {
    it('should update user role to educator successfully', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'user_123'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Stub clerkClient.users.updateUserMetadata to simulate successful role update
      const updateMetadataStub = sandbox.stub(clerkClient.users, 'updateUserMetadata').resolves({
        publicMetadata: {
          role: 'educator'
        }
      });
      
      // Call the controller method
      await educatorController.updateRoleToEducator(req, res);
      
      // Verify that clerkClient.users.updateUserMetadata was called with the correct parameters
      expect(updateMetadataStub.calledOnce).to.be.true;
      expect(updateMetadataStub.firstCall.args[0]).to.equal('user_123');
      expect(updateMetadataStub.firstCall.args[1]).to.deep.equal({
        publicMetadata: {
          role: 'educator',
        },
      });
      
      // Verify that the response indicates success
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: true,
        message: 'You can publish a course now'
      });
    });

    it('should handle errors during role update', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'user_123'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Create an error to be thrown
      const error = new Error('Role update failed');
      
      // Stub clerkClient.users.updateUserMetadata to throw an error
      sandbox.stub(clerkClient.users, 'updateUserMetadata').rejects(error);
      
      // Call the controller method
      await educatorController.updateRoleToEducator(req, res);
      
      // Verify that the response indicates failure
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: false,
        message: error.message
      });
    });

    it('should protect educator routes from non-educators', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'user_123'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      const next = sandbox.spy();
      
      // Stub clerkClient.users.getUser to return a user with student role
      sandbox.stub(clerkClient.users, 'getUser').resolves({
        publicMetadata: {
          role: 'student'
        }
      });
      
      // Call the middleware
      await authMiddleware.protectEducator(req, res, next);
      
      // Verify that the response indicates unauthorized access
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: false,
        message: 'Unauthorized Access'
      });
      
      // Verify that next was not called
      expect(next.called).to.be.false;
    });

    it('should allow educators to access protected routes', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'user_123'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      const next = sandbox.spy();
      
      // Stub clerkClient.users.getUser to return a user with educator role
      sandbox.stub(clerkClient.users, 'getUser').resolves({
        publicMetadata: {
          role: 'educator'
        }
      });
      
      // Call the middleware
      await authMiddleware.protectEducator(req, res, next);
      
      // Verify that next was called (allowing the request to proceed)
      expect(next.calledOnce).to.be.true;
      
      // Verify that res.json was not called (no error response)
      expect(res.json.called).to.be.false;
    });
  });

  describe('User Data Management', () => {
    it('should update user course progress correctly', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'user_123'
        },
        body: {
          courseId: 'course_123',
          lectureId: 'lecture_123'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Mock existing progress data
      const mockProgressData = {
        userId: 'user_123',
        courseId: 'course_123',
        lectureCompleted: ['lecture_456'],
        save: sandbox.stub().resolves()
      };
      
      // Stub CourseProgress.findOne to return mock progress data
      sandbox.stub(CourseProgress, 'findOne').resolves(mockProgressData);
      
      // Call the controller method
      await userController.updateUserCourseProgress(req, res);
      
      // Verify that CourseProgress.findOne was called with the correct parameters
      expect(CourseProgress.findOne.calledOnce).to.be.true;
      expect(CourseProgress.findOne.firstCall.args[0]).to.deep.equal({
        userId: 'user_123',
        courseId: 'course_123'
      });
      
      // Verify that the lecture was added to the completed lectures
      expect(mockProgressData.lectureCompleted).to.include('lecture_123');
      
      // Verify that save was called
      expect(mockProgressData.save.calledOnce).to.be.true;
      
      // Verify that the response indicates success
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: true,
        message: 'Progress Updated'
      });
    });

    it('should create new progress data if none exists', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'user_123'
        },
        body: {
          courseId: 'course_123',
          lectureId: 'lecture_123'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Stub CourseProgress.findOne to return null (no existing progress)
      sandbox.stub(CourseProgress, 'findOne').resolves(null);
      
      // Stub CourseProgress.create to simulate creating new progress data
      const createStub = sandbox.stub(CourseProgress, 'create').resolves({
        userId: 'user_123',
        courseId: 'course_123',
        lectureCompleted: ['lecture_123']
      });
      
      // Call the controller method
      await userController.updateUserCourseProgress(req, res);
      
      // Verify that CourseProgress.create was called with the correct parameters
      expect(createStub.calledOnce).to.be.true;
      expect(createStub.firstCall.args[0]).to.deep.equal({
        userId: 'user_123',
        courseId: 'course_123',
        lectureCompleted: ['lecture_123']
      });
      
      // Verify that the response indicates success
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: true,
        message: 'Progress Updated'
      });
    });

    it('should retrieve user course progress correctly', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'user_123'
        },
        body: {
          courseId: 'course_123'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Mock progress data
      const mockProgressData = {
        userId: 'user_123',
        courseId: 'course_123',
        lectureCompleted: ['lecture_123', 'lecture_456']
      };
      
      // Stub CourseProgress.findOne to return mock progress data
      sandbox.stub(CourseProgress, 'findOne').resolves(mockProgressData);
      
      // Call the controller method
      await userController.getUserCourseProgress(req, res);
      
      // Verify that CourseProgress.findOne was called with the correct parameters
      expect(CourseProgress.findOne.calledOnce).to.be.true;
      expect(CourseProgress.findOne.firstCall.args[0]).to.deep.equal({
        userId: 'user_123',
        courseId: 'course_123'
      });
      
      // Verify that the response contains the progress data
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: true,
        progressData: mockProgressData
      });
    });

    it('should add user rating to a course correctly', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'user_123'
        },
        body: {
          courseId: 'course_123',
          rating: 4
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Mock user data
      const mockUser = {
        _id: 'user_123',
        enrolledCourses: ['course_123']
      };
      
      // Mock course data
      const mockCourse = {
        _id: 'course_123',
        courseRatings: [],
        save: sandbox.stub().resolves()
      };
      
      // Stub User.findById to return mock user
      sandbox.stub(User, 'findById').resolves(mockUser);
      
      // Stub Course.findById to return mock course
      sandbox.stub(Course, 'findById').resolves(mockCourse);
      
      // Call the controller method
      await userController.addUserRating(req, res);
      
      // Verify that Course.findById was called with the correct ID
      expect(Course.findById.calledOnce).to.be.true;
      expect(Course.findById.firstCall.args[0]).to.equal('course_123');
      
      // Verify that User.findById was called with the correct ID
      expect(User.findById.calledOnce).to.be.true;
      expect(User.findById.firstCall.args[0]).to.equal('user_123');
      
      // Verify that the rating was added to the course
      expect(mockCourse.courseRatings).to.deep.include({
        userId: 'user_123',
        rating: 4
      });
      
      // Verify that save was called
      expect(mockCourse.save.calledOnce).to.be.true;
      
      // Verify that the response indicates success
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: true,
        message: 'Rating added'
      });
    });

    it('should update existing rating if user has already rated the course', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'user_123'
        },
        body: {
          courseId: 'course_123',
          rating: 5
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Mock user data
      const mockUser = {
        _id: 'user_123',
        enrolledCourses: ['course_123']
      };
      
      // Mock course data with existing rating
      const mockCourse = {
        _id: 'course_123',
        courseRatings: [
          {
            userId: 'user_123',
            rating: 3
          }
        ],
        save: sandbox.stub().resolves()
      };
      
      // Stub User.findById to return mock user
      sandbox.stub(User, 'findById').resolves(mockUser);
      
      // Stub Course.findById to return mock course
      sandbox.stub(Course, 'findById').resolves(mockCourse);
      
      // Call the controller method
      await userController.addUserRating(req, res);
      
      // Verify that the existing rating was updated
      expect(mockCourse.courseRatings[0].rating).to.equal(5);
      
      // Verify that save was called
      expect(mockCourse.save.calledOnce).to.be.true;
      
      // Verify that the response indicates success
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: true,
        message: 'Rating added'
      });
    });

    it('should prevent rating from users who have not purchased the course', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'user_123'
        },
        body: {
          courseId: 'course_123',
          rating: 4
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Mock user data without the course in enrolledCourses
      const mockUser = {
        _id: 'user_123',
        enrolledCourses: ['different_course']
      };
      
      // Mock course data
      const mockCourse = {
        _id: 'course_123',
        courseRatings: []
      };
      
      // Stub User.findById to return mock user
      sandbox.stub(User, 'findById').resolves(mockUser);
      
      // Stub Course.findById to return mock course
      sandbox.stub(Course, 'findById').resolves(mockCourse);
      
      // Call the controller method
      await userController.addUserRating(req, res);
      
      // Verify that the response indicates failure
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: false,
        message: 'User has not purchased this course.'
      });
    });
  });
});
