import { expect } from 'chai';
import sinon from 'sinon';

describe('Learning Experience Tests', () => {
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
    findByIdAndUpdate: () => {}
  };

  const Course = {
    findById: () => {},
    find: () => {}
  };

  const CourseProgress = {
    findOne: () => {},
    create: () => {}
  };

  const Purchase = {
    create: () => {},
    findById: () => {}
  };

  // Mock stripe
  const stripeCheckout = {
    sessions: {
      create: () => {}
    }
  };
  
  const stripe = function() {
    return {
      checkout: stripeCheckout
    };
  };

  // Mock controller functions for learning experience
  const learningController = {
    // Course enrollment (purchase)
    purchaseCourse: async (req, res) => {
      try {
        const { courseId } = req.body;
        const { origin } = req.headers;
        const userId = req.auth.userId;

        const courseData = await Course.findById(courseId);
        const userData = await User.findById(userId);

        if (!userData || !courseData) {
          return res.json({ success: false, message: 'Data Not Found' });
        }

        const purchaseData = {
          courseId: courseData._id,
          userId,
          amount: (courseData.coursePrice - courseData.discount * courseData.coursePrice / 100).toFixed(2),
          status: 'pending'
        };

        const newPurchase = await Purchase.create(purchaseData);

        // Stripe Gateway Initialize
        const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);
        const currency = 'usd';

        // Creating line items for Stripe
        const line_items = [{
          price_data: {
            currency,
            product_data: {
              name: courseData.courseTitle
            },
            unit_amount: Math.floor(newPurchase.amount) * 100
          },
          quantity: 1
        }];

        const session = await stripeInstance.checkout.sessions.create({
          success_url: `${origin}/loading/my-enrollments`,
          cancel_url: `${origin}/`,
          line_items: line_items,
          mode: 'payment',
          metadata: {
            purchaseId: newPurchase._id.toString()
          }
        });

        res.json({ success: true, session_url: session.url });
      } catch (error) {
        res.json({ success: false, message: error.message });
      }
    },

    // Get enrolled courses
    userEnrolledCourses: async (req, res) => {
      try {
        const userId = req.auth.userId;

        const userData = await User.findById(userId)
          .populate('enrolledCourses');

        res.json({ success: true, enrolledCourses: userData.enrolledCourses });
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
    },

    // Get course with free preview
    getCourseWithPreview: async (req, res) => {
      const { id } = req.params;

      try {
        const courseData = await Course.findById(id)
          .populate({ path: 'educator' });

        // Remove lectureUrl if isPreviewFree is false
        courseData.courseContent.forEach(chapter => {
          chapter.chapterContent.forEach(lecture => {
            if (!lecture.isPreviewFree) {
              lecture.lectureUrl = "";
            }
          });
        });

        res.json({ success: true, courseData });
      } catch (error) {
        res.json({ success: false, message: error.message });
      }
    }
  };

  describe('Course Enrollment System', () => {
    it('should create a purchase and initiate Stripe checkout', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'user_123'
        },
        body: {
          courseId: 'course_123'
        },
        headers: {
          origin: 'http://localhost:3000'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Mock user and course data
      const mockUser = {
        _id: 'user_123',
        name: 'Test User',
        email: 'test@example.com'
      };
      
      const mockCourse = {
        _id: 'course_123',
        courseTitle: 'JavaScript Fundamentals',
        coursePrice: 99.99,
        discount: 20
      };
      
      // Mock purchase data
      const mockPurchase = {
        _id: 'purchase_123',
        courseId: 'course_123',
        userId: 'user_123',
        amount: '79.99',
        status: 'pending'
      };
      
      // Mock Stripe session
      const mockSession = {
        url: 'https://checkout.stripe.com/session_123'
      };
      
      // Stub User.findById to return mock user
      sandbox.stub(User, 'findById').resolves(mockUser);
      
      // Stub Course.findById to return mock course
      sandbox.stub(Course, 'findById').resolves(mockCourse);
      
      // Stub Purchase.create to return mock purchase
      sandbox.stub(Purchase, 'create').resolves(mockPurchase);
      
      // Stub stripe checkout sessions create to return mock session
      const stripeCreateStub = sandbox.stub(stripeCheckout.sessions, 'create').resolves(mockSession);
      
      // Call the controller method
      await learningController.purchaseCourse(req, res);
      
      // Verify that User.findById was called with the correct ID
      expect(User.findById.calledOnce).to.be.true;
      expect(User.findById.firstCall.args[0]).to.equal('user_123');
      
      // Verify that Course.findById was called with the correct ID
      expect(Course.findById.calledOnce).to.be.true;
      expect(Course.findById.firstCall.args[0]).to.equal('course_123');
      
      // Verify that Purchase.create was called with the correct data
      expect(Purchase.create.calledOnce).to.be.true;
      expect(Purchase.create.firstCall.args[0]).to.deep.equal({
        courseId: mockCourse._id,
        userId: 'user_123',
        amount: '79.99',
        status: 'pending'
      });
      
      // Verify that the response contains the session URL
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: true,
        session_url: 'https://checkout.stripe.com/session_123'
      });
    });

    it('should handle missing user or course data', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'nonexistent_user'
        },
        body: {
          courseId: 'course_123'
        },
        headers: {
          origin: 'http://localhost:3000'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Stub User.findById to return null (user not found)
      sandbox.stub(User, 'findById').resolves(null);
      
      // Stub Course.findById to return mock course
      sandbox.stub(Course, 'findById').resolves({
        _id: 'course_123',
        courseTitle: 'JavaScript Fundamentals'
      });
      
      // Call the controller method
      await learningController.purchaseCourse(req, res);
      
      // Verify that the response indicates failure
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: false,
        message: 'Data Not Found'
      });
    });

    it('should retrieve enrolled courses for a user', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'user_123'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Mock user data with enrolled courses
      const mockUser = {
        _id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        enrolledCourses: [
          {
            _id: 'course_1',
            courseTitle: 'JavaScript Fundamentals',
            coursePrice: 49.99
          },
          {
            _id: 'course_2',
            courseTitle: 'Advanced JavaScript',
            coursePrice: 79.99
          }
        ]
      };
      
      // Stub User.findById to return mock user with populated enrolledCourses
      const findByIdStub = sandbox.stub(User, 'findById').returns({
        populate: sandbox.stub().returns(mockUser)
      });
      
      // Call the controller method
      await learningController.userEnrolledCourses(req, res);
      
      // Verify that User.findById was called with the correct ID
      expect(findByIdStub.calledOnce).to.be.true;
      expect(findByIdStub.firstCall.args[0]).to.equal('user_123');
      
      // Verify that the response contains the enrolled courses
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: true,
        enrolledCourses: mockUser.enrolledCourses
      });
    });
  });

  describe('Progress Tracking for Enrolled Courses', () => {
    it('should update course progress when completing a lecture', async () => {
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
      await learningController.updateUserCourseProgress(req, res);
      
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
      await learningController.updateUserCourseProgress(req, res);
      
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

    it('should not add duplicate lectures to completed list', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'user_123'
        },
        body: {
          courseId: 'course_123',
          lectureId: 'lecture_456' // Already in the completed list
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Mock existing progress data with the lecture already completed
      const mockProgressData = {
        userId: 'user_123',
        courseId: 'course_123',
        lectureCompleted: ['lecture_456'],
        save: sandbox.stub().resolves()
      };
      
      // Stub CourseProgress.findOne to return mock progress data
      sandbox.stub(CourseProgress, 'findOne').resolves(mockProgressData);
      
      // Call the controller method
      await learningController.updateUserCourseProgress(req, res);
      
      // Verify that save was not called (no changes needed)
      expect(mockProgressData.save.called).to.be.false;
      
      // Verify that the response indicates lecture was already completed
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: true,
        message: 'Lecture Already Completed'
      });
    });

    it('should retrieve course progress data', async () => {
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
      await learningController.getUserCourseProgress(req, res);
      
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
  });

  describe('Course Rating System', () => {
    it('should add a new rating to a course', async () => {
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
      await learningController.addUserRating(req, res);
      
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

    it('should update an existing rating', async () => {
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
      await learningController.addUserRating(req, res);
      
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

    it('should validate rating value is between 1 and 5', async () => {
      // Mock request and response objects with invalid rating
      const req = {
        auth: {
          userId: 'user_123'
        },
        body: {
          courseId: 'course_123',
          rating: 6 // Invalid rating (> 5)
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Call the controller method
      await learningController.addUserRating(req, res);
      
      // Verify that the response indicates invalid details
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: false,
        message: 'InValid Details'
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
      await learningController.addUserRating(req, res);
      
      // Verify that the response indicates failure
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: false,
        message: 'User has not purchased this course.'
      });
    });
  });

  describe('Free Preview Lectures Option', () => {
    it('should provide access to free preview lectures only', async () => {
      // Mock course data with mix of free and paid lectures
      const mockCourse = {
        _id: 'course_123',
        courseTitle: 'JavaScript Fundamentals',
        educator: {
          _id: 'educator_123',
          name: 'John Doe'
        },
        courseContent: [
          {
            chapterId: 'chapter_1',
            chapterTitle: 'Introduction',
            chapterContent: [
              {
                lectureId: 'lecture_1',
                lectureTitle: 'What is JavaScript?',
                lectureUrl: 'https://youtube.com/watch?v=123',
                isPreviewFree: true // Free preview
              },
              {
                lectureId: 'lecture_2',
                lectureTitle: 'JavaScript History',
                lectureUrl: 'https://youtube.com/watch?v=456',
                isPreviewFree: false // Not free preview
              }
            ]
          }
        ]
      };
      
      // Mock request and response objects
      const req = {
        params: {
          id: 'course_123'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Create a deep copy of the mock course to verify modifications
      const courseCopy = JSON.parse(JSON.stringify(mockCourse));
      
      // Stub Course.findById to return mock course
      const findByIdStub = sandbox.stub(Course, 'findById').returns({
        populate: sandbox.stub().returns(courseCopy)
      });
      
      // Call the controller method
      await learningController.getCourseWithPreview(req, res);
      
      // Verify that Course.findById was called with the correct ID
      expect(findByIdStub.calledOnce).to.be.true;
      expect(findByIdStub.firstCall.args[0]).to.equal('course_123');
      
      // Verify that the response contains the course data
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.true;
      
      // Verify that free preview lecture URL is preserved
      const returnedCourse = res.json.firstCall.args[0].courseData;
      expect(returnedCourse.courseContent[0].chapterContent[0].lectureUrl).to.equal('https://youtube.com/watch?v=123');
      
      // Verify that non-free preview lecture URL is removed
      expect(returnedCourse.courseContent[0].chapterContent[1].lectureUrl).to.equal('');
    });

    it('should handle errors when retrieving course with preview', async () => {
      // Mock request and response objects
      const req = {
        params: {
          id: 'nonexistent_course'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Create an error to be thrown
      const error = new Error('Course not found');
      
      // Stub Course.findById to throw an error
      sandbox.stub(Course, 'findById').returns({
        populate: sandbox.stub().throws(error)
      });
      
      // Call the controller method
      await learningController.getCourseWithPreview(req, res);
      
      // Verify that the response indicates failure
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: false,
        message: error.message
      });
    });
  });
});