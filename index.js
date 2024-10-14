var apn = require("apn");
const { kv } = require('@vercel/kv');
var express = require('express');
var app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const port = process.env.PORT || 3001;

const pemKey = `
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgUUqpEqiG26nW+77b
6TgQ69lEc0DCwtOL0LZy6eqLQPWgCgYIKoZIzj0DAQehRANCAAQlBEtlcG1FITDs
8PAO3wydP2BpgVeDoDM3FhDcHFxzqNQpQ1E25lER4htW7bGz7atePlUih9p2zpGf
VwgV1Dje
-----END PRIVATE KEY-----
`.trim();
var options = {
  token: {
    key: Buffer.from(pemKey),  // Ensure this path is correct
    keyId: "79SB9M6354",  // Ensure this keyId is correct
    teamId: "RD3BT9HJWM"  // Ensure this teamId is correct
  },
  production: false  // Set to true if you are using the production environment
};

var apnProvider = new apn.Provider(options);

async function deleteAllDeviceTokens() {
  const keys = await kv.keys('*');
  for (const key of keys) {
    await kv.del(key);
  }
}
async function storeDeviceToken(token) {
  await deleteAllDeviceTokens();
  await kv.set(token, token);
}

// Fetch all device tokens from key-value store
async function getAllDeviceTokens() {
  const keys = await kv.keys('*');  // Use '*' to fetch all keys
  return keys;
}


app.get('/getDevices', async (req, res) => {
  const tokens = await getAllDeviceTokens();
  return res.json({ success: true, data: tokens });
});
app.post('/registerDevice', async (req, res) => {
 

  // if (!token) {
  //   return res.status(400).json({ success: false, message: 'Token is required' });
  // }

  try {
    await storeDeviceToken(req.body.token);
    return res.json({ success: true, message: 'Device token registered successfully' });
  } catch (error) {
    console.error('Error registering device token:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/sendVoip', async (req, res) => {
  try {
    const tokens = await getAllDeviceTokens();
console.log(tokens);
    if (!tokens || tokens.length === 0) {
      return res.status(400).json({ success: false, message: "No device tokens found" });
    }

    var note = new apn.Notification();
    note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now
    note.badge = 3;
    note.alert = "You have a new call from door";
    note.topic = "com.lockersuites.doorCall.voip";
    note.payload = {
      "aps": { "alert": "Door App Calling" },
      "id": "44d915e1-5ff4-4bed-bf13-c423048ec97a",
      "handle": "Door App Calling ...",
      "isVideo": false,
      'meeting_id': req.body.meeting_id,
      'type': req.body.type,
      'status': req.body.status,
      'token': tokens.length==0 ? "": tokens[0],
      'callerName': req.body.callerName,
    };
    console.log(note.payload);

    apnProvider.send(note, tokens[0]).then((response) => {
      let sentCount = response.sent.length;
      let failedCount = response.failed.length;

      if (failedCount > 0) {
        console.log("Failed to send notification:", response.failed);
      } else {
        console.log("Notification sent successfully:", response.sent);
      }

      return res.json({ success: true, sentCount: sentCount, failedCount: failedCount, data: note.payload });
    }).catch((error) => {
      console.error("Error sending notifications:", error);
      return res.status(500).json({ success: false, error: error.message });
    });
  } catch (error) {
    console.error("Error sending notifications:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});