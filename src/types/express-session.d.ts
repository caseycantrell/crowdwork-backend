import 'express-session';

declare module 'express-session' {
  interface SessionData {
    dj: { id: string; name: string; email: string };
  }
  export = session;
}