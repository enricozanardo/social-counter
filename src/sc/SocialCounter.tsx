import React, { useEffect, useRef, useState } from 'react';

import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

import './SocialCounter.css';

type Data = {
  [timestamp: string]: number;
};

type mm = number;
type pixels = number;

export const SocialCounter: React.FC = () => {
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
  function storeCounterData(counter: number) {
    const timestamp = new Date().valueOf();
    data[timestamp] = counter;
    // console.log(data);
  }

  function calculateDistance() {
    let focalLength: mm = 4.25; // pi NoIr Camera
    let objRealHeight: mm = 2120; // mean person height
    let imageHeight: pixels = 4032;
    let objectHeight: pixels = 3312;
    let sensorHeight: mm = 5.79; // pi Noir Camera 7.01 x 5.79
    let distance =
      (focalLength * objRealHeight * imageHeight) /
      (objectHeight * sensorHeight);

    console.log(distance);
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

  async function checkFrame(
    modelPromise: cocoSsd.ObjectDetection
  ): Promise<cocoSsd.DetectedObject[]> {
    if (videoRef.current) {
      // Reset counter
      peopleCounter = 0;

      //TODO: from predicion extract the information that are needed to do stats
      const predictions = await modelPromise.detect(videoRef.current);

      predictions.map((predicion) => {
        if (predicion.class === 'person') {
          console.log(predicion);
          if (predicion.bbox[0] > 200) {
            // On the right
            // rightCounter = rightCounter + 1;
            console.log('on the right');
          } else {
            // leftCounter = leftCounter + 1;
            console.log('on the left');
          }

          peopleCounter = peopleCounter + 1;
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

        predictions.forEach((prediction: any) => {
          const x = prediction.bbox[0];
          const y = prediction.bbox[1];
          const width = prediction.bbox[2]; // ctx.canvas.width;
          const height = prediction.bbox[3]; // ctx.canvas.height;
          // Draw the bounding box.
          ctx.strokeStyle = '#575756';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, width, height);
          // Draw the label background.

          ctx.fillStyle = 'blue';
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
