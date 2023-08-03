const mpFaceMesh = window;

/**
 * Solution options.
 */
const solutionOptions = {
  selfieMode: true,
  enableFaceGeometry: false,
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.8,
  minTrackingConfidence: 0.5
};


const config = {locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@` +
         `${mpFaceMesh.VERSION}/${file}`;
}};
const faceMesh = new mpFaceMesh.FaceMesh(config);
faceMesh.setOptions(solutionOptions);

window.MyFaceMesh = faceMesh;
