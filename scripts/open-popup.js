#!/usr/bin/env node
const { exec } = require('child_process');

const url = process.argv[2] ?? 'http://localhost:3000/popup';
const cmd = `xdg-open ${url}`;
exec(cmd, (error) => {
  if (error) {
    console.error('Failed to open popup:', error.message ?? error);
  }
});
