import 'express-session';

interface DJData {
  id: string;
  name: string;
  email: string;
}

declare module 'express-session' {
  interface Session {
    dj?: DJData; 
  }
}