/**
 * PLANET-1257: App layout with persistent top navigation bar.
 * Wraps all authenticated routes.
 */
import { Outlet } from 'react-router-dom';
import AppTopBar from './AppTopBar';

export default function AppLayout() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <AppTopBar />
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
