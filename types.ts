export interface User {
  uid: string;
  email: string;
  displayName: string;
  credits: number;
  plan: 'free' | 'pro';
}

export interface ScanResult {
  id: string;
  title: string;
  date: string; // ISO string
  thumbnailUrl: string;
  content: string; // HTML content
  status: 'processing' | 'completed' | 'failed';
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (name: string, email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
}
