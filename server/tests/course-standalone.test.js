import { expect } from 'chai';
import sinon from 'sinon';

describe('Course Management Tests', () => {
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
  const Course = {
    create: () => {},
    findById: () => {},
    find: () => {},
    save: () => {}
  };

  const User = {
    findById: () => {}
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
      getUser: () => {}
    }
  };

  // Mock controller functions for course management
  const courseController = {
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

    // Get all courses
    getAllCourse: async (req, res) => {
      try {
        const courses = await Course.find({ isPublished: true })
          .select(['-courseContent', '-enrolledStudents'])
          .populate({ path: 'educator', select: '-password' });

        res.json({ success: true, courses });
      } catch (error) {
        res.json({ success: false, message: error.message });
      }
    },

    // Get course by ID
    getCourseId: async (req, res) => {
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

  describe('Course Creation and Publishing', () => {
    it('should create a new course with valid data', async () => {
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
      await courseController.addCourse(req, res);
      
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
      await courseController.addCourse(req, res);
      
      // Verify that the response indicates failure due to missing thumbnail
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: false,
        message: 'Thumbnail Not Attached'
      });
    });

    it('should handle errors during course creation', async () => {
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
            courseContent: []
          })
        },
        file: {
          path: '/tmp/upload/image.jpg'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Create an error to be thrown
      const error = new Error('Database connection error');
      
      // Stub Course.create to throw an error
      sandbox.stub(Course, 'create').rejects(error);
      
      // Call the controller method
      await courseController.addCourse(req, res);
      
      // Verify that the response indicates failure
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: false,
        message: error.message
      });
    });
  });

  describe('Course Content Structure', () => {
    it('should retrieve course with structured content', async () => {
      // Mock structured course data
      const mockCourse = {
        _id: 'course_123',
        courseTitle: 'JavaScript Fundamentals',
        courseDescription: '<p>Learn the basics of JavaScript</p>',
        coursePrice: 49.99,
        discount: 20,
        educator: {
          _id: 'educator_123',
          name: 'John Doe'
        },
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
              },
              {
                lectureId: 'lecture_2',
                lectureTitle: 'JavaScript History',
                lectureDuration: 10,
                lectureUrl: 'https://youtube.com/watch?v=456',
                isPreviewFree: false,
                lectureOrder: 2
              }
            ]
          },
          {
            chapterId: 'chapter_2',
            chapterOrder: 2,
            chapterTitle: 'JavaScript Variables',
            chapterContent: [
              {
                lectureId: 'lecture_3',
                lectureTitle: 'Variable Types',
                lectureDuration: 20,
                lectureUrl: 'https://youtube.com/watch?v=789',
                isPreviewFree: false,
                lectureOrder: 1
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
      await courseController.getCourseId(req, res);
      
      // Verify that Course.findById was called with the correct ID
      expect(findByIdStub.calledOnce).to.be.true;
      expect(findByIdStub.firstCall.args[0]).to.equal('course_123');
      
      // Verify that the response contains the course data
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.true;
      
      // Verify that the course structure is maintained
      const returnedCourse = res.json.firstCall.args[0].courseData;
      expect(returnedCourse.courseContent.length).to.equal(2);
      expect(returnedCourse.courseContent[0].chapterTitle).to.equal('Introduction to JavaScript');
      expect(returnedCourse.courseContent[0].chapterContent.length).to.equal(2);
      expect(returnedCourse.courseContent[1].chapterTitle).to.equal('JavaScript Variables');
      
      // Verify that non-free preview lecture URLs are removed
      expect(returnedCourse.courseContent[0].chapterContent[0].lectureUrl).to.equal('https://youtube.com/watch?v=123'); // Free preview
      expect(returnedCourse.courseContent[0].chapterContent[1].lectureUrl).to.equal(''); // Not free preview
      expect(returnedCourse.courseContent[1].chapterContent[0].lectureUrl).to.equal(''); // Not free preview
    });

    it('should handle errors when retrieving course content', async () => {
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
      await courseController.getCourseId(req, res);
      
      // Verify that the response indicates failure
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: false,
        message: error.message
      });
    });
  });

  describe('Course Thumbnails and Media Support', () => {
    it('should upload and attach course thumbnail via Cloudinary', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'educator_123'
        },
        body: {
          courseData: JSON.stringify({
            courseTitle: 'JavaScript Fundamentals',
            coursePrice: 49.99,
            discount: 20,
            courseContent: []
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
        coursePrice: 49.99,
        discount: 20,
        educator: 'educator_123',
        save: sandbox.stub().resolves()
      };
      
      // Stub Course.create to return mock course
      sandbox.stub(Course, 'create').resolves(mockCourse);
      
      // Stub cloudinary.v2.uploader.upload to return mock upload result
      const uploadStub = sandbox.stub(cloudinary.v2.uploader, 'upload').resolves({
        secure_url: 'https://cloudinary.com/images/course_123.jpg',
        public_id: 'course_123',
        format: 'jpg',
        width: 800,
        height: 600
      });
      
      // Call the controller method
      await courseController.addCourse(req, res);
      
      // Verify that cloudinary upload was called with the correct file path
      expect(uploadStub.calledOnce).to.be.true;
      expect(uploadStub.firstCall.args[0]).to.equal('/tmp/upload/image.jpg');
      
      // Verify that the thumbnail URL was set on the course
      expect(mockCourse.courseThumbnail).to.equal('https://cloudinary.com/images/course_123.jpg');
      
      // Verify that course.save was called after setting the thumbnail
      expect(mockCourse.save.calledOnce).to.be.true;
      
      // Verify that the response indicates success
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: true,
        message: 'Course Added'
      });
    });

    it('should handle Cloudinary upload errors', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'educator_123'
        },
        body: {
          courseData: JSON.stringify({
            courseTitle: 'JavaScript Fundamentals',
            coursePrice: 49.99,
            discount: 20,
            courseContent: []
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
        coursePrice: 49.99,
        discount: 20,
        educator: 'educator_123',
        save: sandbox.stub().resolves()
      };
      
      // Stub Course.create to return mock course
      sandbox.stub(Course, 'create').resolves(mockCourse);
      
      // Create an error to be thrown
      const error = new Error('Cloudinary upload failed');
      
      // Stub cloudinary.v2.uploader.upload to throw an error
      sandbox.stub(cloudinary.v2.uploader, 'upload').rejects(error);
      
      // Call the controller method
      await courseController.addCourse(req, res);
      
      // Verify that the response indicates failure
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: false,
        message: error.message
      });
    });
  });

  describe('Course Pricing with Discount Options', () => {
    it('should create a course with price and discount', async () => {
      // Mock request with price and discount
      const req = {
        auth: {
          userId: 'educator_123'
        },
        body: {
          courseData: JSON.stringify({
            courseTitle: 'JavaScript Fundamentals',
            courseDescription: '<p>Learn the basics of JavaScript</p>',
            coursePrice: 99.99,
            discount: 25, // 25% discount
            courseContent: []
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
        coursePrice: 99.99,
        discount: 25,
        educator: 'educator_123',
        save: sandbox.stub().resolves()
      };
      
      // Stub Course.create to return mock course
      const createStub = sandbox.stub(Course, 'create').resolves(mockCourse);
      
      // Stub cloudinary.v2.uploader.upload to return mock upload result
      sandbox.stub(cloudinary.v2.uploader, 'upload').resolves({
        secure_url: 'https://cloudinary.com/images/course_123.jpg'
      });
      
      // Call the controller method
      await courseController.addCourse(req, res);
      
      // Verify that Course.create was called with the correct price and discount
      expect(createStub.calledOnce).to.be.true;
      const createArg = createStub.firstCall.args[0];
      expect(createArg.coursePrice).to.equal(99.99);
      expect(createArg.discount).to.equal(25);
      
      // Verify that the response indicates success
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: true,
        message: 'Course Added'
      });
    });

    it('should handle zero discount courses', async () => {
      // Mock request with price and zero discount
      const req = {
        auth: {
          userId: 'educator_123'
        },
        body: {
          courseData: JSON.stringify({
            courseTitle: 'JavaScript Fundamentals',
            courseDescription: '<p>Learn the basics of JavaScript</p>',
            coursePrice: 49.99,
            discount: 0, // No discount
            courseContent: []
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
        discount: 0,
        educator: 'educator_123',
        save: sandbox.stub().resolves()
      };
      
      // Stub Course.create to return mock course
      const createStub = sandbox.stub(Course, 'create').resolves(mockCourse);
      
      // Stub cloudinary.v2.uploader.upload to return mock upload result
      sandbox.stub(cloudinary.v2.uploader, 'upload').resolves({
        secure_url: 'https://cloudinary.com/images/course_123.jpg'
      });
      
      // Call the controller method
      await courseController.addCourse(req, res);
      
      // Verify that Course.create was called with the correct price and discount
      expect(createStub.calledOnce).to.be.true;
      const createArg = createStub.firstCall.args[0];
      expect(createArg.coursePrice).to.equal(49.99);
      expect(createArg.discount).to.equal(0);
      
      // Verify that the response indicates success
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: true,
        message: 'Course Added'
      });
    });

    it('should handle maximum discount courses', async () => {
      // Mock request with price and maximum discount
      const req = {
        auth: {
          userId: 'educator_123'
        },
        body: {
          courseData: JSON.stringify({
            courseTitle: 'JavaScript Fundamentals',
            courseDescription: '<p>Learn the basics of JavaScript</p>',
            coursePrice: 199.99,
            discount: 100, // 100% discount (free course)
            courseContent: []
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
        coursePrice: 199.99,
        discount: 100,
        educator: 'educator_123',
        save: sandbox.stub().resolves()
      };
      
      // Stub Course.create to return mock course
      const createStub = sandbox.stub(Course, 'create').resolves(mockCourse);
      
      // Stub cloudinary.v2.uploader.upload to return mock upload result
      sandbox.stub(cloudinary.v2.uploader, 'upload').resolves({
        secure_url: 'https://cloudinary.com/images/course_123.jpg'
      });
      
      // Call the controller method
      await courseController.addCourse(req, res);
      
      // Verify that Course.create was called with the correct price and discount
      expect(createStub.calledOnce).to.be.true;
      const createArg = createStub.firstCall.args[0];
      expect(createArg.coursePrice).to.equal(199.99);
      expect(createArg.discount).to.equal(100);
      
      // Verify that the response indicates success
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: true,
        message: 'Course Added'
      });
    });
  });

  describe('Educator Course Management', () => {
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
      await courseController.getEducatorCourses(req, res);
      
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

    it('should handle errors when retrieving educator courses', async () => {
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
      await courseController.getEducatorCourses(req, res);
      
      // Verify that the response indicates failure
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: false,
        message: error.message
      });
    });
  });
});
