const { ethers } = require("ethers");
const jwt = require("jsonwebtoken");
const fs = require("fs");

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const CONTRACT_ABI = [
  "function balanceOf(address shareholder) view returns (uint256 shareAmount, bool isValid, uint8 plan, uint256 expiry, bool licensed, bool isLifetime, uint256 daysRemaining, uint256 hrs, uint256 mins, uint256 secs)"
];

// Load private key (SERVER ONLY)
const privateKey = process.env.PRIVATE_KEY.replace(/\\n/g, '\n');

export default async function handler(req, res) {
  try {
    console.log("➡️ [START] Incoming request");

    if (req.method !== "POST") {
      console.log("❌ [METHOD] Invalid:", req.method);
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { wallet } = req.body || {};
    console.log("➡️ [INPUT] Wallet:", wallet);

    if (!wallet) {
      console.log("❌ [INPUT] Missing wallet");
      return res.status(400).json({ error: "Missing wallet" });
    }

    // ENV CHECK
    console.log("➡️ [ENV CHECK]");
    console.log("PRIVATE_KEY:", !!process.env.PRIVATE_KEY);
    console.log("SECRET:", !!process.env.SECRET);
    console.log("ALCHEMY_URL:", !!process.env.ALCHEMY_URL);
    console.log("CONTRACT_ADDRESS:", !!process.env.CONTRACT_ADDRESS);

    if (!process.env.ALCHEMY_URL) {
      return res.status(500).json({ error: "Missing ALCHEMY_URL" });
    }

    if (!process.env.SECRET) {
      return res.status(500).json({ error: "Missing SECRET" });
    }

    if (!process.env.CONTRACT_ADDRESS) {
      return res.status(500).json({ error: "Missing CONTRACT_ADDRESS" });
    }

    // PROVIDER
    console.log("➡️ [PROVIDER] Connecting...");
    const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL);

    // BALANCE
    console.log("➡️ [BALANCE] Fetching ETH...");
    const ethBalance = await provider.getBalance(wallet);

    // CONTRACT
    console.log("➡️ [CONTRACT] Loading...");
    const contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      provider
    );

    console.log("➡️ [CONTRACT] Calling balanceOf...");
    const [
      shareAmount,
      isValid,
      plan,
      expiry,
      licensed,
      isLifetime,
      daysRemaining,
      hrs,
      mins,
      secs
    ] = await contract.balanceOf(wallet);

    console.log("➡️ [CONTRACT RESULT]", {
      shareAmount: shareAmount.toString(),
      isValid,
      plan: Number(plan),
      expiry: expiry.toString(),
      licensed,
      isLifetime
    });

    // VALIDATION
    const now = Math.floor(Date.now() / 1000);
    console.log("➡️ [TIME] Now:", now);

    const valid =
      licensed &&
      isValid &&
      (isLifetime || Number(expiry) > now);

    console.log("➡️ [VALIDATION] Result:", valid);

    const licenseData = {
      shareAmount: shareAmount.toString(),
      isValid,
      plan: Number(plan),
      expiry: expiry.toString(),
      licensed,
      isLifetime,
      daysRemaining: daysRemaining.toString(),
      hrs: hrs.toString(),
      mins: mins.toString(),
      secs: secs.toString()
    };

    console.log("➡️ [LICENSE DATA]", licenseData);

    // SIGNING (FIXED)
    console.log("➡️ [SIGN] Creating signature...");

    const payload = { license: licenseData };
    const message = JSON.stringify(payload);

    const walletSigner = new ethers.Wallet(privateKey);
    const signature = await walletSigner.signMessage(message);

    console.log("➡️ [SIGN] Signature:", signature.slice(0, 30) + "...");

    // INVALID PATH
    if (!valid) {
      console.log("❌ [RESULT] License INVALID");

      return res.status(403).json({
        valid: false,
        error: "License invalid, expired, or not licensed",
        license: licenseData,
        signed: {
          data: payload,
          signature
        }
      });
    }

    // JWT
    console.log("➡️ [JWT] Creating token...");

    const token = jwt.sign(
      {
        wallet,
        plan: Number(plan),
        licensed: true
      },
      process.env.SECRET
    );

    console.log("✅ [SUCCESS] Returning response");

    return res.status(200).json({
      valid: true,
      wallet,
      balance: ethers.formatEther(ethBalance),
      license: licenseData,
      token,
      signed: {
        data: payload,
        signature
      }
    });

  } catch (err) {
    console.error("❌ [ERROR]", err);

    return res.status(500).json({
      error: err.message || "Unknown error",
      valid: false
    });
  }
}