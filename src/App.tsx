import React from 'react';

import logo from './logo.svg';
import './App.css';

import { SocialCounter } from './sc';

function App() {
  return (
    <div className="App">
      <img src={logo} className="App-logo" alt="logo" />
      <div className="Main">
        <p>Example Application</p>
        <SocialCounter />
      </div>
    </div>
  );
}

export default App;
