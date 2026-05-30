import { BrowserRouter, Routes, Route } from 'react-router-dom'
import IntroPage from './pages/IntroPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import UserHomePage from './pages/UserHomePage'
import CreateChatRoomPage from './pages/CreateChatRoomPage'
import FindChatRoomPage from './pages/FindChatRoomPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IntroPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/user-home" element={<UserHomePage />} />
        <Route path="/create-room" element={<CreateChatRoomPage />} />
        <Route path="/find-room" element={<FindChatRoomPage />} />
      </Routes>
    </BrowserRouter>
  )
}


export default App
