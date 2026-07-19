import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';

import './index.css';

// Hardcoded for Cloudflare deployment to guarantee connection
setBaseUrl(import.meta.env.VITE_API_URL || 'https://contractor-ledger.tcl2025mohaali.workers.dev/api');


createRoot(document.getElementById('root')!).render(<App />);
