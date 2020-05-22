import React, { useEffect, useRef } from 'react';

import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

import './SocialCounter.css';

export const SocialCounter: React.FC = () => {
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

  async function getCameraObjects(): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      const mediaStream = await startVideo();
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      const modelPromise = await cocoSsd.load();
      await checkFrame(modelPromise);

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
      const modelPromise = await cocoSsd.load();

      //TODO: from predicion extract the information that are needed to do stats
      const predictions = await modelPromise.detect(videoRef.current);
      // console.log(predictions);
      renderPredictions(predictions);
      requestAnimationFrame(() => {
        checkFrame(modelPromise);
      });
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
        // Font options.
        const font = 'bold 14px Arial';
        ctx.font = font;
        ctx.textBaseline = 'top';
        const textHeight = parseInt(font, 10);

        predictions.forEach((prediction: any) => {
          const x = prediction.bbox[0];
          const y = prediction.bbox[1];
          const width = prediction.bbox[2];
          const height = prediction.bbox[3];
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
        width="400"
        height="300"
      />
      <canvas className="Canvas" ref={canvasRef} width="400" height="300" />
    </div>
  );
};
