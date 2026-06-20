import { createRouter, createRoute, createRootRoute, redirect } from '@tanstack/react-router';
import { App } from './App';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { ChatListPage } from './pages/ChatListPage';
import { ChatThreadPage } from './pages/ChatThreadPage';
import { DemoPage } from './pages/DemoPage';
import { AgentPage } from './pages/AgentPage';

function getToken(): string | null {
  try {
    const session = localStorage.getItem('qubit_session');
    if (!session) return null;
    return JSON.parse(session).token ?? null;
  } catch {
    return null;
  }
}

const PUBLIC_PATHS = ['/', '/login', '/demo', '/agent/alpha', '/agent/beta'];

const rootRoute = createRootRoute({
  component: App,
  beforeLoad: ({ location }) => {
    const token = getToken();
    if (!token && !PUBLIC_PATHS.includes(location.pathname)) {
      throw redirect({ to: '/' });
    }
    if (token && location.pathname === '/login') {
      throw redirect({ to: '/chat' });
    }
  },
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat',
  component: ChatListPage,
});

const chatThreadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat/$address',
  component: ChatThreadPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
});

const demoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/demo',
  component: DemoPage,
});

const agentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/agent/$role',
  component: AgentPage,
});

const routeTree = rootRoute.addChildren([indexRoute, loginRoute, chatRoute, chatThreadRoute, demoRoute, agentRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
