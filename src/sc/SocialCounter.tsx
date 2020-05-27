import React, { useEffect, useRef, useState } from 'react';

import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

import './SocialCounter.css';

const MAX_VALUE = 5000;
const DELAY = 100; //ms
const CYCLE = 2000; //ms

const WIDTH = 480;
const HEIGHT = 360;
const LINE = WIDTH / 2; // border from left/right in pixel

enum Direction {
  'left2right' = 'left2right',
  'right2left' = 'right2left',
  'Up2Down' = 'Up2Down',
  'Down2Up' = 'Down2Up',
}

enum Position {
  'LEFT' = 'LEFT',
  'RIGHT' = 'RIGHT',
}

type mm = number;
type pixels = number;

type Centroid = {
  x: pixels;
  y: pixels;
};

type Person = {
  id: string;
  centroid: Centroid;
  predictionPoint: Centroid;
  prediction: cocoSsd.DetectedObject;
  position: Position;
};

type Count = { left: number; right: number };
const initialInfo: { [timestamp: string]: Count } = {};

export const SocialCounter: React.FC = () => {
  let detectedPeople: Person[] = [];

  //TODO: Init the DB...
  const [leftCounter, setLeftCounter] = useState(0);
  const [rightCounter, setRightCounter] = useState(0);
  const [peopleCounter, setPeopleCounter] = useState(0);

  const [info, setInfo] = useState(initialInfo);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // When the component will mount
  useEffect(() => {
    async function fetchData() {
      await getCameraObjects();
    }
    fetchData();
  }, []);

  useEffect(() => {
    videoRef.current?.addEventListener('loadeddata', () => {
      console.log("Loaded the video's data!");
    });
  }, []);

  useEffect(() => updateInfo(), [info]);

  function updateInfo() {
    console.log(`##################################`);
    // var counter = info[0] ? `<p>Yes ${info[0].left} </p>` : '<p>No</p>';
  }

  function calculatePredictionPoint(
    person: Person,
    centroid: Centroid
  ): Centroid {
    let predictionPoint: Centroid = {
      x: 0,
      y: 0,
    };

    let deltaX = Math.abs(person.centroid.x - centroid.x) * 2;
    let deltaY = Math.abs(person.centroid.y - centroid.y) * 2;

    // Define direction
    let horizontalDirection =
      person.centroid.x <= centroid.x
        ? Direction.left2right
        : Direction.right2left;
    let verticalDirection =
      person.centroid.y <= centroid.y ? Direction.Up2Down : Direction.Down2Up;

    if (horizontalDirection === Direction.left2right) {
      predictionPoint.x = person.centroid.x + deltaX;
    } else {
      predictionPoint.x = person.centroid.x - deltaX;
    }

    if (verticalDirection === Direction.Down2Up) {
      predictionPoint.y = person.centroid.y + deltaY;
    } else {
      predictionPoint.y = person.centroid.y - deltaY;
    }

    return predictionPoint;
  }

  function calculateEuclideanDistance(
    personCentroid: Centroid,
    centroid: Centroid
  ): pixels {
    let distance = Math.pow(
      Math.pow(Math.abs(personCentroid.x - centroid.x), 2) +
        Math.pow(personCentroid.y - centroid.y, 2),
      0.5
    );

    return distance;
  }

  async function getCameraObjects(): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      const mediaStream = await startVideo();
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      const modelPromise = await cocoSsd.load();
      // check every n seconds
      // setInterval(async () => await checkFrame(modelPromise), CYCLE);
      setInterval(async () => await checkCounter(modelPromise), CYCLE);

      try {
        resolve(true);
      } catch (error) {
        reject(console.log(`An error was happening. ${error}`));
      }
    });
  }

  async function startVideo(): Promise<MediaStream> {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      return navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
        },
      });
    }
    return Promise.reject(`It was not possible to load the video`);
  }

  function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Main function
  async function checkCounter(
    modelPromise: cocoSsd.ObjectDetection
  ): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      try {
        // Reset Counters
        detectedPeople = [];
        setLeftCounter(0);
        setRightCounter(0);

        // DetectPeople
        detectedPeople = await detectPeople(modelPromise);

        console.log(`Detected People: ${detectedPeople.length}`);

        // Fetch new data after a delay
        console.log(`Wait ${DELAY * 0.001} seconds`);
        await delay(DELAY);
        await addPredictionPointsToDetetedPeople(modelPromise);

        // Verify Predictions
        await verifyPredictions(modelPromise);

        let count: Count = {
          left: leftCounter,
          right: rightCounter,
        };

        await save(count);

        // Render Predictions
        renderPredictions(detectedPeople);
        // requestAnimationFrame(() => {
        //   checkFrame(modelPromise);
        // });

        resolve(true);
      } catch (error) {
        reject(`An error on the counter was catched. ${error}`);
      }
    });
  }

  async function verifyPredictions(
    modelPromise: cocoSsd.ObjectDetection
  ): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      try {
        if (videoRef.current) {
          let predictions = await modelPromise.detect(videoRef.current);

          predictions.map((prediction: cocoSsd.DetectedObject) => {
            if (prediction.class === 'person') {
              //Calculate centroid
              let centroid = calculateCentroid(prediction);
              let minDistance = MAX_VALUE;

              // Detect the nearest Point
              if (detectedPeople.length > 0) {
                detectedPeople.map((person: Person) => {
                  let distance = calculateEuclideanDistance(
                    person.predictionPoint,
                    centroid
                  );
                  if (distance < minDistance) {
                    minDistance = distance;
                    // Associate this person to this path
                    person.prediction = prediction;
                    person.centroid = centroid;
                    person.position = calculatePosition(centroid.x);

                    // Update the counters
                    updateCounter(person.position);

                    console.log(person.id);
                    console.log(
                      `New position for ${person.id} found - ${person.centroid.x} - ${person.centroid.y}`
                    );
                  }
                });
              }
            }
          });
        }
        resolve(true);
      } catch (error) {
        reject(`It was not possible to verify the Prediction. ${error}`);
      }
    });
  }

  async function addPredictionPointsToDetetedPeople(
    modelPromise: cocoSsd.ObjectDetection
  ): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      try {
        if (videoRef.current) {
          let predictions = await modelPromise.detect(videoRef.current);

          predictions.map((prediction: cocoSsd.DetectedObject) => {
            if (prediction.class === 'person') {
              //Calculate centroid
              let centroid = calculateCentroid(prediction);

              let minDistance = MAX_VALUE;

              // Detect the nearest Point
              if (detectedPeople.length > 0) {
                detectedPeople.map((person: Person) => {
                  let distance = calculateEuclideanDistance(
                    person.centroid,
                    centroid
                  );

                  if (distance < minDistance) {
                    minDistance = distance;
                    // Associate this centroid as Prediction Point to the Person
                    person.predictionPoint = calculatePredictionPoint(
                      person,
                      centroid
                    );
                    console.log(`New Prediction for ${person.id} found`);
                  }
                });
              }
            }
          });
        }
        resolve(true);
      } catch (error) {
        reject(
          `It was not possible to calculate the prediction points for the People. ${error}`
        );
      }
    });
  }

  function calculatePosition(x: number): Position {
    let position = Position.RIGHT;
    if (x < LINE) {
      position = Position.LEFT;
    }

    return position;
  }

  async function detectPeople(
    modelPromise: cocoSsd.ObjectDetection
  ): Promise<Person[]> {
    return new Promise(async (resolve, reject) => {
      // Objects Detector
      try {
        if (videoRef.current) {
          setPeopleCounter(0);
          let predictions = await modelPromise.detect(videoRef.current);

          // Populate detectedPeople
          predictions.map((prediction: cocoSsd.DetectedObject) => {
            if (prediction.class === 'person') {
              //Calculate centroid
              let centroid = calculateCentroid(prediction);
              setPeopleCounter(peopleCounter + 1);

              const person: Person = {
                id: `Id${peopleCounter}`.toString(),
                centroid: centroid,
                predictionPoint: { x: 0, y: 0 },
                prediction: prediction,
                position: calculatePosition(centroid.x),
              };

              detectedPeople.push(person);
              console.log(`Person added ${person.id}`);
            }
          });

          resolve(detectedPeople);
        }
      } catch (error) {
        reject(`It was not possible to detect People. ${error}`);
      }
    });
  }

  function calculateCentroid(prediction: cocoSsd.DetectedObject): Centroid {
    const x = prediction.bbox[0];
    const y = prediction.bbox[1];
    const width = prediction.bbox[2];
    const height = prediction.bbox[3];

    let centroid: Centroid = {
      x: x + width / 2,
      y: y + height / 2,
    };

    return centroid;
  }

  function updateCounter(position: Position) {
    if (position === Position.LEFT) {
      setLeftCounter(leftCounter + 1);
    } else {
      setRightCounter(rightCounter + 1);
    }
  }

  //TODO: Store in some DB that info
  async function save(count: Count): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        const timestamp = new Date().valueOf().toString();
        let tmp = info;
        tmp[timestamp] = count;
        setInfo({ ...tmp });
        resolve(true);
      } catch (error) {
        reject(`It was not possible to save the data. ${error}`);
      }
    });
  }

  const renderPredictions = (detectedPeople: Person[]) => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // Line In-Out
        ctx.beginPath();
        ctx.moveTo(LINE, 0);
        ctx.lineTo(LINE - 1, 0);
        ctx.lineTo(LINE - 1, 360);
        ctx.lineTo(LINE + 1, 360);
        ctx.lineTo(LINE + 1, 0);
        ctx.fillStyle = 'yellow';
        ctx.fill();

        // Font options.
        const font = 'bold 14px Arial';
        ctx.font = font;
        ctx.textBaseline = 'top';

        detectedPeople.forEach((person: Person) => {
          const x = person.prediction.bbox[0];
          const y = person.prediction.bbox[1];
          const width = person.prediction.bbox[2]; // ctx.canvas.width;
          const height = person.prediction.bbox[3]; // ctx.canvas.height;

          console.log(`LeftCounter: ${leftCounter}`);
          console.log(`RightCounter: ${rightCounter}`);

          // Draw the bounding box.
          ctx.strokeStyle = '#575756';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, width, height);
          // Draw the label background.
          const y_score = y + 15;
          ctx.fillStyle = '#009ee3';
          const score = person.prediction.score.toPrecision(3).toString();
          ctx.fillText(person.id, x + 5, y + 2);
          ctx.fillText(score, x + 5, y_score);
        });
      }
    }
  };

  return (
    <div>
      <p>
        Left: {leftCounter} - Right: {rightCounter}
      </p>
      <div className="Main2">
        <video
          className="Video"
          autoPlay
          playsInline
          muted
          ref={videoRef}
          width={WIDTH}
          height={HEIGHT}
        />
        <canvas
          className="Canvas"
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
        />
      </div>
    </div>
  );
};
