// visionTest.js
const vision = require('@google-cloud/vision');

const client = new vision.ImageAnnotatorClient({
  keyFilename: 'vision-key-user.json' // path to your key file
});

async function testVisionAPI() {
  const [result] = await client.textDetection('./note1.png'); // replace with your image
  const detections = result.textAnnotations;
  console.log('Detected text:', detections[0].description);
}

testVisionAPI().catch(console.error);
