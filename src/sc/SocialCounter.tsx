import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

export const SocialCounter: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // When the component will mount
  useEffect(() => {
    async function fetchData() {
      const result = await getCameraObjects();
    }

    fetchData();
  }, []);

  useEffect(() => {
    videoRef.current?.addEventListener('loadeddata', () => {
      console.log("Loaded the video's data!");
    });
  }, [videoRef.current]);

  async function getCameraObjects(): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      console.log('Yuppi');

      const mediaStream = await startVideo();
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      await checkFrame();

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
    return Promise.reject('Bla bla..');
  }

  async function checkFrame(): Promise<HTMLVideoElement> {
    if (videoRef.current) {
      const modelPromise = await cocoSsd.load();
      return await detectFrame(videoRef.current, modelPromise);
    }
    return Promise.reject(console.log(`Is not possible to detect the frame.`));
  }

  async function detectFrame(
    video: HTMLVideoElement,
    model: cocoSsd.ObjectDetection
  ): Promise<HTMLVideoElement> {
    const predictions = await model.detect(video);

    console.log(predictions);
    renderPredictions(predictions);
    requestAnimationFrame(() => {
      detectFrame(video, model);
    });

    return Promise.reject(`It was not possible to load the data.`);
  }

  const renderPredictions = (predictions: cocoSsd.DetectedObject[]) => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        // Font options.
        const font = '16px sans-serif';
        ctx.font = font;
        ctx.textBaseline = 'top';

        predictions.forEach((prediction: any) => {
          const x = prediction.bbox[0];
          const y = prediction.bbox[1];
          const width = prediction.bbox[2];
          const height = prediction.bbox[3];
          // Draw the bounding box.
          ctx.strokeStyle = '#00FFFF';
          ctx.lineWidth = 4;
          ctx.strokeRect(x, y, width, height);
          // Draw the label background.
          ctx.fillStyle = '#00FFFF';
          const textWidth = ctx.measureText(prediction.class).width;
          const textHeight = parseInt(font, 10); // base 10
          ctx.fillRect(x, y, textWidth + 4, textHeight + 4);
        });
      }
    }
  };

  return (
    <div>
      <video
        className="size"
        autoPlay
        playsInline
        muted
        ref={videoRef}
        width="600"
        height="500"
      />
      <canvas className="size" ref={canvasRef} width="600" height="500" />
    </div>
  );
};
