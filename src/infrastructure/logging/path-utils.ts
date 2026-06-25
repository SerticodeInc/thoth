import { homedir } from 'os';

const HOME_DIR = homedir();

export function sanitizePath(filePath: string): string {
  if (filePath.startsWith(HOME_DIR)) {
    return filePath.replace(HOME_DIR, '~');
  }
  return filePath;
}
