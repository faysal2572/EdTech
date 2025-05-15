import { expect } from 'chai';
import sinon from 'sinon';

describe('Content Organization Tests', () => {
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
    findById: () => {},
    create: () => {},
    findByIdAndUpdate: () => {}
  };

  // Mock controller functions for content organization
  const contentController = {
    // Get course by ID with hierarchical structure
    getCourseById: async (req, res) => {
      const { id } = req.params;

      try {
        const courseData = await Course.findById(id)
          .populate({ path: 'educator' });

        // Remove lectureUrl if isPreviewFree is false and user is not enrolled
        const isEnrolled = req.isEnrolled || false;
        
        courseData.courseContent.forEach(chapter => {
          chapter.chapterContent.forEach(lecture => {
            if (!lecture.isPreviewFree && !isEnrolled) {
              lecture.lectureUrl = "";
            }
          });
        });

        // Sort chapters and lectures by order
        courseData.courseContent.sort((a, b) => a.chapterOrder - b.chapterOrder);
        courseData.courseContent.forEach(chapter => {
          chapter.chapterContent.sort((a, b) => a.lectureOrder - b.lectureOrder);
        });

        res.json({ success: true, courseData });
      } catch (error) {
        res.json({ success: false, message: error.message });
      }
    },

    // Add a new chapter to a course
    addChapter: async (req, res) => {
      try {
        const { courseId, chapterData } = req.body;
        const educatorId = req.auth.userId;

        const course = await Course.findById(courseId);

        if (!course) {
          return res.json({ success: false, message: 'Course not found' });
        }

        if (course.educator.toString() !== educatorId) {
          return res.json({ success: false, message: 'Unauthorized' });
        }

        // Get the highest chapter order and increment by 1
        let maxOrder = 0;
        if (course.courseContent && course.courseContent.length > 0) {
          maxOrder = Math.max(...course.courseContent.map(chapter => chapter.chapterOrder));
        }

        const newChapter = {
          chapterId: chapterData.chapterId,
          chapterTitle: chapterData.chapterTitle,
          chapterOrder: maxOrder + 1,
          chapterContent: []
        };

        course.courseContent.push(newChapter);
        await course.save();

        res.json({ success: true, message: 'Chapter added', chapter: newChapter });
      } catch (error) {
        res.json({ success: false, message: error.message });
      }
    },

    // Add a lecture to a chapter
    addLecture: async (req, res) => {
      try {
        const { courseId, chapterId, lectureData } = req.body;
        const educatorId = req.auth.userId;

        const course = await Course.findById(courseId);

        if (!course) {
          return res.json({ success: false, message: 'Course not found' });
        }

        if (course.educator.toString() !== educatorId) {
          return res.json({ success: false, message: 'Unauthorized' });
        }

        const chapterIndex = course.courseContent.findIndex(
          chapter => chapter.chapterId === chapterId
        );

        if (chapterIndex === -1) {
          return res.json({ success: false, message: 'Chapter not found' });
        }

        // Validate video URL
        if (!lectureData.lectureUrl || !isValidVideoUrl(lectureData.lectureUrl)) {
          return res.json({ success: false, message: 'Invalid video URL' });
        }

        // Get the highest lecture order and increment by 1
        let maxOrder = 0;
        if (course.courseContent[chapterIndex].chapterContent.length > 0) {
          maxOrder = Math.max(
            ...course.courseContent[chapterIndex].chapterContent.map(
              lecture => lecture.lectureOrder
            )
          );
        }

        const newLecture = {
          lectureId: lectureData.lectureId,
          lectureTitle: lectureData.lectureTitle,
          lectureDuration: lectureData.lectureDuration,
          lectureUrl: lectureData.lectureUrl,
          isPreviewFree: lectureData.isPreviewFree || false,
          lectureOrder: maxOrder + 1
        };

        course.courseContent[chapterIndex].chapterContent.push(newLecture);
        await course.save();

        res.json({ success: true, message: 'Lecture added', lecture: newLecture });
      } catch (error) {
        res.json({ success: false, message: error.message });
      }
    },

    // Reorder chapters
    reorderChapters: async (req, res) => {
      try {
        const { courseId, chapterOrders } = req.body;
        const educatorId = req.auth.userId;

        const course = await Course.findById(courseId);

        if (!course) {
          return res.json({ success: false, message: 'Course not found' });
        }

        if (course.educator.toString() !== educatorId) {
          return res.json({ success: false, message: 'Unauthorized' });
        }

        // Update chapter orders
        chapterOrders.forEach(order => {
          const chapter = course.courseContent.find(
            ch => ch.chapterId === order.chapterId
          );
          if (chapter) {
            chapter.chapterOrder = order.order;
          }
        });

        await course.save();

        res.json({ success: true, message: 'Chapters reordered' });
      } catch (error) {
        res.json({ success: false, message: error.message });
      }
    },

    // Reorder lectures within a chapter
    reorderLectures: async (req, res) => {
      try {
        const { courseId, chapterId, lectureOrders } = req.body;
        const educatorId = req.auth.userId;

        const course = await Course.findById(courseId);

        if (!course) {
          return res.json({ success: false, message: 'Course not found' });
        }

        if (course.educator.toString() !== educatorId) {
          return res.json({ success: false, message: 'Unauthorized' });
        }

        const chapterIndex = course.courseContent.findIndex(
          chapter => chapter.chapterId === chapterId
        );

        if (chapterIndex === -1) {
          return res.json({ success: false, message: 'Chapter not found' });
        }

        // Update lecture orders
        lectureOrders.forEach(order => {
          const lecture = course.courseContent[chapterIndex].chapterContent.find(
            lec => lec.lectureId === order.lectureId
          );
          if (lecture) {
            lecture.lectureOrder = order.order;
          }
        });

        await course.save();

        res.json({ success: true, message: 'Lectures reordered' });
      } catch (error) {
        res.json({ success: false, message: error.message });
      }
    }
  };

  // Helper function to validate video URLs
  function isValidVideoUrl(url) {
    // Simple validation for YouTube and Vimeo URLs
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    const vimeoRegex = /^(https?:\/\/)?(www\.)?(vimeo\.com)\/.+$/;
    return youtubeRegex.test(url) || vimeoRegex.test(url);
  }

  describe('Hierarchical Course Structure', () => {
    it('should retrieve course with hierarchical structure', async () => {
      // Mock course data with hierarchical structure
      const mockCourse = {
        _id: 'course_123',
        courseTitle: 'JavaScript Fundamentals',
        educator: {
          _id: 'educator_123',
          name: 'John Doe'
        },
        courseContent: [
          {
            chapterId: 'chapter_2',
            chapterTitle: 'JavaScript Variables',
            chapterOrder: 2,
            chapterContent: [
              {
                lectureId: 'lecture_3',
                lectureTitle: 'Variable Types',
                lectureDuration: 20,
                lectureUrl: 'https://youtube.com/watch?v=789',
                isPreviewFree: false,
                lectureOrder: 1
              },
              {
                lectureId: 'lecture_4',
                lectureTitle: 'Variable Scope',
                lectureDuration: 15,
                lectureUrl: 'https://youtube.com/watch?v=101112',
                isPreviewFree: true,
                lectureOrder: 2
              }
            ]
          },
          {
            chapterId: 'chapter_1',
            chapterTitle: 'Introduction to JavaScript',
            chapterOrder: 1,
            chapterContent: [
              {
                lectureId: 'lecture_2',
                lectureTitle: 'JavaScript History',
                lectureDuration: 10,
                lectureUrl: 'https://youtube.com/watch?v=456',
                isPreviewFree: false,
                lectureOrder: 2
              },
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
      };
      
      // Mock request and response objects
      const req = {
        params: {
          id: 'course_123'
        },
        isEnrolled: false
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
      await contentController.getCourseById(req, res);
      
      // Verify that Course.findById was called with the correct ID
      expect(findByIdStub.calledOnce).to.be.true;
      expect(findByIdStub.firstCall.args[0]).to.equal('course_123');
      
      // Verify that the response contains the course data
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.true;
      
      const returnedCourse = res.json.firstCall.args[0].courseData;
      
      // Verify that chapters are sorted by order
      expect(returnedCourse.courseContent[0].chapterId).to.equal('chapter_1');
      expect(returnedCourse.courseContent[0].chapterOrder).to.equal(1);
      expect(returnedCourse.courseContent[1].chapterId).to.equal('chapter_2');
      expect(returnedCourse.courseContent[1].chapterOrder).to.equal(2);
      
      // Verify that lectures within chapters are sorted by order
      expect(returnedCourse.courseContent[0].chapterContent[0].lectureId).to.equal('lecture_1');
      expect(returnedCourse.courseContent[0].chapterContent[0].lectureOrder).to.equal(1);
      expect(returnedCourse.courseContent[0].chapterContent[1].lectureId).to.equal('lecture_2');
      expect(returnedCourse.courseContent[0].chapterContent[1].lectureOrder).to.equal(2);
      
      // Verify that free preview lecture URLs are preserved
      expect(returnedCourse.courseContent[0].chapterContent[0].lectureUrl).to.equal('https://youtube.com/watch?v=123');
      
      // Verify that non-free preview lecture URLs are removed for non-enrolled users
      expect(returnedCourse.courseContent[0].chapterContent[1].lectureUrl).to.equal('');
    });

    it('should preserve all lecture URLs for enrolled users', async () => {
      // Mock course data with hierarchical structure
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
            chapterTitle: 'Introduction to JavaScript',
            chapterOrder: 1,
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
          }
        ]
      };
      
      // Mock request and response objects for enrolled user
      const req = {
        params: {
          id: 'course_123'
        },
        isEnrolled: true // User is enrolled
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Create a deep copy of the mock course to verify modifications
      const courseCopy = JSON.parse(JSON.stringify(mockCourse));
      
      // Stub Course.findById to return mock course
      sandbox.stub(Course, 'findById').returns({
        populate: sandbox.stub().returns(courseCopy)
      });
      
      // Call the controller method
      await contentController.getCourseById(req, res);
      
      // Verify that the response contains the course data
      expect(res.json.calledOnce).to.be.true;
      
      const returnedCourse = res.json.firstCall.args[0].courseData;
      
      // Verify that all lecture URLs are preserved for enrolled users
      expect(returnedCourse.courseContent[0].chapterContent[0].lectureUrl).to.equal('https://youtube.com/watch?v=123');
      expect(returnedCourse.courseContent[0].chapterContent[1].lectureUrl).to.equal('https://youtube.com/watch?v=456');
    });

    it('should add a new chapter to a course', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'educator_123'
        },
        body: {
          courseId: 'course_123',
          chapterData: {
            chapterId: 'chapter_3',
            chapterTitle: 'Advanced JavaScript Concepts'
          }
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Mock course data
      const mockCourse = {
        _id: 'course_123',
        courseTitle: 'JavaScript Fundamentals',
        educator: 'educator_123',
        courseContent: [
          {
            chapterId: 'chapter_1',
            chapterTitle: 'Introduction to JavaScript',
            chapterOrder: 1,
            chapterContent: []
          },
          {
            chapterId: 'chapter_2',
            chapterTitle: 'JavaScript Variables',
            chapterOrder: 2,
            chapterContent: []
          }
        ],
        save: sandbox.stub().resolves()
      };
      
      // Stub Course.findById to return mock course
      sandbox.stub(Course, 'findById').resolves(mockCourse);
      
      // Call the controller method
      await contentController.addChapter(req, res);
      
      // Verify that Course.findById was called with the correct ID
      expect(Course.findById.calledOnce).to.be.true;
      expect(Course.findById.firstCall.args[0]).to.equal('course_123');
      
      // Verify that the new chapter was added with correct order
      expect(mockCourse.courseContent.length).to.equal(3);
      expect(mockCourse.courseContent[2].chapterId).to.equal('chapter_3');
      expect(mockCourse.courseContent[2].chapterTitle).to.equal('Advanced JavaScript Concepts');
      expect(mockCourse.courseContent[2].chapterOrder).to.equal(3); // Incremented from the highest existing order
      expect(mockCourse.courseContent[2].chapterContent).to.deep.equal([]);
      
      // Verify that course.save was called
      expect(mockCourse.save.calledOnce).to.be.true;
      
      // Verify that the response indicates success
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.true;
      expect(res.json.firstCall.args[0].message).to.equal('Chapter added');
    });
  });

  describe('Ordered Content Delivery', () => {
    it('should reorder chapters correctly', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'educator_123'
        },
        body: {
          courseId: 'course_123',
          chapterOrders: [
            { chapterId: 'chapter_1', order: 2 },
            { chapterId: 'chapter_2', order: 1 }
          ]
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Mock course data
      const mockCourse = {
        _id: 'course_123',
        courseTitle: 'JavaScript Fundamentals',
        educator: 'educator_123',
        courseContent: [
          {
            chapterId: 'chapter_1',
            chapterTitle: 'Introduction to JavaScript',
            chapterOrder: 1,
            chapterContent: []
          },
          {
            chapterId: 'chapter_2',
            chapterTitle: 'JavaScript Variables',
            chapterOrder: 2,
            chapterContent: []
          }
        ],
        save: sandbox.stub().resolves()
      };
      
      // Stub Course.findById to return mock course
      sandbox.stub(Course, 'findById').resolves(mockCourse);
      
      // Call the controller method
      await contentController.reorderChapters(req, res);
      
      // Verify that Course.findById was called with the correct ID
      expect(Course.findById.calledOnce).to.be.true;
      expect(Course.findById.firstCall.args[0]).to.equal('course_123');
      
      // Verify that the chapter orders were updated
      expect(mockCourse.courseContent[0].chapterOrder).to.equal(2);
      expect(mockCourse.courseContent[1].chapterOrder).to.equal(1);
      
      // Verify that course.save was called
      expect(mockCourse.save.calledOnce).to.be.true;
      
      // Verify that the response indicates success
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.true;
      expect(res.json.firstCall.args[0].message).to.equal('Chapters reordered');
    });

    it('should reorder lectures within a chapter', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'educator_123'
        },
        body: {
          courseId: 'course_123',
          chapterId: 'chapter_1',
          lectureOrders: [
            { lectureId: 'lecture_1', order: 2 },
            { lectureId: 'lecture_2', order: 1 }
          ]
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Mock course data
      const mockCourse = {
        _id: 'course_123',
        courseTitle: 'JavaScript Fundamentals',
        educator: 'educator_123',
        courseContent: [
          {
            chapterId: 'chapter_1',
            chapterTitle: 'Introduction to JavaScript',
            chapterOrder: 1,
            chapterContent: [
              {
                lectureId: 'lecture_1',
                lectureTitle: 'What is JavaScript?',
                lectureOrder: 1
              },
              {
                lectureId: 'lecture_2',
                lectureTitle: 'JavaScript History',
                lectureOrder: 2
              }
            ]
          }
        ],
        save: sandbox.stub().resolves()
      };
      
      // Stub Course.findById to return mock course
      sandbox.stub(Course, 'findById').resolves(mockCourse);
      
      // Call the controller method
      await contentController.reorderLectures(req, res);
      
      // Verify that Course.findById was called with the correct ID
      expect(Course.findById.calledOnce).to.be.true;
      expect(Course.findById.firstCall.args[0]).to.equal('course_123');
      
      // Verify that the lecture orders were updated
      expect(mockCourse.courseContent[0].chapterContent[0].lectureOrder).to.equal(2);
      expect(mockCourse.courseContent[0].chapterContent[1].lectureOrder).to.equal(1);
      
      // Verify that course.save was called
      expect(mockCourse.save.calledOnce).to.be.true;
      
      // Verify that the response indicates success
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.true;
      expect(res.json.firstCall.args[0].message).to.equal('Lectures reordered');
    });
  });

  describe('Video Lecture Support', () => {
    it('should add a lecture with valid video URL', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'educator_123'
        },
        body: {
          courseId: 'course_123',
          chapterId: 'chapter_1',
          lectureData: {
            lectureId: 'lecture_3',
            lectureTitle: 'JavaScript Functions',
            lectureDuration: 25,
            lectureUrl: 'https://youtube.com/watch?v=abcdef',
            isPreviewFree: true
          }
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Mock course data
      const mockCourse = {
        _id: 'course_123',
        courseTitle: 'JavaScript Fundamentals',
        educator: 'educator_123',
        courseContent: [
          {
            chapterId: 'chapter_1',
            chapterTitle: 'Introduction to JavaScript',
            chapterOrder: 1,
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
          }
        ],
        save: sandbox.stub().resolves()
      };
      
      // Stub Course.findById to return mock course
      sandbox.stub(Course, 'findById').resolves(mockCourse);
      
      // Call the controller method
      await contentController.addLecture(req, res);
      
      // Verify that Course.findById was called with the correct ID
      expect(Course.findById.calledOnce).to.be.true;
      expect(Course.findById.firstCall.args[0]).to.equal('course_123');
      
      // Verify that the new lecture was added with correct order
      expect(mockCourse.courseContent[0].chapterContent.length).to.equal(3);
      expect(mockCourse.courseContent[0].chapterContent[2].lectureId).to.equal('lecture_3');
      expect(mockCourse.courseContent[0].chapterContent[2].lectureTitle).to.equal('JavaScript Functions');
      expect(mockCourse.courseContent[0].chapterContent[2].lectureDuration).to.equal(25);
      expect(mockCourse.courseContent[0].chapterContent[2].lectureUrl).to.equal('https://youtube.com/watch?v=abcdef');
      expect(mockCourse.courseContent[0].chapterContent[2].isPreviewFree).to.be.true;
      expect(mockCourse.courseContent[0].chapterContent[2].lectureOrder).to.equal(3); // Incremented from the highest existing order
      
      // Verify that course.save was called
      expect(mockCourse.save.calledOnce).to.be.true;
      
      // Verify that the response indicates success
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.true;
      expect(res.json.firstCall.args[0].message).to.equal('Lecture added');
    });

    it('should reject lecture with invalid video URL', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'educator_123'
        },
        body: {
          courseId: 'course_123',
          chapterId: 'chapter_1',
          lectureData: {
            lectureId: 'lecture_3',
            lectureTitle: 'JavaScript Functions',
            lectureDuration: 25,
            lectureUrl: 'https://invalid-video-url.com/video', // Invalid URL
            isPreviewFree: true
          }
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Mock course data
      const mockCourse = {
        _id: 'course_123',
        courseTitle: 'JavaScript Fundamentals',
        educator: 'educator_123',
        courseContent: [
          {
            chapterId: 'chapter_1',
            chapterTitle: 'Introduction to JavaScript',
            chapterOrder: 1,
            chapterContent: []
          }
        ],
        save: sandbox.stub().resolves()
      };
      
      // Stub Course.findById to return mock course
      sandbox.stub(Course, 'findById').resolves(mockCourse);
      
      // Call the controller method
      await contentController.addLecture(req, res);
      
      // Verify that the response indicates failure due to invalid video URL
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.false;
      expect(res.json.firstCall.args[0].message).to.equal('Invalid video URL');
      
      // Verify that course.save was not called
      expect(mockCourse.save.called).to.be.false;
    });

    it('should support Vimeo video URLs', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'educator_123'
        },
        body: {
          courseId: 'course_123',
          chapterId: 'chapter_1',
          lectureData: {
            lectureId: 'lecture_3',
            lectureTitle: 'JavaScript Functions',
            lectureDuration: 25,
            lectureUrl: 'https://vimeo.com/123456789', // Vimeo URL
            isPreviewFree: true
          }
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Mock course data
      const mockCourse = {
        _id: 'course_123',
        courseTitle: 'JavaScript Fundamentals',
        educator: 'educator_123',
        courseContent: [
          {
            chapterId: 'chapter_1',
            chapterTitle: 'Introduction to JavaScript',
            chapterOrder: 1,
            chapterContent: []
          }
        ],
        save: sandbox.stub().resolves()
      };
      
      // Stub Course.findById to return mock course
      sandbox.stub(Course, 'findById').resolves(mockCourse);
      
      // Call the controller method
      await contentController.addLecture(req, res);
      
      // Verify that the new lecture was added with Vimeo URL
      expect(mockCourse.courseContent[0].chapterContent.length).to.equal(1);
      expect(mockCourse.courseContent[0].chapterContent[0].lectureUrl).to.equal('https://vimeo.com/123456789');
      
      // Verify that course.save was called
      expect(mockCourse.save.calledOnce).to.be.true;
      
      // Verify that the response indicates success
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.true;
    });
  });
});
