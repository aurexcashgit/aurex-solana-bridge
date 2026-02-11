import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AurexSolanaBridge, createWallet } from '@aurex/solana-bridge-sdk';
import { logger } from './utils/logger';
import { validateCreateCard, validateTopUp, validatePayment } from './utils/validation';
import { AuthMiddleware } from './middleware/auth';
import { RateLimiter } from './middleware/rateLimit';
import { AurexAPI } from './services/aurexApi';
import { NotificationService } from './services/notifications';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
config();

// Constants
const PORT = process.env.PORT || 3000;
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY;
const AUREX_API_URL = process.env.AUREX_API_URL || 'https://api.aurex.cash';
const AUREX_API_KEY = process.env.AUREX_API_KEY;

if (!PRIVATE_KEY || !AUREX_API_KEY) {
  logger.error('Missing required environment variables');
  process.exit(1);
}

// Initialize services
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(PRIVATE_KEY)));
const wallet = createWallet(keypair);
const solanaBridge = new AurexSolanaBridge(connection, wallet);
const aurexApi = new AurexAPI(AUREX_API_URL, AUREX_API_KEY);
const notifications = new NotificationService();

// Initialize Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(RateLimiter);

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, { 
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body 
  });
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    solana: {
      cluster: SOLANA_RPC_URL,
      programId: solanaBridge.programId?.toBase58()
    }
  });
});

// Get bridge status
app.get('/api/v1/bridge/status', async (req: Request, res: Response) => {
  try {
    const bridgeState = await solanaBridge.getBridgeState();
    const blockHeight = await connection.getBlockHeight();
    
    res.json({
      success: true,
      data: {
        bridgeState,
        solana: {
          blockHeight,
          cluster: SOLANA_RPC_URL
        }
      }
    });
  } catch (error) {
    logger.error('Error getting bridge status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get bridge status'
    });
  }
});

// Create virtual card
app.post('/api/v1/cards', AuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { error, value } = validateCreateCard(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { balanceLimit, metadata, mint } = value;
    const cardId = uuidv4();
    const userId = req.user?.id;

    // Create card on Solana
    const result = await solanaBridge.createCard({
      cardId,
      balanceLimit: balanceLimit * 1e6, // Convert to lamports
      metadata: metadata || '',
      mint: new PublicKey(mint)
    });

    // Register card in Aurex backend
    await aurexApi.registerCard({
      cardId,
      userId,
      solanaPubkey: result.cardPubkey.toBase58(),
      escrowPubkey: result.escrowPubkey.toBase58(),
      balanceLimit,
      metadata
    });

    // Send notification
    await notifications.sendCardCreated({
      userId,
      cardId,
      balanceLimit
    });

    logger.info('Card created successfully', { 
      cardId, 
      userId,
      solanaPubkey: result.cardPubkey.toBase58()
    });

    res.json({
      success: true,
      data: {
        cardId,
        cardPubkey: result.cardPubkey.toBase58(),
        escrowPubkey: result.escrowPubkey.toBase58(),
        txSignature: result.signature,
        balanceLimit
      }
    });
  } catch (error) {
    logger.error('Error creating card:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create card'
    });
  }
});

// Get user cards
app.get('/api/v1/cards', AuthMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userPubkey = new PublicKey(req.user?.solanaPubkey || '');
    
    // Get cards from Solana
    const solanaCards = await solanaBridge.getUserCards(userPubkey);
    
    // Get cards from Aurex backend
    const aurexCards = await aurexApi.getUserCards(userId);
    
    // Merge data
    const cards = aurexCards.map(aurexCard => {
      const solanaCard = solanaCards.find(sc => sc.id === aurexCard.cardId);
      return {
        ...aurexCard,
        solanaData: solanaCard
      };
    });

    res.json({
      success: true,
      data: cards
    });
  } catch (error) {
    logger.error('Error fetching cards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cards'
    });
  }
});

// Top up card
app.post('/api/v1/cards/:cardId/topup', AuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { error, value } = validateTopUp(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { cardId } = req.params;
    const { amount, mint } = value;
    const userId = req.user?.id;

    // Verify card ownership
    const card = await aurexApi.getCard(cardId, userId);
    if (!card) {
      return res.status(404).json({
        success: false,
        error: 'Card not found'
      });
    }

    // Process top-up on Solana
    const signature = await solanaBridge.topUpCard({
      cardId,
      amount: amount * 1e6, // Convert to lamports
      mint: new PublicKey(mint)
    });

    // Update Aurex backend
    await aurexApi.updateCardBalance(cardId, amount, 'top_up');

    // Send notification
    await notifications.sendCardToppedUp({
      userId,
      cardId,
      amount
    });

    logger.info('Card topped up successfully', {
      cardId,
      userId,
      amount,
      signature
    });

    res.json({
      success: true,
      data: {
        cardId,
        amount,
        txSignature: signature
      }
    });
  } catch (error) {
    logger.error('Error topping up card:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to top up card'
    });
  }
});

// Process payment
app.post('/api/v1/payments', AuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { error, value } = validatePayment(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { cardId, amount, merchantId, merchantReference } = value;
    const userId = req.user?.id;

    // Verify card ownership and balance
    const card = await aurexApi.getCard(cardId, userId);
    if (!card) {
      return res.status(404).json({
        success: false,
        error: 'Card not found'
      });
    }

    if (card.balance < amount) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance'
      });
    }

    // Get merchant info
    const merchant = await aurexApi.getMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        error: 'Merchant not found'
      });
    }

    // Process payment on Solana
    const signature = await solanaBridge.processPayment({
      cardId,
      amount: amount * 1e6, // Convert to lamports
      merchantTokenAccount: new PublicKey(merchant.solanaTokenAccount),
      merchant: new PublicKey(merchant.solanaPubkey),
      merchantReference
    });

    // Update Aurex backend
    const payment = await aurexApi.recordPayment({
      cardId,
      merchantId,
      amount,
      merchantReference,
      solanaSignature: signature
    });

    // Send notifications
    await notifications.sendPaymentProcessed({
      userId,
      cardId,
      amount,
      merchant: merchant.name
    });

    logger.info('Payment processed successfully', {
      cardId,
      userId,
      merchantId,
      amount,
      signature
    });

    res.json({
      success: true,
      data: {
        paymentId: payment.id,
        cardId,
        amount,
        merchant: merchant.name,
        txSignature: signature,
        remainingBalance: card.balance - amount
      }
    });
  } catch (error) {
    logger.error('Error processing payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process payment'
    });
  }
});

// Deactivate card
app.delete('/api/v1/cards/:cardId', AuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { cardId } = req.params;
    const userId = req.user?.id;

    // Verify card ownership
    const card = await aurexApi.getCard(cardId, userId);
    if (!card) {
      return res.status(404).json({
        success: false,
        error: 'Card not found'
      });
    }

    // Deactivate on Solana
    const signature = await solanaBridge.deactivateCard(cardId);

    // Update Aurex backend
    await aurexApi.deactivateCard(cardId);

    logger.info('Card deactivated successfully', {
      cardId,
      userId,
      signature
    });

    res.json({
      success: true,
      data: {
        cardId,
        txSignature: signature
      }
    });
  } catch (error) {
    logger.error('Error deactivating card:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate card'
    });
  }
});

// Get payment history
app.get('/api/v1/payments', AuthMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { cardId, limit = 50, offset = 0 } = req.query;

    const payments = await aurexApi.getPaymentHistory({
      userId,
      cardId: cardId as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    logger.error('Error fetching payment history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment history'
    });
  }
});

// Webhook endpoint for Solana events
app.post('/api/v1/webhooks/solana', async (req: Request, res: Response) => {
  try {
    const { signature, accountId, eventType } = req.body;
    
    logger.info('Received Solana webhook', { signature, accountId, eventType });
    
    // Process the event based on type
    switch (eventType) {
      case 'payment_processed':
        await notifications.processPaymentEvent(req.body);
        break;
      case 'card_created':
        await notifications.processCardCreatedEvent(req.body);
        break;
      default:
        logger.warn('Unknown event type:', eventType);
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error processing webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process webhook'
    });
  }
});

// Error handling middleware
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Aurex Solana Bridge API server running on port ${PORT}`);
  logger.info(`Solana cluster: ${SOLANA_RPC_URL}`);
  logger.info(`Program ID: ${solanaBridge.programId?.toBase58()}`);
});