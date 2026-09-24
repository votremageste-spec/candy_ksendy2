import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const container = document.getElementById('root');

// Crash Early: без корневого элемента приложение смысла не имеет.
if (!container) {
  throw new Error('Не найден элемент #root в index.html — приложение не может быть смонтировано.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
