import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import '@/styles/responsive.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

import '@/styles/live-profile-responsive.css'

// Browsers raise "ResizeObserver loop …" as a window error when an observed
// element changes size during the observer's own delivery phase. It is a
// benign layout notification (nothing breaks), so it must not surface as an
// app error. Ignore only these two exact messages and leave every other
// error untouched.
const resizeObserverNotification = /^ResizeObserver loop (completed with undelivered notifications|limit exceeded)\.?$/
window.addEventListener('error', event => {
  if (resizeObserverNotification.test(event.message || '')) event.preventDefault()
}, true)