#!/usr/bin/env node

/**
 * Development tools and utilities for AutoBridge
 */

const { spawn } = require('child_process');
const path = require('path');

const commands = {
  'clean': () => {
    console.log('🧹 Cleaning build artifacts...');
    return spawn('npm', ['run', 'clean'], { stdio: 'inherit' });
  },

  'build:all': () => {
    console.log('🔨 Building all packages...');
    return spawn('npm', ['run', 'build'], { stdio: 'inherit' });
  },

  'test:watch': () => {
    console.log('🧪 Running tests in watch mode...');
    return spawn('npm', ['run', 'test:watch'], { stdio: 'inherit' });
  },

  'dev:full': async () => {
    console.log('🚀 Starting full development environment...');

    // Start multiple services
    const services = [
      spawn('npm', ['run', 'dev', '--workspace', '@autobridge/web'], { stdio: 'inherit' }),
      spawn('npm', ['run', 'dev', '--workspace', '@autobridge/routing-service'], { stdio: 'inherit' })
    ];

    // Handle cleanup on exit
    process.on('SIGINT', () => {
      console.log('\n💀 Shutting down services...');
      services.forEach(service => service.kill());
      process.exit();
    });

    return Promise.all(services);
  }
};

const command = process.argv[2];

if (!command || !commands[command]) {
  console.log('Available commands:');
  Object.keys(commands).forEach(cmd => {
    console.log(`  ${cmd}`);
  });
  process.exit(1);
}

commands[command]().catch(error => {
  console.error('Command failed:', error);
  process.exit(1);
});