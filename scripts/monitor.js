#!/usr/bin/env node

const { Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');

// Configuration
const PROGRAM_ID = process.env.PROGRAM_ID || 'AuRex11111111111111111111111111111111111111';
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const WEBHOOK_URL = process.env.WEBHOOK_URL;

class AurexMonitor {
  constructor() {
    this.connection = new Connection(RPC_URL, 'confirmed');
    this.programId = new PublicKey(PROGRAM_ID);
    this.eventLog = [];
  }

  async start() {
    console.log('🔍 Starting Aurex Bridge monitor...');
    console.log(`📍 Program ID: ${this.programId.toBase58()}`);
    console.log(`🌐 RPC URL: ${RPC_URL}`);
    
    // Monitor program logs
    this.connection.onLogs(this.programId, (logs, context) => {
      this.handleProgramLogs(logs, context);
    });

    // Monitor account changes
    this.connection.onAccountChange(this.programId, (accountInfo, context) => {
      this.handleAccountChange(accountInfo, context);
    });

    // Periodic health check
    setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Every 30 seconds

    console.log('✅ Monitor started successfully');
  }

  handleProgramLogs(logs, context) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type: 'program_logs',
      signature: logs.signature,
      slot: context.slot,
      err: logs.err,
      logs: logs.logs
    };

    this.eventLog.push(logEntry);
    this.processLogEntry(logEntry);
  }

  handleAccountChange(accountInfo, context) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type: 'account_change',
      slot: context.slot,
      dataLength: accountInfo.data.length,
      executable: accountInfo.executable,
      lamports: accountInfo.lamports,
      owner: accountInfo.owner.toBase58()
    };

    this.eventLog.push(logEntry);
    this.processLogEntry(logEntry);
  }

  processLogEntry(logEntry) {
    // Parse different event types
    if (logEntry.type === 'program_logs' && logEntry.logs) {
      for (const log of logEntry.logs) {
        if (log.includes('CardCreated')) {
          this.handleCardCreatedEvent(logEntry, log);
        } else if (log.includes('PaymentProcessed')) {
          this.handlePaymentEvent(logEntry, log);
        } else if (log.includes('CardToppedUp')) {
          this.handleTopUpEvent(logEntry, log);
        } else if (log.includes('Error')) {
          this.handleErrorEvent(logEntry, log);
        }
      }
    }

    // Log to console
    console.log(`📋 [${logEntry.timestamp}] ${logEntry.type}:`, 
                JSON.stringify(logEntry, null, 2));

    // Send to webhook if configured
    if (WEBHOOK_URL) {
      this.sendWebhook(logEntry);
    }

    // Save to file
    this.saveToFile(logEntry);
  }

  handleCardCreatedEvent(logEntry, log) {
    console.log('💳 New card created!');
    
    // Extract card details from log if possible
    // This would need proper log parsing based on your program's log format
    
    if (WEBHOOK_URL) {
      this.sendWebhook({
        ...logEntry,
        event_type: 'card_created',
        title: 'New Virtual Card Created',
        description: 'A new virtual card has been created on the bridge'
      });
    }
  }

  handlePaymentEvent(logEntry, log) {
    console.log('💰 Payment processed!');
    
    if (WEBHOOK_URL) {
      this.sendWebhook({
        ...logEntry,
        event_type: 'payment_processed',
        title: 'Payment Processed',
        description: 'A payment has been processed through the bridge'
      });
    }
  }

  handleTopUpEvent(logEntry, log) {
    console.log('💵 Card topped up!');
    
    if (WEBHOOK_URL) {
      this.sendWebhook({
        ...logEntry,
        event_type: 'card_topped_up',
        title: 'Card Topped Up',
        description: 'A virtual card has been topped up with funds'
      });
    }
  }

  handleErrorEvent(logEntry, log) {
    console.error('❌ Error detected:', log);
    
    if (WEBHOOK_URL) {
      this.sendWebhook({
        ...logEntry,
        event_type: 'error',
        title: 'Bridge Error Detected',
        description: `Error in bridge operation: ${log}`,
        severity: 'high'
      });
    }
  }

  async performHealthCheck() {
    try {
      // Check if program account exists and is valid
      const accountInfo = await this.connection.getAccountInfo(this.programId);
      
      if (!accountInfo) {
        console.error('❌ Program account not found!');
        return;
      }

      // Check cluster health
      const health = await this.connection.getHealth();
      if (health !== 'ok') {
        console.warn(`⚠️ Cluster health: ${health}`);
      }

      // Check slot progress
      const slot = await this.connection.getSlot();
      console.log(`✅ Health check passed - Slot: ${slot}`);

    } catch (error) {
      console.error('❌ Health check failed:', error.message);
    }
  }

  async sendWebhook(data) {
    try {
      const fetch = require('node-fetch');
      
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        console.error('❌ Webhook failed:', response.statusText);
      }
    } catch (error) {
      console.error('❌ Webhook error:', error.message);
    }
  }

  saveToFile(logEntry) {
    const logDir = './logs';
    const logFile = `${logDir}/bridge-monitor.log`;

    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Append log entry to file
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  }

  getStats() {
    const now = Date.now();
    const lastHour = now - (60 * 60 * 1000);
    
    const recentEvents = this.eventLog.filter(
      event => new Date(event.timestamp).getTime() > lastHour
    );

    return {
      total_events: this.eventLog.length,
      events_last_hour: recentEvents.length,
      event_types: this.eventLog.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {}),
      last_event: this.eventLog[this.eventLog.length - 1]
    };
  }
}

// Start monitor if run directly
if (require.main === module) {
  const monitor = new AurexMonitor();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n📊 Monitor stats:', monitor.getStats());
    console.log('👋 Monitor shutting down...');
    process.exit(0);
  });

  monitor.start().catch(console.error);
}

module.exports = AurexMonitor;