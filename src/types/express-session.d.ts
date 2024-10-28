import 'express-session';

declare module 'express-session' {
  interface SessionData {
    dj: { id: string; name: string; email: string };
  }
}

declare module 'express' {
  interface Request {
    session: SessionData;
  }
}
