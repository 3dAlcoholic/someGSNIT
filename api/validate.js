import jwt from "jsonwebtoken";

export default function handler(req, res) {
  const { wallet } = req.body || {};

  if (!wallet) {
    return res.status(400).json({ error: "Missing wallet" });
  }

  // TEMP example "valid" wallet
  if (wallet === "0x123") {
    const token = jwt.sign({ wallet }, process.env.SECRET);

    return res.status(200).json({
      valid: true,
      token,
    });
  }

  return res.status(403).json({ valid: false });
}