const { v2: cloudinary } = require('cloudinary');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function testCloudinary() {
  try {
    console.log('Testing Cloudinary ping/auth...');
    const result = await cloudinary.api.ping();
    console.log('✅ Cloudinary Ping successful:', result);

    // Test a tiny 1x1 transparent PNG upload buffer
    const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const buffer = Buffer.from(tinyPngBase64, 'base64');

    console.log('Testing buffer upload stream to folder kaphor/test...');
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'kaphor/test',
          resource_type: 'image',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(buffer);
    });

    console.log('✅ Test upload successful!');
    console.log('Public ID:', uploadResult.public_id);
    console.log('Secure URL:', uploadResult.secure_url);

    // Clean up test upload
    await cloudinary.uploader.destroy(uploadResult.public_id);
    console.log('✅ Test image cleaned up successfully!');
  } catch (err) {
    console.error('❌ Cloudinary test failed:', err);
    process.exit(1);
  }
}

testCloudinary();
