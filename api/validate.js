import { ethers } from "ethers";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { wallet } = req.body || {};

  if (!wallet) {
    return res.status(400).json({ error: "Missing wallet" });
  }

  try {
    // Connect to BSC via Alchemy
    const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL);

    // Get wallet balance
    const balance = await provider.getBalance(wallet);

    // Convert to BNB
    const bnbBalance = ethers.formatEther(balance);

    // Create token
    const token = jwt.sign({ wallet }, process.env.SECRET);

    return res.status(200).json({
      wallet,
      balance: bnbBalance,
      token,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to read blockchain" });
  }
}