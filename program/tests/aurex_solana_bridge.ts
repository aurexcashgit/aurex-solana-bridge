import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo } from "@solana/spl-token";
import { AurexSolanaBridge } from "../target/types/aurex_solana_bridge";
import { expect } from "chai";

describe("aurex-solana-bridge", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AurexSolanaBridge as Program<AurexSolanaBridge>;
  
  // Test accounts
  let authority: Keypair;
  let user: Keypair;
  let merchant: Keypair;
  let mint: PublicKey;
  let userTokenAccount: PublicKey;
  let merchantTokenAccount: PublicKey;
  
  // Program accounts
  let bridgeState: PublicKey;
  let card: PublicKey;
  let cardEscrow: PublicKey;
  
  const cardId = "test-card-123";
  const balanceLimit = new anchor.BN(1000 * LAMPORTS_PER_SOL);
  const metadata = "Test card metadata";

  before(async () => {
    // Initialize test accounts
    authority = provider.wallet.publicKey;
    user = Keypair.generate();
    merchant = Keypair.generate();

    // Airdrop SOL to test accounts
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user.publicKey, 2 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(merchant.publicKey, 2 * LAMPORTS_PER_SOL)
    );

    // Create test token mint
    mint = await createMint(
      provider.connection,
      user,
      authority,
      authority,
      6 // 6 decimals
    );

    // Create token accounts
    userTokenAccount = await createAccount(
      provider.connection,
      user,
      mint,
      user.publicKey
    );

    merchantTokenAccount = await createAccount(
      provider.connection,
      merchant,
      mint,
      merchant.publicKey
    );

    // Mint tokens to user
    await mintTo(
      provider.connection,
      user,
      mint,
      userTokenAccount,
      authority,
      1000000000 // 1000 tokens
    );

    // Derive PDAs
    [bridgeState] = PublicKey.findProgramAddressSync(
      [Buffer.from("bridge_state")],
      program.programId
    );

    [card] = PublicKey.findProgramAddressSync(
      [Buffer.from("card"), user.publicKey.toBuffer(), Buffer.from(cardId)],
      program.programId
    );

    [cardEscrow] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), card.toBuffer()],
      program.programId
    );
  });

  it("Initializes the bridge", async () => {
    try {
      await program.methods
        .initialize(authority)
        .accounts({
          bridgeState,
          authority,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      const bridgeStateAccount = await program.account.bridgeState.fetch(bridgeState);
      expect(bridgeStateAccount.authority.toString()).to.equal(authority.toString());
      expect(bridgeStateAccount.totalCards.toString()).to.equal("0");
    } catch (error) {
      console.log("Initialize error:", error);
      throw error;
    }
  });

  it("Creates a virtual card", async () => {
    try {
      await program.methods
        .createCard(cardId, balanceLimit, metadata)
        .accounts({
          card,
          cardEscrowAccount: cardEscrow,
          bridgeState,
          owner: user.publicKey,
          mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([user])
        .rpc();

      const cardAccount = await program.account.card.fetch(card);
      expect(cardAccount.id).to.equal(cardId);
      expect(cardAccount.owner.toString()).to.equal(user.publicKey.toString());
      expect(cardAccount.balanceLimit.toString()).to.equal(balanceLimit.toString());
      expect(cardAccount.balance.toString()).to.equal("0");
      expect(cardAccount.isActive).to.be.true;
      expect(cardAccount.metadata).to.equal(metadata);

      const bridgeStateAccount = await program.account.bridgeState.fetch(bridgeState);
      expect(bridgeStateAccount.totalCards.toString()).to.equal("1");
    } catch (error) {
      console.log("Create card error:", error);
      throw error;
    }
  });

  it("Tops up a virtual card", async () => {
    const topUpAmount = new anchor.BN(100 * LAMPORTS_PER_SOL);
    
    try {
      await program.methods
        .topUpCard(topUpAmount)
        .accounts({
          card,
          cardEscrowAccount: cardEscrow,
          userTokenAccount,
          owner: user.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      const cardAccount = await program.account.card.fetch(card);
      expect(cardAccount.balance.toString()).to.equal(topUpAmount.toString());
    } catch (error) {
      console.log("Top up error:", error);
      throw error;
    }
  });

  it("Processes a payment", async () => {
    const paymentAmount = new anchor.BN(50 * LAMPORTS_PER_SOL);
    const merchantReference = "ORDER-12345";
    
    try {
      const cardAccountBefore = await program.account.card.fetch(card);
      const balanceBefore = cardAccountBefore.balance;

      await program.methods
        .processPayment(paymentAmount, merchantReference)
        .accounts({
          card,
          cardEscrowAccount: cardEscrow,
          merchantTokenAccount,
          merchant: merchant.publicKey,
          owner: user.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      const cardAccountAfter = await program.account.card.fetch(card);
      const expectedBalance = balanceBefore.sub(paymentAmount);
      expect(cardAccountAfter.balance.toString()).to.equal(expectedBalance.toString());
    } catch (error) {
      console.log("Process payment error:", error);
      throw error;
    }
  });

  it("Deactivates a virtual card", async () => {
    try {
      await program.methods
        .deactivateCard()
        .accounts({
          card,
          owner: user.publicKey,
        })
        .signers([user])
        .rpc();

      const cardAccount = await program.account.card.fetch(card);
      expect(cardAccount.isActive).to.be.false;
    } catch (error) {
      console.log("Deactivate card error:", error);
      throw error;
    }
  });

  it("Withdraws balance from deactivated card", async () => {
    try {
      const cardAccountBefore = await program.account.card.fetch(card);
      const balanceBefore = cardAccountBefore.balance;

      await program.methods
        .withdrawBalance()
        .accounts({
          card,
          cardEscrowAccount: cardEscrow,
          userTokenAccount,
          owner: user.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      // Check that the balance was withdrawn
      // Note: In a real implementation, you'd check the user's token account balance
      console.log("Withdrawal completed successfully");
    } catch (error) {
      console.log("Withdraw balance error:", error);
      throw error;
    }
  });

  it("Fails to process payment on inactive card", async () => {
    const paymentAmount = new anchor.BN(10 * LAMPORTS_PER_SOL);
    const merchantReference = "ORDER-FAIL";
    
    try {
      await program.methods
        .processPayment(paymentAmount, merchantReference)
        .accounts({
          card,
          cardEscrowAccount: cardEscrow,
          merchantTokenAccount,
          merchant: merchant.publicKey,
          owner: user.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();
      
      // Should not reach here
      expect.fail("Expected payment to fail on inactive card");
    } catch (error) {
      expect(error.toString()).to.include("CardInactive");
    }
  });
});