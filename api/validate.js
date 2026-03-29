import jwt from "jsonwebtoken";

export default function handler(req, res) {
  const { wallet, token } = req.body || {};

  // Step 1: If no token → issue one
  if (!token) {
    if (!wallet) {
      return res.status(400).json({ error: "Missing wallet" });
    }

    const newToken = jwt.sign({ wallet }, process.env.SECRET);

    return res.status(200).json({
      valid: true,
      token: newToken,
    });
  }

  // Step 2: Verify existing token
  try {
    const decoded = jwt.verify(token, process.env.SECRET);

    return res.status(200).json({
      valid: true,
      wallet: decoded.wallet,
    });
  } catch (err) {
    return res.status(403).json({ valid: false, error: "Invalid token" });
  }
}