import { spawn } from 'child_process';

export function opusToPcm48k() {
  const ff = spawn('ffmpeg', [
    '-loglevel',
    'error',
    '-f',
    'opus',
    '-ar',
    '48000',
    '-ac',
    '1',
    '-i',
    'pipe:0',
    '-f',
    's16le',
    '-ar',
    '48000',
    '-ac',
    '1',
    'pipe:1',
  ]);
  return { stdin: ff.stdin, stdout: ff.stdout, kill: () => ff.kill('SIGKILL') };
}

export function pcm48kToOpus() {
  const ff = spawn('ffmpeg', [
    '-loglevel',
    'error',
    '-f',
    's16le',
    '-ar',
    '48000',
    '-ac',
    '1',
    '-i',
    'pipe:0',
    '-c:a',
    'libopus',
    '-application',
    'voip',
    '-b:a',
    '32k',
    '-f',
    'opus',
    'pipe:1',
  ]);
  return { stdin: ff.stdin, stdout: ff.stdout, kill: () => ff.kill('SIGKILL') };
}
