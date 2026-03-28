import fs from 'fs';
import path from 'path';

export interface Settings {
  homeAddress: string;
}

const DEFAULTS: Settings = {
  homeAddress: '433 Warren St Brooklyn, NY 11217',
};

const SETTINGS_PATH = path.join(process.cwd(), 'settings.json');

export function getSettings(): Settings {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}
