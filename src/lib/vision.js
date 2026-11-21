import { DrawingUtils, FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';

const WASM_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/models/gesture_recognizer.task';

export async function createGestureRecognizer() {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  try {
    return await GestureRecognizer.createFromOptions(fileset, options('GPU'));
  } catch (error) {
    console.warn('GPU delegate unavailable, falling back to CPU:', error.message);
    return GestureRecognizer.createFromOptions(fileset, options('CPU'));
  }
}

export function drawHands(canvas, result) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!result?.landmarks?.length) return;
  const draw = new DrawingUtils(ctx);
  for (const landmarks of result.landmarks) {
    draw.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, { color: '#F5C542', lineWidth: 4 });
    draw.drawLandmarks(landmarks, { color: '#FFFFFF', fillColor: '#FFFFFF', radius: 3 });
  }
}
