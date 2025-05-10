const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const cors = require("cors");
require("dotenv").config();

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors({
  origin: "*", // Update to your Shopify domain for production
}));

// Google Drive Auth
const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});
const drive = google.drive({ version: "v3", auth });

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

app.post("/upload", upload.single("video"), async (req, res) => {
  try {
    const filePath = req.file.path;

    // Upload to Google Drive
    const fileMetadata = {
      name: req.file.originalname,
      parents: process.env.FOLDER_ID ? [process.env.FOLDER_ID] : [],
    };
    const media = {
      mimeType: req.file.mimetype,
      body: fs.createReadStream(filePath),
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: "id, name",
    });

    // Make it public
    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    const viewLink = `https://drive.google.com/file/d/${file.data.id}/preview`;

    // Email Notification
    await transporter.sendMail({
      from: `"Shopify Upload" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: "New Video Uploaded",
      html: `
        <h3>New Video Uploaded</h3>
        <p><strong>File Name:</strong> ${file.data.name}</p>
        <p><a href="${viewLink}" target="_blank">View Video</a></p>
      `,
    });

    fs.unlinkSync(filePath); // Remove local file

    res.json({
      success: true,
      fileName: file.data.name,
      viewLink,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ success: false, error: "Upload failed." });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
