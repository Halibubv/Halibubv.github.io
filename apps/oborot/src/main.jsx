// Точка входа: подключает стили и рисует приложение в <div id="root">.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles.css';
import App from './App.jsx';

// BrowserRouter следит за адресом в строке браузера, без него не работают Routes и Link.
createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
