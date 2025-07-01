import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'

console.log('🚀 App is loading...')

try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
  console.log('✅ App rendered successfully')
} catch (error) {
  console.error('❌ Error rendering app:', error)
}