const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
app.use(bodyParser.json());

/**
 * ✅ Reusable Notification Sender with Error Handling
 */
async function sendNotificationWithErrorHandling(message) {
  try {
    const response = await admin.messaging().send(message);
    return { success: true, response };
  } catch (error) {
    console.error('❌ FCM Send Error:', error);

    let userMessage = 'Unknown error sending notification';
    let statusCode = 500;

    switch (error.code) {
      case 'messaging/invalid-argument':
        userMessage = 'Invalid argument — check the payload structure.';
        statusCode = 400;
        break;
      case 'messaging/invalid-registration-token':
        userMessage = 'Invalid FCM token. Please verify the device token.';
        statusCode = 400;
        break;
      case 'messaging/registration-token-not-registered':
        userMessage = 'The FCM token is no longer registered. Device must re-register.';
        statusCode = 410; // 410 Gone
        break;
      case 'messaging/mismatched-credential':
        userMessage = 'Token does not belong to this Firebase project.';
        statusCode = 403;
        break;
      default:
        userMessage = error.message || 'Unexpected error sending FCM message.';
    }

    return {
      success: false,
      statusCode,
      error: {
        code: error.code,
        message: userMessage
      }
    };
  }
}

/**
 * ✅ Send Basic Notification
 */
app.post('/send/basic', async (req, res) => {
  const { token, title, body } = req.body;

  const message = {
    token,
    notification: { title, body, sound: 'default' },
    data: {
      notification_type: 'test_basic',
      order_no: 'TEST-123',
      click_action: 'FLUTTER_NOTIFICATION_CLICK'
    },
    apns: { payload: { aps: { alert: { title, body }, sound: 'default' } } },
    android: { priority: 'high' }
  };

  const result = await sendNotificationWithErrorHandling(message);
  if (!result.success) {
    return res.status(result.statusCode).json(result);
  }

  res.json({ success: true, message: 'Basic notification sent successfully', response: result.response });
});

/**
 * ✅ Send Background Notification
 */
app.post('/send/background', async (req, res) => {
  const { token, title, body,orderId,delivery_status, updated_by, custom_data } = req.body;
      const payload = {
      notification_type: 'order_delivered',
      order_no: `${orderId}`,
      updated_on: new Date().toISOString(),
      payload: {
        updated_by: updated_by ? updated_by.toString() : '',
        delivery_status: delivery_status || 'UNKNOWN',
        custom_data: custom_data || 'N/A',
        orderId: orderId
      }
    };
  const message = {
    token,
    data: {
      title,
      body,
      notification_type: 'order_delivered',
        order_no: `${orderId}`,
        delivery_status: delivery_status || 'UNKNOWN',
        updated_by: updated_by ? updated_by.toString() : '',
        payload: JSON.stringify(payload),
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
    },
    apns: {
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
          badge: 1,
          'content-available': 1
        }
      },
      headers: { 'apns-priority': '5' }
    },
    android: { priority: 'high' }
  };

  const result = await sendNotificationWithErrorHandling(message);
  if (!result.success) {
    return res.status(result.statusCode).json(result);
  }

  res.json({ success: true, message: 'Background notification sent successfully', response: result.response });
});


/**
 * ✅ Send Silent Notification (Fixed)
 */
app.post('/send/silent', async (req, res) => {
  try {
    const {token,order_id,delivery_status,updated_by,custom_data,driver_id,delivery_time,delivery_distance,ready_time,restaurant_name,pickup,dropoff} = req.body;

    // ✅ Validation
    if (!token || !order_id || !delivery_status || !updated_by) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: token, order_id, delivery_status, updated_by',
      });
    }

    const safeDriverId = driver_id ? driver_id.toString() : updated_by.toString();

    // ✅ Build the inner payload (PayloadPayload)
    const payloadPayload = {
      driver_id: safeDriverId,
      delivery_status,
      custom_data: custom_data || 'status update',
      status: delivery_status,
      orderId: parseInt(order_id),
      delivery_time: delivery_time || null,
      delivery_distance: delivery_distance || null,
      ready_time: ready_time || null,
      restaurant_name: restaurant_name || null
    };

    // ✅ Optional AddressPayloads (pickup/dropoff)
    const pickupPayload = pickup || { lat: 0.0, lng: 0.0, name: 'Pickup Location' };
    const dropoffPayload = dropoff || { lat: 0.0, lng: 0.0, name: 'Dropoff Location' };

    // ✅ Full PayloadModel
    const payloadModel = {
      title: 'Order Update',
      description: `Order #${order_id} status changed to ${delivery_status}`,
      model_type: 'order',
      model_id: parseInt(order_id),
      test_mode: false,
      notification_type: 'silent_update',
      order_no: order_id.toString(),
      updated_on: new Date().toISOString(),
      payload: payloadPayload,
      pickup: pickupPayload,
      dropoff: dropoffPayload
    };

    // ✅ Message sent to FCM (matches NotificationResponses model)
    const message = {
      token,
      data: {
        action: 'FLUTTER_NOTIFICATION_CLICK',
        silent: 'false',
        order_id: order_id.toString(),
        notification_type: 'silent_update',
        payload: JSON.stringify(payloadModel),
        user_id: updated_by.toString(),
        controller: 'order_controller',
        timestamp: new Date().toISOString(),
        background_update: 'false'
      },
    apns: {
        payload: {
          aps: {
            alert: {
              title: `📦 Order #${order_id} ${delivery_status}`,
               body: `Your order from ${restaurant_name} is now ${delivery_status}. Estimated delivery:`,
            },
            sound:'offer_notification.caf',
            // badge: 1
          }
        }
      } 
    };

    const result = await sendNotificationWithErrorHandling(message);

    if (!result.success) {
      return res.status(result.statusCode).json(result);
    }

    // ✅ Response back to client (for debugging / logging)
    res.json({
      success: true,
      message: 'Silent notification sent successfully',
      order_id,
      sound_used: "offer_notification.caf",
      delivery_status,
      status_code: 200,
      payload: payloadModel,
      updated_by,
      updated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Silent Notification Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
});


/**
 * ✅ Send Custom Sound + Badge Notification
 */

app.post('/send/sound', async (req, res) => {
  const { token, title, body } = req.body;

  const message = {
    token,
    notification: { title, body, sound: 'default' },
    data: { notification_type: 'sound_test', order_no: 'SOUND-789' },
    apns: { payload: { aps: { alert: { title, body }, sound: 'default', badge: 5 } } },
    android: { priority: 'high' }
  };

  const result = await sendNotificationWithErrorHandling(message);
  if (!result.success) {
    return res.status(result.statusCode).json(result);
  }

  res.json({ success: true, message: 'Notification with sound sent successfully', response: result.response });
});

app.post('/send/assignment', async (req, res) => {
  try {
     const { token, order_id, delivery_status, assigned_rider_id, live_activity_token } = req.body;
    const payload = {
      notification_type: 'order_assigned',
      order_no: `${order_id}`,
      updated_on: new Date().toISOString(),
      payload: {
        driver_id: assigned_rider_id.toString(),
        delivery_status,
        status: delivery_status,
        orderId: order_id,
      },
    };

    // FCM expects all data fields as strings!
    const message = {
      token,
      data: {
        notification_type: 'order_assigned',
        order_no: `${order_id}`,
        delivery_status,
        assigned_rider_id: assigned_rider_id.toString(),
        payload: JSON.stringify(payload),
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      notification: {
        title: '📦 New Order Assigned',
        body: `You have been assigned order #${order_id}.`,
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: '📦 New Order Assigned',
              body: `You have been assigned order #${order_id}.`,
            },
            sound: 'default',
          },
        },
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
        },
      },
    };

    // Send notification with proper error handling
    const sendResult = await sendNotificationWithErrorHandling(message);

    if (!sendResult.success) {
      return res.status(sendResult.statusCode).json(sendResult);
    }

    // ✅ Response structure same as your example
    const responsePayload = {
      success: true,
      message: 'Assignment notification sent successfully',
      order_id,
      delivery_status,
      assigned_rider_id,
      status_code: 200,
      payload,
      to_user_id: assigned_rider_id,
      updated_at: new Date().toISOString(),
    };

    res.json(responsePayload);
  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send notification',
      error: error.message,
    });
  }
});
/**
 * ✅ Start Server
 */

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
