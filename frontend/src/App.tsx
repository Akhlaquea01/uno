import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import ServerWakeGate from './components/ServerWakeGate';
import IdentityGate from './components/IdentityGate';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import RoundSummary from './pages/RoundSummary';

export default function App() {
  return (
    <ErrorBoundary>
      <ServerWakeGate>
        <IdentityGate>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/room/:roomCode/lobby" element={<Lobby />} />
              <Route path="/room/:roomCode/game" element={<Game />} />
              <Route path="/room/:roomCode/summary" element={<RoundSummary />} />
            </Routes>
          </BrowserRouter>
        </IdentityGate>
      </ServerWakeGate>
    </ErrorBoundary>
  );
}
