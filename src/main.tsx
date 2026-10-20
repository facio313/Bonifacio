import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ContentEditorProvider } from './components/ContentEditor'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ContentEditorProvider>
      <App />
    </ContentEditorProvider>
  </StrictMode>,
)
