import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Keypair,
  sendAndConfirmTransaction,
  ConfirmOptions,
  Signer,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { Program, AnchorProvider, Wallet, BN, Idl } from '@coral-xyz/anchor';
import { Buffer } from 'buffer';

// Program ID (replace with actual deployed program ID)
export const PROGRAM_ID = new PublicKey('AuRex11111111111111111111111111111111111111');

// Types
export interface CardData {
  id: string;
  owner: PublicKey;
  balance: number;
  balanceLimit: number;
  isActive: boolean;
  metadata: string;
  createdAt: number;
  bump: number;
}

export interface BridgeStateData {
  authority: PublicKey;
  totalCards: number;
  bump: number;
}

export interface CreateCardParams {
  cardId: string;
  balanceLimit: number;
  metadata?: string;
  mint: PublicKey;
}

export interface TopUpCardParams {
  cardId: string;
  amount: number;
  mint: PublicKey;
}

export interface ProcessPaymentParams {
  cardId: string;
  amount: number;
  merchantTokenAccount: PublicKey;
  merchant: PublicKey;
  merchantReference: string;
}

// Events
export interface CardCreatedEvent {
  cardPubkey: PublicKey;
  owner: PublicKey;
  cardId: string;
  balanceLimit: number;
}

export interface PaymentProcessedEvent {
  cardPubkey: PublicKey;
  merchant: PublicKey;
  amount: number;
  merchantReference: string;
  remainingBalance: number;
  timestamp: number;
}

// Main SDK Class
export class AurexSolanaBridge {
  constructor(
    private connection: Connection,
    private wallet: Wallet,
    private programId: PublicKey = PROGRAM_ID
  ) {}

  /**
   * Get the bridge state PDA
   */
  static getBridgeStatePDA(programId: PublicKey = PROGRAM_ID): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('bridge_state')],
      programId
    );
  }

  /**
   * Get card PDA for a given owner and card ID
   */
  static getCardPDA(
    owner: PublicKey,
    cardId: string,
    programId: PublicKey = PROGRAM_ID
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('card'), owner.toBuffer(), Buffer.from(cardId)],
      programId
    );
  }

  /**
   * Get card escrow PDA
   */
  static getCardEscrowPDA(
    card: PublicKey,
    programId: PublicKey = PROGRAM_ID
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('escrow'), card.toBuffer()],
      programId
    );
  }

  /**
   * Initialize the Aurex bridge (admin only)
   */
  async initialize(authority?: PublicKey): Promise<string> {
    const auth = authority || this.wallet.publicKey;
    const [bridgeState, bump] = AurexSolanaBridge.getBridgeStatePDA(this.programId);

    const accounts = {
      bridgeState,
      authority: auth,
      systemProgram: SystemProgram.programId,
    };

    const instruction = await this.createInstruction(
      'initialize',
      accounts,
      { authority: auth }
    );

    const transaction = new Transaction().add(instruction);
    return this.sendTransaction(transaction);
  }

  /**
   * Create a new virtual card
   */
  async createCard(params: CreateCardParams): Promise<{
    signature: string;
    cardPubkey: PublicKey;
    escrowPubkey: PublicKey;
  }> {
    const owner = this.wallet.publicKey;
    const [card, cardBump] = AurexSolanaBridge.getCardPDA(owner, params.cardId, this.programId);
    const [cardEscrow, escrowBump] = AurexSolanaBridge.getCardEscrowPDA(card, this.programId);
    const [bridgeState] = AurexSolanaBridge.getBridgeStatePDA(this.programId);

    const accounts = {
      card,
      cardEscrowAccount: cardEscrow,
      bridgeState,
      owner,
      mint: params.mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    };

    const instruction = await this.createInstruction(
      'createCard',
      accounts,
      {
        cardId: params.cardId,
        balanceLimit: new BN(params.balanceLimit),
        metadata: params.metadata || '',
      }
    );

    const transaction = new Transaction().add(instruction);
    const signature = await this.sendTransaction(transaction);

    return {
      signature,
      cardPubkey: card,
      escrowPubkey: cardEscrow,
    };
  }

  /**
   * Top up a virtual card
   */
  async topUpCard(params: TopUpCardParams): Promise<string> {
    const owner = this.wallet.publicKey;
    const [card] = AurexSolanaBridge.getCardPDA(owner, params.cardId, this.programId);
    const [cardEscrow] = AurexSolanaBridge.getCardEscrowPDA(card, this.programId);
    
    const userTokenAccount = await getAssociatedTokenAddress(
      params.mint,
      owner
    );

    const accounts = {
      card,
      cardEscrowAccount: cardEscrow,
      userTokenAccount,
      owner,
      tokenProgram: TOKEN_PROGRAM_ID,
    };

    const instruction = await this.createInstruction(
      'topUpCard',
      accounts,
      { amount: new BN(params.amount) }
    );

    const transaction = new Transaction().add(instruction);
    return this.sendTransaction(transaction);
  }

  /**
   * Process a payment from a virtual card
   */
  async processPayment(params: ProcessPaymentParams): Promise<string> {
    const owner = this.wallet.publicKey;
    const [card] = AurexSolanaBridge.getCardPDA(owner, params.cardId, this.programId);
    const [cardEscrow] = AurexSolanaBridge.getCardEscrowPDA(card, this.programId);

    const accounts = {
      card,
      cardEscrowAccount: cardEscrow,
      merchantTokenAccount: params.merchantTokenAccount,
      merchant: params.merchant,
      owner,
      tokenProgram: TOKEN_PROGRAM_ID,
    };

    const instruction = await this.createInstruction(
      'processPayment',
      accounts,
      {
        amount: new BN(params.amount),
        merchantReference: params.merchantReference,
      }
    );

    const transaction = new Transaction().add(instruction);
    return this.sendTransaction(transaction);
  }

  /**
   * Deactivate a virtual card
   */
  async deactivateCard(cardId: string): Promise<string> {
    const owner = this.wallet.publicKey;
    const [card] = AurexSolanaBridge.getCardPDA(owner, cardId, this.programId);

    const accounts = {
      card,
      owner,
    };

    const instruction = await this.createInstruction(
      'deactivateCard',
      accounts,
      {}
    );

    const transaction = new Transaction().add(instruction);
    return this.sendTransaction(transaction);
  }

  /**
   * Withdraw remaining balance from a deactivated card
   */
  async withdrawBalance(cardId: string, mint: PublicKey): Promise<string> {
    const owner = this.wallet.publicKey;
    const [card] = AurexSolanaBridge.getCardPDA(owner, cardId, this.programId);
    const [cardEscrow] = AurexSolanaBridge.getCardEscrowPDA(card, this.programId);
    
    const userTokenAccount = await getAssociatedTokenAddress(mint, owner);

    const accounts = {
      card,
      cardEscrowAccount: cardEscrow,
      userTokenAccount,
      owner,
      tokenProgram: TOKEN_PROGRAM_ID,
    };

    const instruction = await this.createInstruction(
      'withdrawBalance',
      accounts,
      {}
    );

    const transaction = new Transaction().add(instruction);
    return this.sendTransaction(transaction);
  }

  /**
   * Get card data
   */
  async getCard(owner: PublicKey, cardId: string): Promise<CardData | null> {
    try {
      const [cardPubkey] = AurexSolanaBridge.getCardPDA(owner, cardId, this.programId);
      const accountInfo = await this.connection.getAccountInfo(cardPubkey);
      
      if (!accountInfo) return null;
      
      // Parse account data (this would need proper IDL parsing in real implementation)
      return this.parseCardAccount(accountInfo.data);
    } catch (error) {
      console.error('Error fetching card:', error);
      return null;
    }
  }

  /**
   * Get bridge state
   */
  async getBridgeState(): Promise<BridgeStateData | null> {
    try {
      const [bridgeStatePubkey] = AurexSolanaBridge.getBridgeStatePDA(this.programId);
      const accountInfo = await this.connection.getAccountInfo(bridgeStatePubkey);
      
      if (!accountInfo) return null;
      
      return this.parseBridgeStateAccount(accountInfo.data);
    } catch (error) {
      console.error('Error fetching bridge state:', error);
      return null;
    }
  }

  /**
   * Get all cards for an owner
   */
  async getUserCards(owner: PublicKey): Promise<CardData[]> {
    try {
      const accounts = await this.connection.getProgramAccounts(this.programId, {
        filters: [
          {
            memcmp: {
              offset: 8 + 4 + 32, // Skip discriminator + id length + id
              bytes: owner.toBase58(),
            },
          },
        ],
      });

      return accounts.map(account => this.parseCardAccount(account.account.data));
    } catch (error) {
      console.error('Error fetching user cards:', error);
      return [];
    }
  }

  /**
   * Listen for card events
   */
  onCardCreated(callback: (event: CardCreatedEvent) => void): void {
    this.connection.onLogs(this.programId, (logs) => {
      // Parse logs for CardCreated events
      // This would need proper event parsing in real implementation
      console.log('Program logs:', logs);
    });
  }

  /**
   * Listen for payment events
   */
  onPaymentProcessed(callback: (event: PaymentProcessedEvent) => void): void {
    this.connection.onLogs(this.programId, (logs) => {
      // Parse logs for PaymentProcessed events
      console.log('Program logs:', logs);
    });
  }

  // Private helper methods
  private async createInstruction(
    method: string,
    accounts: any,
    data: any
  ): Promise<TransactionInstruction> {
    // This would use proper IDL in real implementation
    // For now, return a placeholder instruction
    return new TransactionInstruction({
      keys: Object.values(accounts).map((account: any) => ({
        pubkey: account,
        isSigner: account === this.wallet.publicKey,
        isWritable: true,
      })),
      programId: this.programId,
      data: Buffer.from(JSON.stringify({ method, data })),
    });
  }

  private async sendTransaction(
    transaction: Transaction,
    options?: ConfirmOptions
  ): Promise<string> {
    transaction.recentBlockhash = (
      await this.connection.getLatestBlockhash()
    ).blockhash;
    transaction.feePayer = this.wallet.publicKey;

    const signedTx = await this.wallet.signTransaction(transaction);
    return this.connection.sendRawTransaction(signedTx.serialize(), options);
  }

  private parseCardAccount(data: Buffer): CardData {
    // This would use proper Borsh deserialization in real implementation
    // Placeholder parsing
    return {
      id: 'placeholder',
      owner: this.wallet.publicKey,
      balance: 0,
      balanceLimit: 1000,
      isActive: true,
      metadata: '',
      createdAt: Date.now(),
      bump: 0,
    };
  }

  private parseBridgeStateAccount(data: Buffer): BridgeStateData {
    // This would use proper Borsh deserialization in real implementation
    return {
      authority: this.wallet.publicKey,
      totalCards: 0,
      bump: 0,
    };
  }
}

// Utility functions
export function createWallet(keypair: Keypair): Wallet {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async (tx: Transaction) => {
      tx.partialSign(keypair);
      return tx;
    },
    signAllTransactions: async (txs: Transaction[]) => {
      return txs.map(tx => {
        tx.partialSign(keypair);
        return tx;
      });
    },
  };
}

export * from '@solana/web3.js';
export * from '@solana/spl-token';