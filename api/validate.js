const { ethers } = require("ethers");
const jwt = require("jsonwebtoken");

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const CONTRACT_ABI = [
  "function balanceOf(address shareholder) view returns (uint256 shareAmount, bool isValid, uint8 plan, uint256 expiry, bool licensed, bool isLifetime, uint256 daysRemaining, uint256 hrs, uint256 mins, uint256 secs)"
];

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

    // 👇 ETH balance (unchanged)
    const ethBalance = await provider.getBalance(wallet);

    // 👇 Contract instance
    const contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      provider
    );

    // 👇 LICENSE CHECK (SECURITY)
    const [
      shareAmount,
      isValid,
      plan,
      expiry,
      licensed,
      isLifetime,
      daysRemaining
    ] = await contract.balanceOf(wallet);

    // 🔒 Validation logic
    if (!licensed || !isValid) {
      return res.status(403).json({ error: "Not licensed or invalid" });
    }

    if (!isLifetime) {
      const now = Math.floor(Date.now() / 1000);
      if (Number(expiry) < now) {
        return res.status(403).json({ error: "License expired" });
      }
    }

    // ✅ JWT only issued if valid
    const token = jwt.sign(
      {
        wallet,
        plan: Number(plan),
        licensed: true,
      },
      process.env.SECRET
    );

    return res.status(200).json({
      wallet,
      balance: ethers.formatEther(ethBalance),
      license: {
        shareAmount: shareAmount.toString(),
        plan: Number(plan),
        expiry: expiry.toString(),
        isLifetime,
        daysRemaining: daysRemaining.toString(),
      },
      token,
    });

  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({
      error: err.message || "Unknown error",
    });
  }
}