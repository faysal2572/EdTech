import { expect } from 'chai';
import sinon from 'sinon';

describe('Educator Features Tests', () => {
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
    find: () => {}
  };

  const Course = {
    find: () => {},
    create: () => {}
  };

  const Purchase = {
    find: () => {}
  };

  // Mock cloudinary
  const cloudinary = {
    v2: {
      uploader: {
        upload: () => {}
      }
    }
  };

  // Mock clerkClient
  const clerkClient = {
    users: {
      updateUserMetadata: () => {},
      getUser: () => {}
    }
  };

  // Mock controller functions for educator features
  const educatorController = {
    // Update role to educator
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
    },

    // Add new course
    addCourse: async (req, res) => {
      try {
        const { courseData } = req.body;
        const imageFile = req.file;
        const educatorId = req.auth.userId;

        if (!imageFile) {
          return res.json({ success: false, message: 'Thumbnail Not Attached' });
        }

        const parsedCourseData = JSON.parse(courseData);
        parsedCourseData.educator = educatorId;

        const newCourse = await Course.create(parsedCourseData);

        const imageUpload = await cloudinary.v2.uploader.upload(imageFile.path);
        newCourse.courseThumbnail = imageUpload.secure_url;

        await newCourse.save();

        res.json({ success: true, message: 'Course Added' });
      } catch (error) {
        res.json({ success: false, message: error.message });
      }
    },

    // Get educator courses
    getEducatorCourses: async (req, res) => {
      try {
        const educator = req.auth.userId;
        const courses = await Course.find({ educator });
        res.json({ success: true, courses });
      } catch (error) {
        res.json({ success: false, message: error.message });
      }
    },

    // Get educator dashboard data
    educatorDashboardData: async (req, res) => {
      try {
        const educator = req.auth.userId;

        const courses = await Course.find({ educator });

        const totalCourses = courses.length;

        const courseIds = courses.map(course => course._id);

        // Calculate total earnings from purchases
        const purchases = await Purchase.find({
          courseId: { $in: courseIds },
          status: 'completed'
        });

        const totalEarnings = purchases.reduce((sum, purchase) => sum + purchase.amount, 0);

        // Collect unique enrolled student IDs with their course titles
        const enrolledStudentsData = [];
        for (const course of courses) {
          const students = await User.find({
            _id: { $in: course.enrolledStudents }
          }, 'name imageUrl');

          students.forEach(student => {
            enrolledStudentsData.push({
              courseTitle: course.courseTitle,
              student
            });
          });
        }

        res.json({
          success: true,
          dashboardData: {
            totalEarnings,
            enrolledStudentsData,
            totalCourses
          }
        });
      } catch (error) {
        res.json({ success: false, message: error.message });
      }
    },

    // Get enrolled students data
    getEnrolledStudentsData: async (req, res) => {
      try {
        const educator = req.auth.userId;

        // Fetch all courses created by the educator
        const courses = await Course.find({ educator });

        // Get the list of course IDs
        const courseIds = courses.map(course => course._id);

        // Fetch purchases with user and course data
        const purchases = await Purchase.find({
          courseId: { $in: courseIds },
          status: 'completed'
        }).populate('userId', 'name imageUrl').populate('courseId', 'courseTitle');

        // enrolled students data
        const enrolledStudents = purchases.map(purchase => ({
          student: purchase.userId,
          courseTitle: purchase.courseId.courseTitle,
          purchaseDate: purchase.createdAt
        }));

        res.json({
          success: true,
          enrolledStudents
        });
      } catch (error) {
        res.json({
          success: false,
          message: error.message
        });
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

  describe('Educator Role Management', () => {
    it('should update user role to educator', async () => {
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

  describe('Course Creation and Management', () => {
    it('should create a new course with thumbnail', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'educator_123'
        },
        body: {
          courseData: JSON.stringify({
            courseTitle: 'JavaScript Fundamentals',
            courseDescription: '<p>Learn the basics of JavaScript</p>',
            coursePrice: 49.99,
            discount: 20,
            courseContent: [
              {
                chapterId: 'chapter_1',
                chapterOrder: 1,
                chapterTitle: 'Introduction to JavaScript',
                chapterContent: [
                  {
                    lectureId: 'lecture_1',
                    lectureTitle: 'What is JavaScript?',
                    lectureDuration: 15,
                    lectureUrl: 'https://youtube.com/watch?v=123',
                    isPreviewFree: true,
                    lectureOrder: 1
                  }
                ]
              }
            ]
          })
        },
        file: {
          path: '/tmp/upload/image.jpg'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Mock course object
      const mockCourse = {
        _id: 'course_123',
        courseTitle: 'JavaScript Fundamentals',
        courseDescription: '<p>Learn the basics of JavaScript</p>',
        coursePrice: 49.99,
        discount: 20,
        educator: 'educator_123',
        courseContent: [
          {
            chapterId: 'chapter_1',
            chapterOrder: 1,
            chapterTitle: 'Introduction to JavaScript',
            chapterContent: [
              {
                lectureId: 'lecture_1',
                lectureTitle: 'What is JavaScript?',
                lectureDuration: 15,
                lectureUrl: 'https://youtube.com/watch?v=123',
                isPreviewFree: true,
                lectureOrder: 1
              }
            ]
          }
        ],
        save: sandbox.stub().resolves()
      };
      
      // Stub Course.create to return mock course
      const createStub = sandbox.stub(Course, 'create').resolves(mockCourse);
      
      // Stub cloudinary.v2.uploader.upload to return mock upload result
      const uploadStub = sandbox.stub(cloudinary.v2.uploader, 'upload').resolves({
        secure_url: 'https://cloudinary.com/images/course_123.jpg'
      });
      
      // Call the controller method
      await educatorController.addCourse(req, res);
      
      // Verify that Course.create was called with the correct data
      expect(createStub.calledOnce).to.be.true;
      const createArg = createStub.firstCall.args[0];
      expect(createArg.courseTitle).to.equal('JavaScript Fundamentals');
      expect(createArg.coursePrice).to.equal(49.99);
      expect(createArg.discount).to.equal(20);
      expect(createArg.educator).to.equal('educator_123');
      
      // Verify that cloudinary upload was called
      expect(uploadStub.calledOnce).to.be.true;
      expect(uploadStub.firstCall.args[0]).to.equal('/tmp/upload/image.jpg');
      
      // Verify that course.save was called after thumbnail was set
      expect(mockCourse.courseThumbnail).to.equal('https://cloudinary.com/images/course_123.jpg');
      expect(mockCourse.save.calledOnce).to.be.true;
      
      // Verify that the response indicates success
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: true,
        message: 'Course Added'
      });
    });

    it('should reject course creation without a thumbnail', async () => {
      // Mock request and response objects without file
      const req = {
        auth: {
          userId: 'educator_123'
        },
        body: {
          courseData: JSON.stringify({
            courseTitle: 'JavaScript Fundamentals',
            courseDescription: '<p>Learn the basics of JavaScript</p>',
            coursePrice: 49.99,
            discount: 20,
            courseContent: []
          })
        },
        file: null // No thumbnail attached
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Call the controller method
      await educatorController.addCourse(req, res);
      
      // Verify that the response indicates failure due to missing thumbnail
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: false,
        message: 'Thumbnail Not Attached'
      });
    });

    it('should retrieve all courses for an educator', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'educator_123'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Mock courses
      const mockCourses = [
        {
          _id: 'course_1',
          courseTitle: 'JavaScript Fundamentals',
          coursePrice: 49.99,
          discount: 20
        },
        {
          _id: 'course_2',
          courseTitle: 'Advanced JavaScript',
          coursePrice: 79.99,
          discount: 10
        }
      ];
      
      // Stub Course.find to return mock courses
      const findStub = sandbox.stub(Course, 'find').resolves(mockCourses);
      
      // Call the controller method
      await educatorController.getEducatorCourses(req, res);
      
      // Verify that Course.find was called with the correct educator ID
      expect(findStub.calledOnce).to.be.true;
      expect(findStub.firstCall.args[0]).to.deep.equal({ educator: 'educator_123' });
      
      // Verify that the response contains the courses
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: true,
        courses: mockCourses
      });
    });
  });

  describe('Dashboard with Analytics', () => {
    it('should retrieve dashboard data with analytics', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'educator_123'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Mock courses
      const mockCourses = [
        {
          _id: 'course_1',
          courseTitle: 'JavaScript Fundamentals',
          enrolledStudents: ['student_1', 'student_2']
        },
        {
          _id: 'course_2',
          courseTitle: 'Advanced JavaScript',
          enrolledStudents: ['student_3']
        }
      ];
      
      // Mock purchases
      const mockPurchases = [
        {
          courseId: 'course_1',
          amount: 39.99,
          status: 'completed'
        },
        {
          courseId: 'course_1',
          amount: 39.99,
          status: 'completed'
        },
        {
          courseId: 'course_2',
          amount: 71.99,
          status: 'completed'
        }
      ];
      
      // Mock students
      const mockStudents = [
        {
          _id: 'student_1',
          name: 'John Doe',
          imageUrl: 'https://example.com/john.jpg'
        },
        {
          _id: 'student_2',
          name: 'Jane Smith',
          imageUrl: 'https://example.com/jane.jpg'
        }
      ];
      
      // Stub Course.find to return mock courses
      sandbox.stub(Course, 'find').resolves(mockCourses);
      
      // Stub Purchase.find to return mock purchases
      sandbox.stub(Purchase, 'find').resolves(mockPurchases);
      
      // Stub User.find to return mock students for the first course
      const userFindStub = sandbox.stub(User, 'find');
      userFindStub.onFirstCall().resolves(mockStudents);
      userFindStub.onSecondCall().resolves([]);
      
      // Call the controller method
      await educatorController.educatorDashboardData(req, res);
      
      // Verify that Course.find was called with the correct educator ID
      expect(Course.find.calledOnce).to.be.true;
      expect(Course.find.firstCall.args[0]).to.deep.equal({ educator: 'educator_123' });
      
      // Verify that Purchase.find was called with the correct course IDs and status
      expect(Purchase.find.calledOnce).to.be.true;
      expect(Purchase.find.firstCall.args[0]).to.deep.equal({
        courseId: { $in: ['course_1', 'course_2'] },
        status: 'completed'
      });
      
      // Verify that User.find was called for each course's enrolled students
      expect(User.find.calledTwice).to.be.true;
      
      // Verify that the response contains the dashboard data
      expect(res.json.calledOnce).to.be.true;
      
      const responseData = res.json.firstCall.args[0];
      expect(responseData.success).to.be.true;
      expect(responseData.dashboardData.totalCourses).to.equal(2);
      expect(responseData.dashboardData.totalEarnings).to.equal(151.97); // 39.99 + 39.99 + 71.99
      
      // Verify enrolled students data
      expect(responseData.dashboardData.enrolledStudentsData.length).to.equal(2);
      expect(responseData.dashboardData.enrolledStudentsData[0].courseTitle).to.equal('JavaScript Fundamentals');
      expect(responseData.dashboardData.enrolledStudentsData[0].student.name).to.equal('John Doe');
    });

    it('should handle errors when retrieving dashboard data', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'educator_123'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Create an error to be thrown
      const error = new Error('Database connection error');
      
      // Stub Course.find to throw an error
      sandbox.stub(Course, 'find').rejects(error);
      
      // Call the controller method
      await educatorController.educatorDashboardData(req, res);
      
      // Verify that the response indicates failure
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: false,
        message: error.message
      });
    });
  });

  describe('Student Enrollment Tracking', () => {
    it('should retrieve enrolled students data', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'educator_123'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Mock courses
      const mockCourses = [
        {
          _id: 'course_1',
          courseTitle: 'JavaScript Fundamentals'
        },
        {
          _id: 'course_2',
          courseTitle: 'Advanced JavaScript'
        }
      ];
      
      // Mock purchases with populated data
      const mockPurchases = [
        {
          userId: {
            _id: 'student_1',
            name: 'John Doe',
            imageUrl: 'https://example.com/john.jpg'
          },
          courseId: {
            _id: 'course_1',
            courseTitle: 'JavaScript Fundamentals'
          },
          createdAt: new Date('2023-01-15')
        },
        {
          userId: {
            _id: 'student_2',
            name: 'Jane Smith',
            imageUrl: 'https://example.com/jane.jpg'
          },
          courseId: {
            _id: 'course_1',
            courseTitle: 'JavaScript Fundamentals'
          },
          createdAt: new Date('2023-01-20')
        },
        {
          userId: {
            _id: 'student_3',
            name: 'Bob Johnson',
            imageUrl: 'https://example.com/bob.jpg'
          },
          courseId: {
            _id: 'course_2',
            courseTitle: 'Advanced JavaScript'
          },
          createdAt: new Date('2023-01-25')
        }
      ];
      
      // Stub Course.find to return mock courses
      sandbox.stub(Course, 'find').resolves(mockCourses);
      
      // Stub Purchase.find to return mock purchases with populated data
      const purchaseFindStub = sandbox.stub(Purchase, 'find').returns({
        populate: sandbox.stub().returns({
          populate: sandbox.stub().resolves(mockPurchases)
        })
      });
      
      // Call the controller method
      await educatorController.getEnrolledStudentsData(req, res);
      
      // Verify that Course.find was called with the correct educator ID
      expect(Course.find.calledOnce).to.be.true;
      expect(Course.find.firstCall.args[0]).to.deep.equal({ educator: 'educator_123' });
      
      // Verify that Purchase.find was called with the correct course IDs and status
      expect(purchaseFindStub.calledOnce).to.be.true;
      expect(purchaseFindStub.firstCall.args[0]).to.deep.equal({
        courseId: { $in: ['course_1', 'course_2'] },
        status: 'completed'
      });
      
      // Verify that the response contains the enrolled students data
      expect(res.json.calledOnce).to.be.true;
      
      const responseData = res.json.firstCall.args[0];
      expect(responseData.success).to.be.true;
      expect(responseData.enrolledStudents.length).to.equal(3);
      
      // Verify the structure of the enrolled students data
      expect(responseData.enrolledStudents[0].student._id).to.equal('student_1');
      expect(responseData.enrolledStudents[0].courseTitle).to.equal('JavaScript Fundamentals');
      expect(responseData.enrolledStudents[0].purchaseDate).to.deep.equal(new Date('2023-01-15'));
      
      expect(responseData.enrolledStudents[2].student._id).to.equal('student_3');
      expect(responseData.enrolledStudents[2].courseTitle).to.equal('Advanced JavaScript');
    });

    it('should handle errors when retrieving enrolled students data', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'educator_123'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Create an error to be thrown
      const error = new Error('Database connection error');
      
      // Stub Course.find to throw an error
      sandbox.stub(Course, 'find').rejects(error);
      
      // Call the controller method
      await educatorController.getEnrolledStudentsData(req, res);
      
      // Verify that the response indicates failure
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: false,
        message: error.message
      });
    });
  });
});