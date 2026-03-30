const { ethers } = require("ethers");
const jwt = require("jsonwebtoken");

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

    const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL);

    const balance = await provider.getBalance(wallet);

    const token = jwt.sign({ wallet }, process.env.SECRET);

    return res.status(200).json({
      wallet,
      balance: ethers.formatEther(balance),
      token,
    });

  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({
      error: err.message || "Unknown error",
    });
  }
}