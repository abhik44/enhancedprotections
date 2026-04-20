import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { token, siteName, date } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Missing token" });
    }

    // 🔐 Create JWT for Google OAuth
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      iss: process.env.FIREBASE_CLIENT_EMAIL,
      sub: process.env.FIREBASE_CLIENT_EMAIL,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    };

    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

    const jwtToken = jwt.sign(payload, privateKey, {
      algorithm: "RS256",
    });

    // 🔥 Get access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwtToken}`,
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(500).json({
        error: "Failed to get access token",
        details: tokenData,
      });
    }

    // 🔥 Send notification via FCM v1
    const fcmRes = await fetch(`https://fcm.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/messages:send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token: token,
          notification: {
            title: "New Shift Assigned",
            body: `Site: ${siteName} | Date: ${date}`,
          },
          data: {
            screen: "myschedule",
          },
        },
      }),
    });

    const fcmData = await fcmRes.json();

    return res.status(200).json(fcmData);
  } catch (error) {
    console.error("FCM ERROR:", error);
    return res.status(500).json({
      error: "Notification failed",
      message: error.message,
    });
  }
}
