import 'express-session';

declare module 'express-session' {
  interface SessionData {
    dj: { id: number; name: string; email: string };
  }
}
