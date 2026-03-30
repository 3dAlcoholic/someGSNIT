const { ethers } = require("ethers");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const fs = require("fs");

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const CONTRACT_ABI = [
  "function balanceOf(address shareholder) view returns (uint256 shareAmount, bool isValid, uint8 plan, uint256 expiry, bool licensed, bool isLifetime, uint256 daysRemaining, uint256 hrs, uint256 mins, uint256 secs)"
];

// Load private key (SERVER ONLY)
const privateKey = process.env.PRIVATE_KEY.replace(/\\n/g, '\n');

export default async function handler(req, res) {
  try {
    console.log("➡️ Incoming request");

    if (req.method !== "POST") {
      console.log("❌ Wrong method:", req.method);
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { wallet } = req.body || {};
    console.log("➡️ Wallet received:", wallet);

    if (!wallet) {
      console.log("❌ Missing wallet");
      return res.status(400).json({ error: "Missing wallet" });
    }

    console.log("➡️ ENV CHECK:");
    console.log("PRIVATE_KEY:", !!process.env.PRIVATE_KEY);
    console.log("SECRET:", !!process.env.SECRET);
    console.log("ALCHEMY_URL:", !!process.env.ALCHEMY_URL);
    console.log("CONTRACT_ADDRESS:", !!process.env.CONTRACT_ADDRESS);

    if (!process.env.ALCHEMY_URL) {
      console.log("❌ Missing ALCHEMY_URL");
      return res.status(500).json({ error: "Missing ALCHEMY_URL" });
    }

    if (!process.env.SECRET) {
      console.log("❌ Missing SECRET");
      return res.status(500).json({ error: "Missing SECRET" });
    }

    if (!process.env.CONTRACT_ADDRESS) {
      console.log("❌ Missing CONTRACT_ADDRESS");
      return res.status(500).json({ error: "Missing CONTRACT_ADDRESS" });
    }

    console.log("➡️ Creating provider...");
    const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL);

    console.log("➡️ Fetching ETH balance...");
    const ethBalance = await provider.getBalance(wallet);

    console.log("➡️ Connecting to contract...");
    const contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      provider
    );

    console.log("➡️ Calling contract.balanceOf...");
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

    console.log("➡️ Contract response:", {
      shareAmount: shareAmount.toString(),
      isValid,
      plan: Number(plan),
      expiry: expiry.toString(),
      licensed,
      isLifetime
    });

    // 🔒 FULL VALIDATION LOGIC
    const now = Math.floor(Date.now() / 1000);
    console.log("➡️ Current timestamp:", now);

    const valid =
      licensed &&
      isValid &&
      (isLifetime || Number(expiry) > now);

    console.log("➡️ License valid:", valid);

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

    console.log("➡️ License data:", licenseData);

    // 🔐 SIGN THE LICENSE DATA
    const payload = { license: licenseData };

    console.log("➡️ Signing payload...");
    const signer = crypto.createSign("SHA256");
    signer.update(JSON.stringify(payload));
    signer.end();

    const signature = signer.sign(privateKey, "base64");

    console.log("➡️ Signature created:", signature.slice(0, 30) + "...");

    if (!valid) {
      console.log("❌ License invalid path hit");

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

    console.log("➡️ Creating JWT...");
    const token = jwt.sign(
      {
        wallet,
        plan: Number(plan),
        licensed: true
      },
      process.env.SECRET
    );

    console.log("✅ Success — returning response");

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
    console.error("❌ ERROR:", err);

    return res.status(500).json({
      error: err.message || "Unknown error",
      valid: false
    });
  }
}