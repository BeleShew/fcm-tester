# 📱 Mobile App Requirements for Silent Push Notifications

## iOS Requirements

### 1. **Background App Refresh** ⚠️ CRITICAL
```swift
// In Info.plist, add:
<key>UIBackgroundModes</key>
<array>
    <string>background-processing</string>
    <string>remote-notification</string>
</array>
```

### 2. **iOS Settings Check**
- Settings → General → Background App Refresh → ON
- Settings → Your App → Background App Refresh → ON
- Settings → Notifications → Your App → Allow Notifications → ON

### 3. **iOS Code Implementation**
```swift
// In AppDelegate.swift
func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    
    print("🔔 Silent notification received: \(userInfo)")
    
    // Handle your silent notification logic here
    if let notificationType = userInfo["notification_type"] as? String {
        if notificationType == "silent_update" {
            // Process silent update
            handleSilentUpdate(userInfo)
        }
    }
    
    // IMPORTANT: Call completion handler
    completionHandler(.newData)
}

private func handleSilentUpdate(_ userInfo: [AnyHashable: Any]) {
    // Your silent notification handling logic
    print("Processing silent update...")
}
```

## Android Requirements

### 1. **Manifest Permissions**
```xml
<!-- In AndroidManifest.xml -->
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

### 2. **Firebase Messaging Service**
```kotlin
class MyFirebaseMessagingService : FirebaseMessagingService() {
    
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        
        Log.d("FCM", "Message received: ${remoteMessage.data}")
        
        // Handle data-only messages (silent notifications)
        if (remoteMessage.data.isNotEmpty()) {
            val notificationType = remoteMessage.data["notification_type"]
            
            if (notificationType == "silent_update") {
                handleSilentUpdate(remoteMessage.data)
            }
        }
    }
    
    private fun handleSilentUpdate(data: Map<String, String>) {
        // Your silent notification handling logic
        Log.d("FCM", "Processing silent update...")
    }
}
```

## Flutter Requirements

### 1. **Flutter Firebase Messaging Setup**
```dart
// In main.dart
import 'package:firebase_messaging/firebase_messaging.dart';

// Background message handler (must be top-level function)
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print('🔔 Background message: ${message.data}');
  
  if (message.data['notification_type'] == 'silent_update') {
    // Handle silent notification
    await handleSilentUpdate(message.data);
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  
  // Set background message handler
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  
  runApp(MyApp());
}

Future<void> handleSilentUpdate(Map<String, dynamic> data) async {
  // Your silent notification logic
  print('Processing silent update: $data');
}
```

## Common Issues & Solutions

### ❌ Issue 1: Notifications not received in background
**Solution:** 
- Check Background App Refresh is enabled
- Verify `content-available: 1` is set
- Remove `sound`, `badge`, `alert` from silent notifications

### ❌ Issue 2: iOS app not waking up
**Solution:**
- Add `remote-notification` to UIBackgroundModes
- Implement `didReceiveRemoteNotification` with completion handler
- Use `apns-priority: 5` for background notifications

### ❌ Issue 3: Android not receiving data-only messages
**Solution:**
- Use data-only payload (no notification object)
- Implement FirebaseMessagingService properly
- Handle in `onMessageReceived`

### ❌ Issue 4: Rate limiting by Apple
**Solution:**
- Don't send too many silent notifications (Apple limits them)
- Use `apns-priority: 5` for background
- Only send when necessary

## Testing Commands

```bash
# Test silent notification
curl -X POST http://localhost:3000/send/silent \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_FCM_TOKEN",
    "order_id": "TEST-123",
    "delivery_status": "DELIVERED",
    "updated_by": "system"
  }'
```