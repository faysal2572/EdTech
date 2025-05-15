import { expect } from 'chai';
import sinon from 'sinon';

describe('Payment Processing Tests', () => {
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
    findById: () => {}
  };

  const Purchase = {
    create: () => {},
    findById: () => {},
    find: () => {}
  };

  // Mock stripe objects
  const stripeCheckout = {
    sessions: {
      create: () => {},
      list: () => {}
    }
  };
  
  const stripeWebhooks = {
    constructEvent: () => {}
  };
  
  const stripe = function() {
    return {
      checkout: stripeCheckout,
      webhooks: stripeWebhooks
    };
  };

  // Mock controller functions for payment processing
  const paymentController = {
    // Purchase course and create checkout session
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

    // Stripe webhook handler for payment events
    stripeWebhooks: async (request, response) => {
      const sig = request.headers['stripe-signature'];

      let event;

      try {
        event = stripe().webhooks.constructEvent(request.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        response.status(400).send(`Webhook Error: ${err.message}`);
        return;
      }

      // Handle the event
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object;
          const paymentIntentId = paymentIntent.id;

          // Getting Session Metadata
          const session = await stripe().checkout.sessions.list({
            payment_intent: paymentIntentId,
          });

          const { purchaseId } = session.data[0].metadata;

          const purchaseData = await Purchase.findById(purchaseId);
          const userData = await User.findById(purchaseData.userId);
          const courseData = await Course.findById(purchaseData.courseId.toString());

          courseData.enrolledStudents.push(userData);
          await courseData.save();

          userData.enrolledCourses.push(courseData._id);
          await userData.save();

          purchaseData.status = 'completed';
          await purchaseData.save();

          break;
        }
        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object;
          const paymentIntentId = paymentIntent.id;

          // Getting Session Metadata
          const session = await stripe().checkout.sessions.list({
            payment_intent: paymentIntentId,
          });

          const { purchaseId } = session.data[0].metadata;

          const purchaseData = await Purchase.findById(purchaseId);
          purchaseData.status = 'failed';
          await purchaseData.save();

          break;
        }
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      // Return a response to acknowledge receipt of the event
      response.json({ received: true });
    },

    // Get user purchase history
    getUserPurchases: async (req, res) => {
      try {
        const userId = req.auth.userId;
        
        const purchases = await Purchase.find({ userId })
          .populate('courseId')
          .sort({ createdAt: -1 });
        
        res.json({ success: true, purchases });
      } catch (error) {
        res.json({ success: false, message: error.message });
      }
    }
  };

  describe('Stripe Integration for Course Purchases', () => {
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
      await paymentController.purchaseCourse(req, res);
      
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
      
      // Verify that stripe.checkout.sessions.create was called with the correct parameters
      expect(stripeCreateStub.calledOnce).to.be.true;
      expect(stripeCreateStub.firstCall.args[0]).to.deep.include({
        success_url: 'http://localhost:3000/loading/my-enrollments',
        cancel_url: 'http://localhost:3000/',
        mode: 'payment',
        metadata: {
          purchaseId: 'purchase_123'
        }
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
      await paymentController.purchaseCourse(req, res);
      
      // Verify that the response indicates failure
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: false,
        message: 'Data Not Found'
      });
    });

    it('should handle errors during checkout creation', async () => {
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
        name: 'Test User'
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
      
      // Stub User.findById to return mock user
      sandbox.stub(User, 'findById').resolves(mockUser);
      
      // Stub Course.findById to return mock course
      sandbox.stub(Course, 'findById').resolves(mockCourse);
      
      // Stub Purchase.create to return mock purchase
      sandbox.stub(Purchase, 'create').resolves(mockPurchase);
      
      // Create an error to be thrown
      const error = new Error('Stripe API error');
      
      // Stub stripe.checkout.sessions.create to throw an error
      sandbox.stub(stripeCheckout.sessions, 'create').rejects(error);
      
      // Call the controller method
      await paymentController.purchaseCourse(req, res);
      
      // Verify that the response indicates failure
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: false,
        message: error.message
      });
    });
  });

  describe('Payment Tracking and Management', () => {
    it('should retrieve user purchase history', async () => {
      // Mock request and response objects
      const req = {
        auth: {
          userId: 'user_123'
        }
      };
      
      const res = {
        json: sandbox.spy()
      };
      
      // Mock purchase history
      const mockPurchases = [
        {
          _id: 'purchase_1',
          courseId: {
            _id: 'course_1',
            courseTitle: 'JavaScript Fundamentals'
          },
          amount: 79.99,
          status: 'completed',
          createdAt: new Date('2023-01-15')
        },
        {
          _id: 'purchase_2',
          courseId: {
            _id: 'course_2',
            courseTitle: 'Advanced JavaScript'
          },
          amount: 89.99,
          status: 'pending',
          createdAt: new Date('2023-01-20')
        }
      ];
      
      // Stub Purchase.find to return mock purchases
      const findStub = sandbox.stub(Purchase, 'find').returns({
        populate: sandbox.stub().returns({
          sort: sandbox.stub().resolves(mockPurchases)
        })
      });
      
      // Call the controller method
      await paymentController.getUserPurchases(req, res);
      
      // Verify that Purchase.find was called with the correct user ID
      expect(findStub.calledOnce).to.be.true;
      expect(findStub.firstCall.args[0]).to.deep.equal({ userId: 'user_123' });
      
      // Verify that the response contains the purchase history
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: true,
        purchases: mockPurchases
      });
    });

    it('should handle errors when retrieving purchase history', async () => {
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
      const error = new Error('Database connection error');
      
      // Stub Purchase.find to throw an error
      sandbox.stub(Purchase, 'find').returns({
        populate: sandbox.stub().returns({
          sort: sandbox.stub().rejects(error)
        })
      });
      
      // Call the controller method
      await paymentController.getUserPurchases(req, res);
      
      // Verify that the response indicates failure
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: false,
        message: error.message
      });
    });
  });

  describe('Checkout Session Management and Webhooks', () => {
    it('should handle successful payment webhook', async () => {
      // Mock request and response objects
      const req = {
        headers: {
          'stripe-signature': 'test_signature'
        },
        body: 'raw_body_data'
      };
      
      const res = {
        json: sandbox.spy(),
        status: sandbox.stub().returnsThis(),
        send: sandbox.spy()
      };
      
      // Mock event data
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_123456'
          }
        }
      };
      
      // Mock session data
      const mockSession = {
        data: [
          {
            metadata: {
              purchaseId: 'purchase_123'
            }
          }
        ]
      };
      
      // Mock purchase, user, and course data
      const mockPurchase = {
        userId: 'user_123',
        courseId: 'course_123',
        status: 'pending',
        save: sandbox.stub().resolves()
      };
      
      const mockUser = {
        _id: 'user_123',
        enrolledCourses: [],
        save: sandbox.stub().resolves()
      };
      
      const mockCourse = {
        _id: 'course_123',
        enrolledStudents: [],
        save: sandbox.stub().resolves()
      };
      
      // Stub stripe.webhooks.constructEvent to return mock event
      sandbox.stub(stripeWebhooks, 'constructEvent').returns(mockEvent);
      
      // Stub stripe.checkout.sessions.list to return mock session
      sandbox.stub(stripeCheckout.sessions, 'list').resolves(mockSession);
      
      // Stub Purchase.findById to return mock purchase
      sandbox.stub(Purchase, 'findById').resolves(mockPurchase);
      
      // Stub User.findById to return mock user
      sandbox.stub(User, 'findById').resolves(mockUser);
      
      // Stub Course.findById to return mock course
      sandbox.stub(Course, 'findById').resolves(mockCourse);
      
      // Call the controller method
      await paymentController.stripeWebhooks(req, res);
      
      // Verify that stripe.webhooks.constructEvent was called with the correct parameters
      expect(stripeWebhooks.constructEvent.calledOnce).to.be.true;
      expect(stripeWebhooks.constructEvent.firstCall.args[0]).to.equal('raw_body_data');
      expect(stripeWebhooks.constructEvent.firstCall.args[1]).to.equal('test_signature');
      
      // Verify that stripe.checkout.sessions.list was called with the correct payment intent ID
      expect(stripeCheckout.sessions.list.calledOnce).to.be.true;
      expect(stripeCheckout.sessions.list.firstCall.args[0]).to.deep.equal({
        payment_intent: 'pi_123456'
      });
      
      // Verify that Purchase.findById was called with the correct purchase ID
      expect(Purchase.findById.calledOnce).to.be.true;
      expect(Purchase.findById.firstCall.args[0]).to.equal('purchase_123');
      
      // Verify that the user was enrolled in the course
      expect(mockUser.enrolledCourses).to.include(mockCourse._id);
      expect(mockUser.save.calledOnce).to.be.true;
      
      // Verify that the user was added to the course's enrolled students
      expect(mockCourse.enrolledStudents).to.include(mockUser);
      expect(mockCourse.save.calledOnce).to.be.true;
      
      // Verify that the purchase status was updated to completed
      expect(mockPurchase.status).to.equal('completed');
      expect(mockPurchase.save.calledOnce).to.be.true;
      
      // Verify that the response acknowledges receipt of the event
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({ received: true });
    });

    it('should handle failed payment webhook', async () => {
      // Mock request and response objects
      const req = {
        headers: {
          'stripe-signature': 'test_signature'
        },
        body: 'raw_body_data'
      };
      
      const res = {
        json: sandbox.spy(),
        status: sandbox.stub().returnsThis(),
        send: sandbox.spy()
      };
      
      // Mock event data
      const mockEvent = {
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_123456'
          }
        }
      };
      
      // Mock session data
      const mockSession = {
        data: [
          {
            metadata: {
              purchaseId: 'purchase_123'
            }
          }
        ]
      };
      
      // Mock purchase data
      const mockPurchase = {
        status: 'pending',
        save: sandbox.stub().resolves()
      };
      
      // Stub stripe.webhooks.constructEvent to return mock event
      sandbox.stub(stripeWebhooks, 'constructEvent').returns(mockEvent);
      
      // Stub stripe.checkout.sessions.list to return mock session
      sandbox.stub(stripeCheckout.sessions, 'list').resolves(mockSession);
      
      // Stub Purchase.findById to return mock purchase
      sandbox.stub(Purchase, 'findById').resolves(mockPurchase);
      
      // Call the controller method
      await paymentController.stripeWebhooks(req, res);
      
      // Verify that the purchase status was updated to failed
      expect(mockPurchase.status).to.equal('failed');
      expect(mockPurchase.save.calledOnce).to.be.true;
      
      // Verify that the response acknowledges receipt of the event
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({ received: true });
    });

    it('should handle webhook signature verification errors', async () => {
      // Mock request and response objects
      const req = {
        headers: {
          'stripe-signature': 'invalid_signature'
        },
        body: 'raw_body_data'
      };
      
      const res = {
        json: sandbox.spy(),
        status: sandbox.stub().returnsThis(),
        send: sandbox.spy()
      };
      
      // Create an error to be thrown
      const error = new Error('Invalid signature');
      
      // Stub stripe.webhooks.constructEvent to throw an error
      sandbox.stub(stripeWebhooks, 'constructEvent').throws(error);
      
      // Call the controller method
      await paymentController.stripeWebhooks(req, res);
      
      // Verify that status was called with 400
      expect(res.status.calledOnce).to.be.true;
      expect(res.status.firstCall.args[0]).to.equal(400);
      
      // Verify that send was called with the error message
      expect(res.send.calledOnce).to.be.true;
      expect(res.send.firstCall.args[0]).to.equal('Webhook Error: Invalid signature');
    });

    it('should handle unrecognized event types', async () => {
      // Mock request and response objects
      const req = {
        headers: {
          'stripe-signature': 'test_signature'
        },
        body: 'raw_body_data'
      };
      
      const res = {
        json: sandbox.spy(),
        status: sandbox.stub().returnsThis(),
        send: sandbox.spy()
      };
      
      // Mock event data with unrecognized type
      const mockEvent = {
        type: 'unknown_event_type',
        data: {
          object: {}
        }
      };
      
      // Stub stripe.webhooks.constructEvent to return mock event
      sandbox.stub(stripeWebhooks, 'constructEvent').returns(mockEvent);
      
      // Create a spy for console.log
      const consoleLogSpy = sandbox.spy(console, 'log');
      
      // Call the controller method
      await paymentController.stripeWebhooks(req, res);
      
      // Verify that console.log was called with the unhandled event type
      expect(consoleLogSpy.calledOnce).to.be.true;
      expect(consoleLogSpy.firstCall.args[0]).to.equal('Unhandled event type unknown_event_type');
      
      // Verify that the response acknowledges receipt of the event
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({ received: true });
    });
  });
});