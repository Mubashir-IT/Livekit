import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { RoomProvider } from './context/context.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
    <RoomProvider>

    <App />
    </RoomProvider>
    </BrowserRouter>
  </StrictMode>,
)
