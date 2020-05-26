import React, { useEffect, useRef, useState } from 'react';

import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

import './SocialCounter.css';

const MAX_VALUE = 5000;
const DELAY = 1000; //ms

type Data = {
  [timestamp: string]: Person[];
};

type mm = number;
type pixels = number;

type Centroid = {
  x: pixels;
  y: pixels;
};

type Person = {
  id: string;
  point: Centroid;
  predictionPoint: Centroid;
  prediction: cocoSsd.DetectedObject;
};

export const SocialCounter: React.FC = () => {
  let detectedPeople: Person[] = [];

  let peopleCounter = 0;
  let leftCounter = 0;
  let rightCounter = 0;

  const data: Data = {};

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

  //TODO: Store in some DB that info
  function storeObjects(person: Person) {
    const timestamp = new Date().valueOf();
    data[timestamp].push(person);
    // console.log(data);
  }

  function calculatePredictionPoint(
    person: Person,
    centroid: Centroid
  ): Centroid {
    let predictionPoint: Centroid = {
      x: 0,
      y: 0,
    };

    let deltaX = Math.abs(person.point.x - centroid.x) * 2;
    let deltaY = Math.abs(person.point.y - centroid.y) * 2;

    // Define direction
    let horizontalDirection =
      person.point.x <= centroid.x ? 'left2right' : 'right2left';
    let verticalDirection =
      person.point.y <= centroid.y ? 'Up2Down' : 'Down2Up';

    if (horizontalDirection === 'left2right') {
      predictionPoint.x = person.point.x + deltaX;
    } else {
      predictionPoint.x = person.point.x - deltaX;
    }

    if (verticalDirection === 'Down2Up') {
      predictionPoint.y = person.point.y + deltaY;
    } else {
      predictionPoint.y = person.point.y - deltaY;
    }

    return predictionPoint;
  }

  function calculateEuclideanDistance(
    personCentroid: Centroid,
    centroid: Centroid
  ): pixels {
    let distance = Math.pow(
      Math.pow(personCentroid.x - centroid.x, 2) +
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
      // await checkFrame(modelPromise);

      // check again after 5 seconds
      setInterval(async () => await checkFrame(modelPromise), 5000);

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

  async function checkFrame(
    modelPromise: cocoSsd.ObjectDetection
  ): Promise<cocoSsd.DetectedObject[]> {
    if (videoRef.current) {
      // Reset Counters
      peopleCounter = 0;
      detectedPeople = [];

      // Objects Detector
      let predictions = await modelPromise.detect(videoRef.current);

      // Populate detectedPeople
      predictions.map((prediction: cocoSsd.DetectedObject) => {
        if (prediction.class === 'person') {
          //Calculate centroid
          let centroid = calculateCentroid(prediction);

          const person: Person = {
            id: `Id ${peopleCounter + 1}`.toString(),
            point: centroid,
            predictionPoint: { x: 0, y: 0 },
            prediction: prediction,
          };

          detectedPeople.push(person);
          console.log(detectedPeople.length);
        }
      });

      // Predict Position
      // Wait 1 sec.
      await delay(DELAY);
      console.log(`After ${DELAY * 0.001} seconds`);
      predictions = await modelPromise.detect(videoRef.current);

      predictions.map((prediction: cocoSsd.DetectedObject) => {
        if (prediction.class === 'person') {
          //Calculate centroid
          let centroid = calculateCentroid(prediction);

          // Detect the nearest Point
          if (detectedPeople.length > 0) {
            let minDistance = MAX_VALUE;
            detectedPeople.map((person: Person) => {
              let distance = calculateEuclideanDistance(person.point, centroid);
              if (distance < minDistance) {
                minDistance = distance;
                // Associate this centroid as Prediction Point to the Person
                person.predictionPoint = calculatePredictionPoint(
                  person,
                  centroid
                );
                console.log(person.predictionPoint);
              }
            });
          }
        }
      });

      // Verify
      // Wait 1 sec.
      await delay(DELAY);
      console.log(`After ${DELAY * 0.001} seconds`);
      predictions = await modelPromise.detect(videoRef.current);

      predictions.map((prediction: cocoSsd.DetectedObject) => {
        if (prediction.class === 'person') {
          //Calculate centroid
          let centroid = calculateCentroid(prediction);

          // Detect the nearest Point
          if (detectedPeople.length > 0) {
            let minDistance = MAX_VALUE;
            detectedPeople.map((person: Person) => {
              let distance = calculateEuclideanDistance(
                person.predictionPoint,
                centroid
              );
              if (distance < minDistance) {
                minDistance = distance;
                // Associate this person to this path
                person.prediction = prediction;
                person.point = calculateCentroid(prediction);
                console.log(person.id);
                console.log(`${person.point.x} - ${person.point.y}`);
              }
            });
          }
        }
      });

      // storeCounterData(peopleCounter);

      renderPredictions(predictions);
      // requestAnimationFrame(() => {
      //   checkFrame(modelPromise);
      // });

      return predictions;
    }
    return Promise.reject(console.log(`Is not possible to detect the frame.`));
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

  const renderPredictions = (predictions: cocoSsd.DetectedObject[]) => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // Line In-Out
        ctx.beginPath();
        ctx.moveTo(240, 0);
        ctx.lineTo(239, 0);
        ctx.lineTo(239, 360);
        ctx.lineTo(241, 360);
        ctx.lineTo(241, 0);
        ctx.fillStyle = 'yellow';
        ctx.fill();

        // Font options.
        const font = 'bold 14px Arial';
        ctx.font = font;
        ctx.textBaseline = 'top';
        const textHeight = parseInt(font, 10);

        predictions.forEach((prediction: cocoSsd.DetectedObject) => {
          const x = prediction.bbox[0];
          const y = prediction.bbox[1];
          const width = prediction.bbox[2]; // ctx.canvas.width;
          const height = prediction.bbox[3]; // ctx.canvas.height;

          // Draw the bounding box.
          ctx.strokeStyle = '#575756';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, width, height);
          // Draw the label background.

          ctx.fillStyle = '#009ee3';
          const textWidth = ctx.measureText(prediction.class).width;
          ctx.fillRect(x, y, textWidth + 4, textHeight + 4);
        });

        predictions.forEach((prediction) => {
          const x = prediction.bbox[0] + 5;
          const y = prediction.bbox[1] + 5;
          const y_score = y + 15;
          // Draw the text last to ensure it's on top.
          ctx.fillStyle = '#009ee3';
          const score = prediction.score.toPrecision(3).toString();
          ctx.fillText(prediction.class, x, y);
          ctx.fillText(score, x, y_score);
        });
      }
    }
  };

  return (
    <div className="Main2">
      <video
        className="Video"
        autoPlay
        playsInline
        muted
        ref={videoRef}
        width="480"
        height="360"
      />
      <canvas className="Canvas" ref={canvasRef} width="480" height="360" />
    </div>
  );
};
