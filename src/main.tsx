import React from 'react';
import { createRoot } from 'react-dom/client';
import { RazorApp } from './components/razor/razor-app';
import './styles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><RazorApp /></React.StrictMode>);
