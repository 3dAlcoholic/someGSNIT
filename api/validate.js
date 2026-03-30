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
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { wallet } = req.body || {};

    if (!wallet) {
      return res.status(400).json({ error: "Missing wallet" });
    }

    if (!process.env.ALCHEMY_URL) {
      return res.status(500).json({ error: "Missing ALCHEMY_URL" });
    }

    if (!process.env.SECRET) {
      return res.status(500).json({ error: "Missing SECRET" });
    }

    if (!process.env.CONTRACT_ADDRESS) {
      return res.status(500).json({ error: "Missing CONTRACT_ADDRESS" });
    }

    const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL);

    const ethBalance = await provider.getBalance(wallet);

    const contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      provider
    );

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

    // 🔒 FULL VALIDATION LOGIC
    const now = Math.floor(Date.now() / 1000);

    const valid =
      licensed &&
      isValid &&
      (isLifetime || Number(expiry) > now);

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

    // 🔐 SIGN THE LICENSE DATA
    const payload = { license: licenseData };

    const signer = crypto.createSign("SHA256");
    signer.update(JSON.stringify(payload));
    signer.end();

    const signature = signer.sign(privateKey, "base64");

    if (!valid) {
      return res.status(403).json({
        valid: false,
        error: "License invalid, expired, or not licensed",
        license: licenseData,

        // 🔐 STILL RETURN SIGNATURE EVEN IF INVALID
        signed: {
          data: payload,
          signature
        }
      });
    }

    const token = jwt.sign(
      {
        wallet,
        plan: Number(plan),
        licensed: true
      },
      process.env.SECRET
    );

    return res.status(200).json({
      valid: true,
      wallet,
      balance: ethers.formatEther(ethBalance),

      license: licenseData,

      token,

      // 🔐 SIGNED RESPONSE (NEW)
      signed: {
        data: payload,
        signature
      }
    });

  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({
      error: err.message || "Unknown error",
      valid: false
    });
  }
}