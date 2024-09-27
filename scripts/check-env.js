#!/usr/bin/env node

/**
 * Environment variables checker for AutoBridge
 */

const required = [
  'BASE_SEPOLIA_RPC',
  'OPTIMISM_SEPOLIA_RPC',
  'NEXT_PUBLIC_BASE_BUNDLER_URL',
  'USDX_ADDRESS',
  'WALLET_EXECUTOR_ADDRESS'
];

const optional = [
  'ROUTING_SERVICE_URL',
  'PYTH_ENDPOINT',
  'ENS_FALLBACK_RPC'
];

function checkEnvironment() {
  console.log('🔍 Checking environment variables...\n');

  const missing = [];
  const present = [];

  // Check required variables
  required.forEach(varName => {
    if (process.env[varName]) {
      present.push(varName);
      console.log(`✅ ${varName}`);
    } else {
      missing.push(varName);
      console.log(`❌ ${varName} (required)`);
    }
  });

  // Check optional variables
  optional.forEach(varName => {
    if (process.env[varName]) {
      present.push(varName);
      console.log(`✅ ${varName} (optional)`);
    } else {
      console.log(`⚠️  ${varName} (optional, using default)`);
    }
  });

  console.log(`\n📊 Summary:`);
  console.log(`   Present: ${present.length}`);
  console.log(`   Missing: ${missing.length}`);

  if (missing.length > 0) {
    console.log('\n❌ Missing required environment variables:');
    missing.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ All required environment variables are set!');
  }
}

if (require.main === module) {
  checkEnvironment();
}

module.exports = { checkEnvironment, required, optional };