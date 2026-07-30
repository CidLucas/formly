import { Routes, Route } from 'react-router-dom'
import Builder from './pages/Builder'
import Survey from './pages/Survey'
import Dashboard from './pages/Dashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Builder />} />
      <Route path="/builder/:id?" element={<Builder />} />
      <Route path="/s/:slug" element={<Survey />} />
      <Route path="/dashboard/:id" element={<Dashboard />} />
    </Routes>
  )
}
