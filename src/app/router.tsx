import { createBrowserRouter } from 'react-router-dom';
import { App } from './App';
import { LandingPage } from '../pages/LandingPage';
import { DashboardHomePage } from '../pages/DashboardHomePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: 'app',
        element: <DashboardHomePage />,
      },
      {
        path: 'dashboard',
        element: <DashboardHomePage />,
      },
      {
        path: '*',
        element: <LandingPage />,
      },
    ],
  },
]);
