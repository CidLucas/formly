import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Builder from './pages/Builder'
import Survey from './pages/Survey'
import Dashboard from './pages/Dashboard'
import Send from './pages/Send'
import Preview from './pages/Preview'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/builder/:id?" element={<Builder />} />
      <Route path="/preview/:id" element={<Preview />} />
      <Route path="/send/:id" element={<Send />} />
      <Route path="/s/:slug" element={<Survey />} />
      <Route path="/dashboard/:id" element={<Dashboard />} />
    </Routes>
  )
}
